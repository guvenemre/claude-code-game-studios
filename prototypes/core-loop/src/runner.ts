// Canvas runner — double jump, fast-fall, orb trails, fixed gate timer
// Prototype: colored shapes, no sprites. Focus on FEEL.

import { CONFIG } from './config';
import { getState, transitionTo } from './state';

// ---- Types ----

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface Orb {
  x: number; y: number; baseY: number;
  phase: number;
  collected: boolean; collectTimer: number;
  zone: 'high' | 'mid' | 'low';
  scoreValue: number;
}

interface Obstacle {
  x: number; y: number; width: number; height: number;
  type: 'barrier_top' | 'barrier_bot' | 'pillar' | 'hovering';
  passed: boolean; hit: boolean;
}

type CharacterAction = 'run' | 'jump' | 'duck';

interface RunnerState {
  farOffset: number; midOffset: number; nearOffset: number;
  speedMultiplier: number; boostTimer: number;
  gateTimer: number; gatesTriggered: number; approachTimer: number;

  // Character
  characterY: number; characterBaseY: number;
  bobPhase: number; tilt: number;
  action: CharacterAction;
  jumpVelocity: number;
  jumpsUsed: number;     // 0 = on ground, 1 = single jumped, 2 = double jumped
  fastFalling: boolean;
  invincibleTime: number;

  // World
  orbs: Orb[];
  obstacles: Obstacle[];
  particles: Particle[];
  orbSpawnTimer: number;
  obstacleSpawnTimer: number;
  orbsCollected: number;
  approachIntensity: number;
  shakeX: number; shakeY: number; shakeDecay: number;
  stars: Array<{ x: number; y: number; brightness: number; speed: number }>;
  frameCount: number; fpsAccum: number; fps: number;
  worldTime: number;

  // Popup texts
  popups: Array<{ x: number; y: number; text: string; color: string; life: number }>;
}

// ---- Module state ----

let state: RunnerState;
let lastTimestamp = 0;
let animFrameId = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const inputState = { jumpPressed: false, duckPressed: false, duckHeld: false };

let onGateActive: (() => void) | null = null;
let onFpsUpdate: ((fps: number) => void) | null = null;
let onOrbCollected: ((total: number, score: number) => void) | null = null;

export function setCallbacks(callbacks: {
  onGateActive?: () => void;
  onFpsUpdate?: (fps: number) => void;
  onOrbCollected?: (total: number, score: number) => void;
}) {
  onGateActive = callbacks.onGateActive ?? null;
  onFpsUpdate = callbacks.onFpsUpdate ?? null;
  onOrbCollected = callbacks.onOrbCollected ?? null;
}

// ---- Input ----

function handleKeyDown(e: KeyboardEvent) {
  const gs = getState();
  if (gs !== 'RUNNING' && gs !== 'GATE_APPROACHING') return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    inputState.jumpPressed = true;
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    inputState.duckPressed = true;
    inputState.duckHeld = true;
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    inputState.jumpPressed = false;
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    inputState.duckPressed = false;
    inputState.duckHeld = false;
  }
}

function handleTouchStart(e: TouchEvent) {
  const gs = getState();
  if (gs !== 'RUNNING' && gs !== 'GATE_APPROACHING') return;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const relY = (touch.clientY - rect.top) / rect.height;
  if (relY < 0.5) {
    inputState.jumpPressed = true;
  } else {
    inputState.duckPressed = true;
    inputState.duckHeld = true;
  }
}

function handleTouchEnd() {
  inputState.jumpPressed = false;
  inputState.duckPressed = false;
  inputState.duckHeld = false;
}

export function setupInput() {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchend', handleTouchEnd);
}

export function teardownInput() {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('touchstart', handleTouchStart);
  window.removeEventListener('touchend', handleTouchEnd);
}

// ---- Init ----

function makeStars(): RunnerState['stars'] {
  const stars: RunnerState['stars'] = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * CONFIG.LOGICAL_WIDTH,
      y: Math.random() * CONFIG.LOGICAL_HEIGHT * 0.65,
      brightness: 0.3 + Math.random() * 0.7,
      speed: 5 + Math.random() * 15,
    });
  }
  return stars;
}

