// Main app: time bank economy, double jump, game over on wrong/timeout

import { useRef, useEffect, useState, useCallback } from 'react';
import { CONFIG } from './config';
import { getState, transitionTo, onStateChange, resetState } from './state';
import { initRunner, startLoop, stopLoop, setCallbacks, triggerBoost, setupInput, teardownInput } from './runner';
import { GateOverlay, PROTO_QUESTIONS, type ProtoQuestion } from './GateOverlay';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState(getState());
  const [fps, setFps] = useState(0);
  const [gateVisible, setGateVisible] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveCorrect, setResolveCorrect] = useState<boolean | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<ProtoQuestion>(PROTO_QUESTIONS[0]);
  const [gateCount, setGateCount] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [orbs, setOrbs] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [finalStats, setFinalStats] = useState<{ score: number; gates: number; orbs: number } | null>(null);
  const questionIdx = useRef(0);

  // Canvas scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = container!.getBoundingClientRect();
      const scale = Math.min(rect.width / CONFIG.LOGICAL_WIDTH, rect.height / CONFIG.LOGICAL_HEIGHT);
      const w = CONFIG.LOGICAL_WIDTH * scale;
      const h = CONFIG.LOGICAL_HEIGHT * scale;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      canvas!.width = CONFIG.LOGICAL_WIDTH * dpr;
      canvas!.height = CONFIG.LOGICAL_HEIGHT * dpr;
      canvas!.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Init
  useEffect(() => {
    if (!canvasRef.current) return;
    initRunner(canvasRef.current);
    setCallbacks({
      onGateActive: () => {
        const q = PROTO_QUESTIONS[questionIdx.current % PROTO_QUESTIONS.length];
        questionIdx.current++;
        setCurrentQuestion(q);
        setGateVisible(true);
        setResolving(false);
        setResolveCorrect(null);
      },
      onFpsUpdate: (f) => setFps(f),
      onOrbCollected: (total, orbScore) => { setOrbs(total); setScore((s) => s + orbScore); },
    });
    setupInput();
    startLoop();
    return () => { stopLoop(); teardownInput(); };
  }, []);

  // State listener
  useEffect(() => {
    return onStateChange((_from, to) => setGameState(to));
  }, []);

  // Handle answer
  const handleAnswer = useCallback((correct: boolean, timeRemaining: number) => {
    transitionTo('GATE_RESOLVING');
    setResolving(true);
    setResolveCorrect(correct);
    setGateCount((c) => c + 1);

    if (correct) {
      // Score: base × speed_bonus × streak_multiplier
      const speedBonus = CONFIG.GATE_TIMER_DURATION > 0 ? timeRemaining / CONFIG.GATE_TIMER_DURATION : 0;
      const newStreak = Math.min(streak + 1, CONFIG.MAX_STREAK_MULTIPLIER);
      const gateScore = Math.floor(CONFIG.BASE_GATE_SCORE * (0.5 + speedBonus * 0.5) * newStreak);
      setScore((s) => s + gateScore);
      setStreak(newStreak);

      // Continue running after resolve
      setTimeout(() => {
        setGateVisible(false);
        setResolving(false);
        triggerBoost();
        transitionTo('RUNNING');
      }, CONFIG.GATE_RESOLVE_DURATION * 1000);
    } else {
      // Wrong or timeout = game over
      setStreak(0);
      setTimeout(() => {
        setGateVisible(false);
        setResolving(false);
        stopLoop();
        setGameOver(true);
        setFinalStats({
          score: score + 0, // current score (no bonus for failed gate)
          gates: gateCount + 1,
          orbs,
        });
      }, CONFIG.GATE_RESOLVE_DURATION * 1000);
    }
  }, [streak, score, gateCount, orbs]);

  // Start
  const handleStart = () => transitionTo('RUNNING');

  // Restart
  const handleRestart = () => {
    stopLoop();
    teardownInput();
    resetState();
    setGameState('READY');
    setGateVisible(false);
    setResolving(false);
    setScore(0);
    setStreak(0);
    setGateCount(0);
    setOrbs(0);
    setGameOver(false);
    setFinalStats(null);
    questionIdx.current = 0;
    if (canvasRef.current) {
      initRunner(canvasRef.current);
      setCallbacks({
        onGateActive: () => {
          const q = PROTO_QUESTIONS[questionIdx.current % PROTO_QUESTIONS.length];
          questionIdx.current++;
          setCurrentQuestion(q);
          setGateVisible(true);
          setResolving(false);
          setResolveCorrect(null);
        },
        onFpsUpdate: (f) => setFps(f),
        onOrbCollected: (total, orbScore) => { setOrbs(total); setScore((s) => s + orbScore); },
      });
      setupInput();
      startLoop();
    }
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', color: '#fff',
    }}>
      {/* HUD */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 6, fontSize: 13, opacity: 0.7 }}>
        <span>Score: {score}</span>
        <span>Streak: {streak}x</span>
        <span>Orbs: {orbs}</span>
        <span>Gates: {gateCount}</span>
        <span>FPS: {fps}</span>
      </div>

      {/* Game container */}
      <div ref={containerRef} style={{
        position: 'relative', width: '90vw', maxWidth: 800,
        aspectRatio: '16 / 9', background: '#111', borderRadius: 8, overflow: 'hidden',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />

        {/* Gate overlay */}
        <GateOverlay
          visible={gateVisible}
          gateTime={CONFIG.GATE_TIMER_DURATION}
          onAnswer={handleAnswer}
          question={currentQuestion}
          resolving={resolving}
          resolveCorrect={resolveCorrect}
        />

        {/* READY screen */}
        {gameState === 'READY' && !gameOver && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
          }}>
            <h1 style={{ fontSize: 32, margin: '0 0 6px' }}>JetRun</h1>
            <p style={{ fontSize: 13, opacity: 0.6, margin: '0 0 6px' }}>
              Collect orbs for points. Dodge obstacles. Answer the math.
            </p>
            <p style={{ fontSize: 11, opacity: 0.4, margin: '0 0 20px' }}>
              ↑ / Space = Jump (x2) &nbsp;&nbsp; ↓ / S = Duck / Fast-fall
            </p>
            <button onClick={handleStart} autoFocus style={{
              padding: '12px 44px', fontSize: 20, background: '#3498db',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>Play</button>
          </div>
        )}

        {/* GAME OVER screen */}
        {gameOver && finalStats && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
          }}>
            <h1 style={{ fontSize: 28, margin: '0 0 10px', color: '#e74c3c' }}>Great effort!</h1>
            <div style={{ fontSize: 36, fontWeight: 'bold', margin: '0 0 16px' }}>
              {finalStats.score} pts
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 24, fontSize: 14, opacity: 0.7 }}>
              <span>Gates: {finalStats.gates}</span>
              <span>Orbs: {finalStats.orbs}</span>
            </div>
            <button onClick={handleRestart} autoFocus style={{
              padding: '14px 48px', fontSize: 20, background: '#3498db',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>Play Again</button>
            <p style={{ fontSize: 11, opacity: 0.4, marginTop: 10 }}>
              Fresh questions each run
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.4 }}>
        <button onClick={handleRestart} style={{
          padding: '5px 14px', fontSize: 11, background: '#333',
          color: '#fff', border: '1px solid #555', borderRadius: 4, cursor: 'pointer',
        }}>Reset</button>
        <span style={{ marginLeft: 12 }}>
          Gate every {CONFIG.GATE_INTERVAL_FIRST}s / {CONFIG.GATE_INTERVAL}s
          &nbsp;·&nbsp; {CONFIG.GATE_TIMER_DURATION}s per gate &nbsp;·&nbsp; Orbs = score
        </span>
      </div>
    </div>
  );
}
