// Gate overlay — React component positioned over the canvas
// Fixed timer duration. Timeout or wrong = game over.

import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface GateOverlayProps {
  visible: boolean;
  gateTime: number; // fixed timer duration in seconds
  onAnswer: (correct: boolean, timeRemaining: number) => void;
  question: ProtoQuestion;
  resolving: boolean;
  resolveCorrect: boolean | null;
}

export interface ProtoQuestion {
  prompt: string;
  latex: string;
  options: string[];
  correctIndex: number;
  reasoning: string;
}

export const PROTO_QUESTIONS: ProtoQuestion[] = [
  {
    prompt: 'What is the value of this expression?',
    latex: '\\frac{3}{4} + \\frac{1}{4}',
    options: ['\\frac{1}{2}', '1', '\\frac{3}{2}', '\\frac{7}{4}'],
    correctIndex: 1,
    reasoning: 'When denominators match, add numerators: 3 + 1 = 4. So \\frac{4}{4} = 1',
  },
  {
    prompt: 'Simplify:',
    latex: '\\frac{6}{8}',
    options: ['\\frac{1}{2}', '\\frac{3}{4}', '\\frac{2}{3}', '\\frac{6}{8}'],
    correctIndex: 1,
    reasoning: 'Divide numerator and denominator by GCF (2): \\frac{6 \\div 2}{8 \\div 2} = \\frac{3}{4}',
  },
  {
    prompt: 'Which is greater?',
    latex: '\\frac{2}{3} \\text{ vs } \\frac{3}{5}',
    options: ['\\frac{2}{3}', '\\frac{3}{5}', 'They are equal', 'Cannot tell'],
    correctIndex: 0,
    reasoning: 'Cross multiply: 2 \\times 5 = 10 > 3 \\times 3 = 9, so \\frac{2}{3} > \\frac{3}{5}',
  },
  {
    prompt: 'Solve:',
    latex: '\\frac{5}{6} - \\frac{1}{3}',
    options: ['\\frac{1}{2}', '\\frac{4}{6}', '\\frac{2}{3}', '\\frac{1}{3}'],
    correctIndex: 0,
    reasoning: 'Common denominator: \\frac{5}{6} - \\frac{2}{6} = \\frac{3}{6} = \\frac{1}{2}',
  },
  {
    prompt: 'What is:',
    latex: '3 \\times \\frac{2}{5}',
    options: ['\\frac{6}{5}', '\\frac{5}{6}', '\\frac{2}{15}', '\\frac{6}{15}'],
    correctIndex: 0,
    reasoning: 'Multiply numerator: \\frac{3 \\times 2}{5} = \\frac{6}{5}',
  },
];

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      try { katex.render(math, ref.current, { throwOnError: false }); }
      catch { ref.current.textContent = math; }
    }
  }, [math]);
  return <span ref={ref} />;
}

export function GateOverlay({
  visible, gateTime, onAnswer, question, resolving, resolveCorrect,
}: GateOverlayProps) {
  const [timeLeft, setTimeLeft] = useState<number>(gateTime);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const timerRef = useRef<number>(0);
  const answeredRef = useRef(false);

  // Reset on new gate
  useEffect(() => {
    if (visible && !resolving) {
      setTimeLeft(gateTime);
      setSelectedIndex(null);
      answeredRef.current = false;
    }
  }, [visible, resolving, gateTime]);

  // Timer countdown
  useEffect(() => {
    if (!visible || resolving) return;
    const start = performance.now();
    const initial = gateTime;

    function tick() {
      const elapsed = (performance.now() - start) / 1000;
      const remaining = Math.max(0, initial - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !answeredRef.current) {
        answeredRef.current = true;
        onAnswer(false, 0); // timeout
        return;
      }
      timerRef.current = requestAnimationFrame(tick);
    }
    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
  }, [visible, resolving, gateTime, onAnswer]);

  const handleAnswer = useCallback((index: number) => {
    if (answeredRef.current || resolving) return;
    answeredRef.current = true;
    setSelectedIndex(index);
    onAnswer(index === question.correctIndex, timeLeft);
  }, [onAnswer, question.correctIndex, resolving, timeLeft]);

  if (!visible) return null;

  const timerFrac = gateTime > 0 ? timeLeft / gateTime : 0;
  const timerColor = timeLeft <= 3 ? '#e74c3c' : timeLeft <= 6 ? '#f39c12' : '#2ecc71';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `rgba(0,0,0,0.65)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'auto', fontFamily: 'system-ui, sans-serif', color: '#fff',
    }}>
      {/* Timer arc */}
      {!resolving && (
        <svg width="56" height="56" style={{ position: 'absolute', top: 14, left: 14 }}>
          <circle cx="28" cy="28" r="24" fill="none" stroke="#333" strokeWidth="4" />
          <circle cx="28" cy="28" r="24" fill="none" stroke={timerColor} strokeWidth="4"
            strokeDasharray={`${timerFrac * 150.8} 150.8`} strokeLinecap="round"
            transform="rotate(-90 28 28)" style={{ transition: 'stroke 0.3s' }} />
          <text x="28" y="33" textAnchor="middle" fill="#fff" fontSize="13">
            {Math.ceil(timeLeft)}
          </text>
        </svg>
      )}

      {/* Question */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 15, marginBottom: 10, opacity: 0.8 }}>{question.prompt}</div>
        <div style={{ fontSize: 26 }}><KaTeX math={question.latex} /></div>
      </div>

      {/* Resolving feedback */}
      {resolving && (
        <div style={{
          padding: '10px 20px', borderRadius: 8,
          background: resolveCorrect ? '#27ae60' : '#c0392b',
          marginBottom: 14, fontSize: 13, maxWidth: 380, textAlign: 'center',
        }}>
          <strong>{resolveCorrect ? 'Correct!' : 'Not quite.'}</strong>
          <div style={{ marginTop: 5, opacity: 0.9 }}><KaTeX math={question.reasoning} /></div>
        </div>
      )}

      {/* Answer grid */}
      {!resolving && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          maxWidth: 340, width: '100%', padding: '0 16px',
        }}>
          {question.options.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(i)} disabled={answeredRef.current}
              style={{
                padding: '12px 6px', fontSize: 17,
                border: '2px solid',
                borderColor: selectedIndex === i
                  ? (i === question.correctIndex ? '#27ae60' : '#c0392b')
                  : '#555',
                borderRadius: 8,
                background: selectedIndex === i ? '#333' : '#222',
                color: '#fff',
                cursor: answeredRef.current ? 'default' : 'pointer',
                minHeight: 48, minWidth: 48,
              }}>
              <KaTeX math={opt} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