export function initRunner(canvasEl: HTMLCanvasElement) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d')!;
  const baseY = CONFIG.LOGICAL_HEIGHT * CONFIG.GROUND_Y_FRAC;
  state = {
    farOffset: 0, midOffset: 0, nearOffset: 0,
    speedMultiplier: 1.0, boostTimer: 0,
    gateTimer: 0, gatesTriggered: 0, approachTimer: 0,
    characterY: baseY, characterBaseY: baseY,
    bobPhase: 0, tilt: 0,
    action: 'run', jumpVelocity: 0, jumpsUsed: 0,
    fastFalling: false, invincibleTime: 0,
    orbs: [], obstacles: [], particles: [],
    orbSpawnTimer: 1.0, obstacleSpawnTimer: 2.0,
    orbsCollected: 0,
    approachIntensity: 0,
    shakeX: 0, shakeY: 0, shakeDecay: 0,
    stars: makeStars(),
    frameCount: 0, fpsAccum: 0, fps: 0,
    worldTime: 0,
    popups: [],
  };
}

export function startLoop() {
  lastTimestamp = performance.now();
  animFrameId = requestAnimationFrame(tick);
}

export function stopLoop() {
  cancelAnimationFrame(animFrameId);
}

// ---- Game loop ----

function tick(timestamp: number) {
  const rawDelta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  const dt = Math.min(rawDelta, CONFIG.MAX_DELTA_TIME) / 1000;
  const gameState = getState();

  state.frameCount++;
  state.fpsAccum += rawDelta;
  if (state.fpsAccum >= 1000) {
    state.fps = state.frameCount;
    state.frameCount = 0;
    state.fpsAccum = 0;
    onFpsUpdate?.(state.fps);
  }
  state.worldTime += dt;

  if (gameState === 'RUNNING') updateRunning(dt);
  else if (gameState === 'GATE_APPROACHING') updateApproaching(dt);
  else if (gameState === 'GATE_ACTIVE' || gameState === 'GATE_RESOLVING') updateAtGateSpeed(dt);

  updateParticles(dt);
  updatePopups(dt);
  updateShake(dt);
  render();
  animFrameId = requestAnimationFrame(tick);
}

// ---- Character physics ----

function processPlayerInput(dt: number) {
  if (state.invincibleTime > 0) state.invincibleTime -= dt;

  const isAirborne = state.action === 'jump';

  // JUMP (ground or double jump)
  if (inputState.jumpPressed) {
    inputState.jumpPressed = false;

    if (!isAirborne && state.action !== 'duck') {
      // First jump from ground
      state.action = 'jump';
      state.jumpVelocity = CONFIG.JUMP_VELOCITY;
      state.jumpsUsed = 1;
      state.fastFalling = false;
      spawnDust(6, '#8e8e8e');
    } else if (isAirborne && state.jumpsUsed === 1) {
      // Double jump
      state.jumpVelocity = CONFIG.DOUBLE_JUMP_VELOCITY;
      state.jumpsUsed = 2;
      state.fastFalling = false;
      // Double jump burst — distinct visual
      for (let p = 0; p < 8; p++) {
        const angle = (p / 8) * Math.PI * 2;
        state.particles.push({
          x: CONFIG.CHARACTER_X, y: state.characterY,
          vx: Math.cos(angle) * 70, vy: Math.sin(angle) * 70,
          life: 0.3, maxLife: 0.3,
          color: '#a29bfe', size: 3 + Math.random() * 2,
        });
      }
    }
  }

  // DUCK — hold to stay ducked, release to stand
  if (!isAirborne && inputState.duckHeld) {
    if (state.action !== 'duck') {
      state.action = 'duck';
      spawnSparks(4, '#f1c40f');
    }
  } else if (state.action === 'duck' && !inputState.duckHeld) {
    state.action = 'run';
  }

  // Fast-fall: hold duck while airborne
  if (isAirborne && inputState.duckHeld) {
    state.fastFalling = true;
  }

  // Update jump physics
  if (state.action === 'jump') {
    const grav = state.fastFalling ? CONFIG.FAST_FALL_GRAVITY : CONFIG.GRAVITY;
    state.jumpVelocity += grav * dt;
    state.characterY += state.jumpVelocity * dt;

    // Landed
    if (state.characterY >= state.characterBaseY) {
      state.characterY = state.characterBaseY;
      state.action = 'run';
      state.jumpVelocity = 0;
      state.jumpsUsed = 0;
      state.fastFalling = false;
      if (state.jumpVelocity > 200) spawnDust(4, '#aaa'); // heavier landing = more dust
      spawnDust(3, '#aaa');
    }
  }

  // Normal bob
  if (state.action === 'run') {
    state.bobPhase += dt * (8 + state.speedMultiplier * 2);
    state.characterY = state.characterBaseY + Math.sin(state.bobPhase) * 2.5;
  }
}

function spawnDust(count: number, color: string) {
  for (let p = 0; p < count; p++) {
    state.particles.push({
      x: CONFIG.CHARACTER_X + (Math.random() - 0.5) * 15,
      y: state.characterBaseY + 10,
      vx: (Math.random() - 0.5) * 80,
      vy: -20 - Math.random() * 40,
      life: 0.3 + Math.random() * 0.15, maxLife: 0.4,
      color, size: 3 + Math.random() * 2,
    });
  }
}

function spawnSparks(count: number, color: string) {
  for (let p = 0; p < count; p++) {
    state.particles.push({
      x: CONFIG.CHARACTER_X + 10 + Math.random() * 10,
      y: state.characterBaseY + 12,
      vx: -40 - Math.random() * 60,
      vy: -10 - Math.random() * 20,
      life: 0.2 + Math.random() * 0.1, maxLife: 0.3,
      color, size: 2 + Math.random(),
    });
  }
}

// ---- Main updates ----

function updateRunning(dt: number) {
  // Boost
  if (state.boostTimer > 0) {
    state.boostTimer -= dt;
    const phase = state.boostTimer / CONFIG.BOOST_DURATION;
    state.speedMultiplier = phase > 0 ? 1.0 + (CONFIG.BOOST_MULTIPLIER - 1.0) * phase : 1.0;
  } else {
    state.speedMultiplier = 1.0;
  }

  const scrollSpeed = CONFIG.BASE_SPEED * state.speedMultiplier;
  scrollParallax(dt, state.speedMultiplier);
  processPlayerInput(dt);

  // Gate interval
  state.gateTimer += dt;
  const interval = state.gatesTriggered === 0 ? CONFIG.GATE_INTERVAL_FIRST : CONFIG.GATE_INTERVAL;
  const timeToGate = interval - state.gateTimer;
  state.approachIntensity = timeToGate < 3 ? 1 - (timeToGate / 3) : 0;

  if (state.gateTimer >= interval) {
    state.gateTimer = 0;
    state.gatesTriggered++;
    state.approachTimer = CONFIG.GATE_APPROACH_DURATION;
    state.approachIntensity = 1;
    transitionTo('GATE_APPROACHING');
  }

  // Spawn orbs (trails)
  state.orbSpawnTimer -= dt;
  if (state.orbSpawnTimer <= 0) {
    spawnOrbTrail();
    state.orbSpawnTimer = 1.5 + Math.random() * 1.5;
  }

  // Spawn obstacles
  state.obstacleSpawnTimer -= dt;
  if (state.obstacleSpawnTimer <= 0) {
    spawnObstacle();
    state.obstacleSpawnTimer = 2.0 + Math.random() * 2.0;
  }

  updateOrbs(dt, scrollSpeed);
  updateObstacles(dt, scrollSpeed);
  updateStars(dt);
  state.tilt *= 0.92;
}

function updateApproaching(dt: number) {
  state.approachTimer -= dt;
  const t = Math.max(0, state.approachTimer / CONFIG.GATE_APPROACH_DURATION);
  state.speedMultiplier = CONFIG.GATE_SPEED_MULTIPLIER + (1.0 - CONFIG.GATE_SPEED_MULTIPLIER) * t;
  state.approachIntensity = 1;

  scrollParallax(dt, state.speedMultiplier);
  processPlayerInput(dt);
  updateOrbs(dt, CONFIG.BASE_SPEED * state.speedMultiplier);
  updateObstacles(dt, CONFIG.BASE_SPEED * state.speedMultiplier);
  updateStars(dt);

  if (Math.random() < 0.4) spawnApproachParticle();

  if (state.approachTimer <= 0) {
    state.speedMultiplier = CONFIG.GATE_SPEED_MULTIPLIER;
    transitionTo('GATE_ACTIVE');
    onGateActive?.();
  }
  state.tilt *= 0.95;
}

function updateAtGateSpeed(dt: number) {
  state.speedMultiplier = CONFIG.GATE_SPEED_MULTIPLIER;
  state.approachIntensity = getState() === 'GATE_ACTIVE' ? 0.3 : 0;
  scrollParallax(dt, state.speedMultiplier);
  updateStars(dt);
  state.bobPhase += dt * 4;
  if (state.action !== 'jump') {
    state.characterY = state.characterBaseY + Math.sin(state.bobPhase) * 2;
    state.action = 'run';
    state.jumpsUsed = 0;
  }
  state.tilt *= 0.95;
}

function spawnPopup(x: number, y: number, text: string, color: string) {
  state.popups.push({ x, y, text, color, life: 1.0 });
}

function updatePopups(dt: number) {
  for (let i = state.popups.length - 1; i >= 0; i--) {
    state.popups[i].y -= 30 * dt;
    state.popups[i].life -= dt;
    if (state.popups[i].life <= 0) state.popups.splice(i, 1);
  }
}

// ---- Orbs (trail patterns) ----

function spawnOrbTrail() {
  const W = CONFIG.LOGICAL_WIDTH;
  const groundY = CONFIG.LOGICAL_HEIGHT * CONFIG.GROUND_Y_FRAC;

  // Pick a zone for this trail
  const zones: Orb['zone'][] = ['low', 'mid', 'mid', 'high']; // mid more common
  const zone = zones[Math.floor(Math.random() * zones.length)];

  // Trail: 3-5 orbs in an arc
  const count = 3 + Math.floor(Math.random() * 3);
  const spacing = 45;

  let baseHeight: number;
  let scoreVal: number;
  switch (zone) {
    case 'low':
      baseHeight = 15 + Math.random() * 20;
      scoreVal = CONFIG.ORB_SCORE_LOW;
      break;
    case 'mid':
      baseHeight = CONFIG.ZONE_LOW_TOP + 10 + Math.random() * 30;
      scoreVal = CONFIG.ORB_SCORE_MID;
      break;
    case 'high':
      baseHeight = CONFIG.ZONE_MID_TOP + 10 + Math.random() * 30;
      scoreVal = CONFIG.ORB_SCORE_HIGH;
      break;
  }

  for (let i = 0; i < count; i++) {
    // Arc shape: middle orbs slightly higher
    const arcT = i / (count - 1); // 0 to 1
    const arcOffset = Math.sin(arcT * Math.PI) * 20;
    const y = groundY - baseHeight - arcOffset;

    state.orbs.push({
      x: W + 30 + i * spacing,
      y, baseY: y,
      phase: Math.random() * Math.PI * 2,
      collected: false, collectTimer: 0,
      zone, scoreValue: scoreVal,
    });
  }
}

function updateOrbs(dt: number, scrollSpeed: number) {
  const charX = CONFIG.CHARACTER_X;
  const charY = state.characterY;
  const isDucking = state.action === 'duck';
  const charHalfH = isDucking ? 10 : 18;

  for (let i = state.orbs.length - 1; i >= 0; i--) {
    const orb = state.orbs[i];
    orb.x -= scrollSpeed * dt;
    orb.phase += dt * 3;
    orb.y = orb.baseY + Math.sin(orb.phase) * 5;

    if (orb.collected) {
      orb.collectTimer -= dt;
      if (orb.collectTimer <= 0) state.orbs.splice(i, 1);
      continue;
    }

    // Collection
    const dx = orb.x - charX;
    const dy = orb.y - charY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < charHalfH + 10) {
      orb.collected = true;
      orb.collectTimer = 0.25;
      state.orbsCollected++;

      // Score popup
      const label = `+${orb.scoreValue}`;
      const col = orb.zone === 'high' ? '#64b5f6' : orb.zone === 'low' ? '#81c784' : '#ffd700';
      spawnPopup(orb.x, orb.y - 15, label, col);
      onOrbCollected?.(state.orbsCollected, orb.scoreValue);

      // Burst
      for (let p = 0; p < 6; p++) {
        const angle = (p / 6) * Math.PI * 2;
        state.particles.push({
          x: orb.x, y: orb.y,
          vx: Math.cos(angle) * (60 + Math.random() * 50),
          vy: Math.sin(angle) * (60 + Math.random() * 50),
          life: 0.35, maxLife: 0.4,
          color: col, size: 3 + Math.random() * 2,
        });
      }
      state.shakeDecay = 0.08;
      state.shakeX = (Math.random() - 0.5) * 2;
      state.shakeY = (Math.random() - 0.5) * 2;
    }

    if (orb.x < -40) state.orbs.splice(i, 1);
  }
}

// ---- Obstacles ----

function spawnObstacle() {
  const W = CONFIG.LOGICAL_WIDTH;
  const groundY = CONFIG.LOGICAL_HEIGHT * CONFIG.GROUND_Y_FRAC;

  const types: Obstacle['type'][] = ['barrier_top', 'barrier_bot', 'pillar', 'hovering'];
  const type = types[Math.floor(Math.random() * types.length)];

  let obs: Obstacle;
  switch (type) {
    case 'barrier_top':
      // Hangs from top down to ~20px above ground — must duck to avoid
      obs = { x: W + 20, y: 0, width: 50, height: groundY - 20, type, passed: false, hit: false };
      break;
    case 'barrier_bot':
      // Ground obstacle, ~35px tall — single jump clears it
      obs = { x: W + 20, y: groundY - 35, width: 45, height: 35, type, passed: false, hit: false };
      break;
    case 'pillar':
      // Taller ground obstacle, ~55px — single jump clears, need timing
      obs = { x: W + 20, y: groundY - 55, width: 22, height: 55, type, passed: false, hit: false };
      break;
    case 'hovering':
      // Floats at head height — duck on ground OR jump over
      obs = { x: W + 20, y: groundY - 45, width: 40, height: 30, type, passed: false, hit: false };
      break;
  }
  state.obstacles.push(obs);
}

function updateObstacles(dt: number, scrollSpeed: number) {
  const charX = CONFIG.CHARACTER_X;
  const charW = 22;
  const isDucking = state.action === 'duck';
  const charTop = isDucking
    ? state.characterBaseY - 5    // very low profile when ducking
    : state.characterY - 30;
  const charBot = isDucking
    ? state.characterBaseY + 14
    : state.characterY + 12;

  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const obs = state.obstacles[i];
    obs.x -= scrollSpeed * dt;

    // Collision
    if (!obs.hit && !obs.passed && state.invincibleTime <= 0) {
      const overlapX = charX + charW > obs.x && charX - 6 < obs.x + obs.width;
      const overlapY = charBot > obs.y && charTop < obs.y + obs.height;

      if (overlapX && overlapY) {
        obs.hit = true;
        hitCharacter(obs.x, obs.y + obs.height / 2);
      }
    }

    // Passed clean
    if (!obs.passed && obs.x + obs.width < charX - 6) {
      obs.passed = true;
      if (!obs.hit) {
        // Near-miss sparks
        for (let p = 0; p < 5; p++) {
          state.particles.push({
            x: charX + 15, y: state.characterY + (Math.random() - 0.5) * 20,
            vx: -30 - Math.random() * 50, vy: (Math.random() - 0.5) * 100,
            life: 0.25, maxLife: 0.35, color: '#e0e0e0', size: 2 + Math.random(),
          });
        }
      }
    }

    if (obs.x < -80) state.obstacles.splice(i, 1);
  }
}

function hitCharacter(hitX: number, hitY: number) {
  state.invincibleTime = CONFIG.HIT_INVINCIBLE;
  spawnPopup(hitX, hitY - 20, `HIT!`, '#e74c3c');

  // Shake + particles
  state.shakeDecay = 0.3;
  state.shakeX = (Math.random() - 0.5) * 8;
  state.shakeY = (Math.random() - 0.5) * 6;
  state.tilt = (Math.random() - 0.5) * 0.3;

  for (let p = 0; p < 10; p++) {
    const angle = Math.random() * Math.PI * 2;
    state.particles.push({
      x: CONFIG.CHARACTER_X, y: state.characterY,
      vx: Math.cos(angle) * (60 + Math.random() * 80),
      vy: Math.sin(angle) * (60 + Math.random() * 80),
      life: 0.3 + Math.random() * 0.2, maxLife: 0.45,
      color: Math.random() > 0.5 ? '#e74c3c' : '#ff6b6b',
      size: 3 + Math.random() * 2,
    });
  }
}

// ---- Particles / environment ----

function spawnApproachParticle() {
  const W = CONFIG.LOGICAL_WIDTH;
  const H = CONFIG.LOGICAL_HEIGHT;
  state.particles.push({
    x: W + 10, y: Math.random() * H * 0.7 + H * 0.1,
    vx: -(400 + Math.random() * 300), vy: (Math.random() - 0.5) * 30,
    life: 0.6 + Math.random() * 0.4, maxLife: 0.8,
    color: Math.random() > 0.5 ? '#e94560' : '#ff6b6b',
    size: 2 + Math.random() * 2,
  });
}

function updateParticles(dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function updateShake(dt: number) {
  if (state.shakeDecay > 0) {
    state.shakeDecay -= dt;
    const t = Math.max(0, state.shakeDecay / 0.35);
    state.shakeX *= t;
    state.shakeY *= t;
  } else { state.shakeX = 0; state.shakeY = 0; }
}

function updateStars(dt: number) {
  for (const s of state.stars) {
    s.x -= s.speed * state.speedMultiplier * dt;
    if (s.x < 0) { s.x = CONFIG.LOGICAL_WIDTH; s.y = Math.random() * CONFIG.LOGICAL_HEIGHT * 0.65; }
  }
}

function scrollParallax(dt: number, speedMul: number) {
  const px = CONFIG.BASE_SPEED * speedMul * dt;
  state.farOffset = (state.farOffset + px * CONFIG.PARALLAX_FAR) % CONFIG.LOGICAL_WIDTH;
  state.midOffset = (state.midOffset + px * CONFIG.PARALLAX_MID) % CONFIG.LOGICAL_WIDTH;
  state.nearOffset = (state.nearOffset + px * CONFIG.PARALLAX_NEAR) % CONFIG.LOGICAL_WIDTH;
}

export function triggerBoost() {
  state.boostTimer = CONFIG.BOOST_DURATION;
  state.speedMultiplier = CONFIG.BOOST_MULTIPLIER;
  for (let p = 0; p < 12; p++) {
    state.particles.push({
      x: CONFIG.CHARACTER_X - 10, y: state.characterY + (Math.random() - 0.5) * 20,
      vx: -(100 + Math.random() * 150), vy: (Math.random() - 0.5) * 80,
      life: 0.3 + Math.random() * 0.3, maxLife: 0.5,
      color: Math.random() > 0.5 ? '#3498db' : '#00d2ff',
      size: 3 + Math.random() * 2,
    });
  }
  state.shakeDecay = 0.2;
  state.shakeX = (Math.random() - 0.5) * 5;
  state.shakeY = (Math.random() - 0.5) * 3;
}

// ============================================================
// RENDER
// ============================================================

function render() {
  if (!ctx || !canvas) return;
  const W = CONFIG.LOGICAL_WIDTH;
  const H = CONFIG.LOGICAL_HEIGHT;
  const groundY = H * CONFIG.GROUND_Y_FRAC;

  ctx.save();
  ctx.translate(state.shakeX, state.shakeY);

  // Sky
  const intensity = state.approachIntensity;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, lerpColor('#1a1a2e', '#2d1b3d', intensity));
  grad.addColorStop(1, lerpColor('#16213e', '#1a1a35', intensity));
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Stars
  for (const s of state.stars) {
    ctx.globalAlpha = s.brightness * (0.7 + 0.3 * Math.sin(state.worldTime * 2 + s.x));
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, s.y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Parallax layers
  drawParallax(ctx, state.farOffset, W, H, '#0f3460', 0.7, 80);
  drawParallax(ctx, state.midOffset, W, H, lerpColor('#533483', '#6a1b6a', intensity), 0.85, 50);

  // Ground
  ctx.fillStyle = lerpColor('#2c3e50', '#3d2c50', intensity);
  ctx.fillRect(0, groundY + 15, W, H - groundY);
  ctx.strokeStyle = lerpColor('#34495e', '#5e3470', intensity);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundY + 15); ctx.lineTo(W, groundY + 15); ctx.stroke();
  drawGroundDetails(ctx, state.nearOffset, groundY);

  // Obstacles
  drawObstacles(ctx, groundY);

  // Orbs
  drawOrbs(ctx);

  // Gate
  const gs = getState();
  if (gs === 'GATE_APPROACHING' || gs === 'GATE_ACTIVE' || gs === 'GATE_RESOLVING') {
    drawGate(ctx, W, groundY, gs);
  }

  // Character
  drawCharacter(ctx);

  // Particles
  drawParticles(ctx);

  // Popups
  drawPopups(ctx);

  // Approach vignette
  if (intensity > 0.3) drawVignette(ctx, W, H, intensity);

  ctx.restore();

  // Debug
  ctx.fillStyle = '#00ff00';
  ctx.font = '11px monospace';
  ctx.fillText(`${state.fps} FPS`, W - 58, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(gs, 8, 14);

  // Controls hint
  if (gs === 'RUNNING' && state.worldTime < 6) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('↑ / Space = Jump (x2)     ↓ / S = Duck / Fast-fall', W / 2, H - 16);
    ctx.textAlign = 'start';
  }
}

// ---- Draw helpers ----

function drawParallax(ctx: CanvasRenderingContext2D, offset: number, W: number, H: number, color: string, yFrac: number, height: number) {
  ctx.fillStyle = color;
  const y = H * yFrac - height;
  for (let i = -1; i < 4; i++) {
    const x = i * (W / 2) - (offset % (W / 2));
    ctx.beginPath();
    ctx.moveTo(x, y + height); ctx.lineTo(x + 60, y); ctx.lineTo(x + 120, y + height * 0.6);
    ctx.lineTo(x + 180, y + height * 0.2); ctx.lineTo(x + 250, y + height);
    ctx.closePath(); ctx.fill();
  }
}

function drawGroundDetails(ctx: CanvasRenderingContext2D, offset: number, groundY: number) {
  ctx.fillStyle = '#1a252f';
  for (let i = -1; i < 12; i++) {
    const x = i * 80 - (offset % 80);
    ctx.fillRect(x, groundY + 17, 40, 3);
    ctx.fillRect(x + 20, groundY + 26, 30, 2);
  }
  if (state.speedMultiplier > 1.1) {
    ctx.strokeStyle = `rgba(52, 152, 219, ${(state.speedMultiplier - 1) * 0.6})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = i * 140 - (offset * 2 % 140);
      ctx.beginPath();
      ctx.moveTo(x, groundY + 20 + i * 4);
      ctx.lineTo(x + 60 + state.speedMultiplier * 20, groundY + 20 + i * 4);
      ctx.stroke();
    }
  }
}

function drawOrbs(ctx: CanvasRenderingContext2D) {
  for (const orb of state.orbs) {
    if (orb.collected) {
      const t = orb.collectTimer / 0.25;
      ctx.globalAlpha = t;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(orb.x, orb.y, 12 * t, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const col = orb.zone === 'high' ? '#64b5f6' : orb.zone === 'low' ? '#81c784' : '#ffd700';
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 + Math.sin(orb.phase * 2) * 3;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(orb.x - 2, orb.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  }
}

function drawObstacles(ctx: CanvasRenderingContext2D, groundY: number) {
  for (const obs of state.obstacles) {
    const flash = obs.hit && state.invincibleTime > CONFIG.HIT_INVINCIBLE - 0.12;
    const baseColor = flash ? '#ff4444' : '#7f8c8d';

    switch (obs.type) {
      case 'barrier_top':
        ctx.fillStyle = baseColor;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(obs.x, obs.y + obs.height - 4, obs.width, 4);
        ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + 12, 0); ctx.lineTo(obs.x + 12, obs.y);
        ctx.moveTo(obs.x + obs.width - 12, 0); ctx.lineTo(obs.x + obs.width - 12, obs.y);
        ctx.stroke();
        drawHint(ctx, '↓', obs.x + obs.width / 2, obs.y + obs.height - 15);
        break;
      case 'barrier_bot':
        ctx.fillStyle = baseColor;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillRect(obs.x, obs.y + obs.height, obs.width, groundY + 15 - obs.y - obs.height);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(obs.x, obs.y, obs.width, 4);
        ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2;
        for (let s = 0; s < 3; s++) {
          ctx.beginPath(); ctx.moveTo(obs.x + s * 16, obs.y + obs.height); ctx.lineTo(obs.x + s * 16 + 10, obs.y); ctx.stroke();
        }
        drawHint(ctx, '↑', obs.x + obs.width / 2, obs.y - 8);
        break;
      case 'pillar':
        ctx.fillStyle = baseColor;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillRect(obs.x, obs.y + obs.height, obs.width, groundY + 15 - obs.y - obs.height);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(obs.x, obs.y, obs.width, 4);
        drawHint(ctx, '↑', obs.x + obs.width / 2, obs.y - 8);
        break;
      case 'hovering': {
        const hover = Math.sin(state.worldTime * 4 + obs.x) * 4;
        ctx.fillStyle = flash ? '#ff4444' : '#8e44ad';
        ctx.fillRect(obs.x, obs.y + hover, obs.width, obs.height);
        ctx.fillStyle = 'rgba(142, 68, 173, 0.3)';
        ctx.fillRect(obs.x + 5, obs.y + hover + obs.height, obs.width - 10, 6);
        drawHint(ctx, '↓', obs.x + obs.width / 2, obs.y + hover + obs.height + 12);
        break;
      }
    }
  }
}

function drawHint(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}

function drawGate(ctx: CanvasRenderingContext2D, W: number, groundY: number, gs: string) {
  const gateX = W * 0.65;
  const gateW = 30;
  const gateTop = groundY - CONFIG.ZONE_HIGH_TOP - 20;
  const gateH = groundY + 15 - gateTop;

  const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 6);
  if (gs === 'GATE_APPROACHING') { ctx.shadowColor = '#e94560'; ctx.shadowBlur = 15 + pulse * 15; }
  else if (gs === 'GATE_RESOLVING') { ctx.shadowColor = '#27ae60'; ctx.shadowBlur = 20; }

  const color = gs === 'GATE_RESOLVING' ? '#27ae60' : '#e94560';
  ctx.fillStyle = color;
  ctx.fillRect(gateX, gateTop, 8, gateH);
  ctx.fillRect(gateX + gateW - 8, gateTop, 8, gateH);
  ctx.fillRect(gateX, gateTop, gateW, 8);

  const fa = gs === 'GATE_APPROACHING' ? 0.3 + pulse * 0.3 : 0.5;
  ctx.fillStyle = gs === 'GATE_RESOLVING' ? `rgba(39,174,96,${fa})` : `rgba(233,69,96,${fa})`;
  ctx.fillRect(gateX + 8, gateTop + 8, gateW - 16, gateH - 8);

  if (gs === 'GATE_APPROACHING') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('?', gateX + gateW / 2, gateTop + gateH / 2 + 6);
    ctx.textAlign = 'start';
  }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

function drawCharacter(ctx: CanvasRenderingContext2D) {
  const x = CONFIG.CHARACTER_X;
  const y = state.characterY;
  const isDucking = state.action === 'duck';
  const isJumping = state.action === 'jump';

  if (state.invincibleTime > 0 && Math.sin(state.worldTime * 30) > 0) ctx.globalAlpha = 0.35;

  ctx.save();
  ctx.translate(x + 4, y);
  ctx.rotate(state.tilt + (isJumping ? -0.15 : 0) + (state.fastFalling ? 0.25 : 0));
  if (isDucking) ctx.scale(1.3, CONFIG.DUCK_SQUISH);
  ctx.translate(-(x + 4), -y);

  // Flame
  const flameLen = 12 + Math.random() * 6
    + (state.speedMultiplier > 1.1 ? 10 : 0)
    + (isJumping ? 14 : 0)
    + (state.fastFalling ? -8 : 0);
  const fc1 = state.speedMultiplier > 1.1 ? '#00d2ff' : isJumping ? '#ff9f43' : '#ff6b35';
  const fc2 = state.speedMultiplier > 1.1 ? '#3498db' : '#ff6b35';

  ctx.fillStyle = fc2;
  ctx.beginPath(); ctx.moveTo(x - 8, y + 5);
  ctx.lineTo(x - 14 - Math.random() * 4, y + 12 + flameLen); ctx.lineTo(x - 2, y + 5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = fc1;
  ctx.beginPath(); ctx.moveTo(x - 7, y + 5);
  ctx.lineTo(x - 12 - Math.random() * 3, y + 8 + flameLen * 0.7); ctx.lineTo(x - 3, y + 5);
  ctx.closePath(); ctx.fill();

  // Jetpack
  ctx.fillStyle = '#555'; ctx.fillRect(x - 12, y - 8, 8, 18);
  // Body
  ctx.fillStyle = '#3498db'; ctx.fillRect(x - 6, y - 14, 22, isDucking ? 18 : 30);
  // Arm
  const armA = Math.sin(state.bobPhase * 1.5) * 0.2 + (isJumping ? -0.5 : 0);
  ctx.fillStyle = '#2980b9';
  ctx.save(); ctx.translate(x + 12, y); ctx.rotate(armA);
  ctx.fillRect(-3, -3, 12, 6); ctx.restore();
  // Head
  ctx.fillStyle = '#ecf0f1';
  ctx.beginPath(); ctx.arc(x + 5, y - 20, 10, 0, Math.PI * 2); ctx.fill();
  // Visor
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath(); ctx.arc(x + 8, y - 21, 5, -0.5, 0.8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(x + 6, y - 23, 2, 0, Math.PI * 2); ctx.fill();

  // Double jump indicator: ring around character
  if (isJumping && state.jumpsUsed === 2) {
    ctx.strokeStyle = 'rgba(162, 155, 254, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + 4, y - 5, 22, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const sz = p.size * a;
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx: CanvasRenderingContext2D) {
  for (const p of state.popups) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.textAlign = 'start';
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number) {
  const alpha = (intensity - 0.3) * 0.3;
  const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, 'transparent');
  g.addColorStop(1, `rgba(233, 69, 96, ${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function lerpColor(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const ca = p(a), cb = p(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
