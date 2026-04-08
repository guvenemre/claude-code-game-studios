// Minimal state machine for prototype — no React context, just a module-level state

export type GameState =
  | 'READY'
  | 'RUNNING'
  | 'GATE_APPROACHING'
  | 'GATE_ACTIVE'
  | 'GATE_RESOLVING'
  | 'PAUSED';

const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  READY: ['RUNNING'],
  RUNNING: ['GATE_APPROACHING', 'PAUSED'],
  GATE_APPROACHING: ['GATE_ACTIVE', 'PAUSED'],
  GATE_ACTIVE: ['GATE_RESOLVING', 'PAUSED'],
  GATE_RESOLVING: ['RUNNING'],
  PAUSED: ['RUNNING', 'GATE_APPROACHING', 'GATE_ACTIVE', 'GATE_RESOLVING'],
};

let currentState: GameState = 'READY';
let previousState: GameState = 'READY';
const listeners: Array<(from: GameState, to: GameState) => void> = [];

export function getState(): GameState {
  return currentState;
}

export function getPreviousState(): GameState {
  return previousState;
}

export function transitionTo(newState: GameState): boolean {
  if (!VALID_TRANSITIONS[currentState]?.includes(newState)) {
    console.warn(`Invalid transition: ${currentState} → ${newState}`);
    return false;
  }
  previousState = currentState;
  currentState = newState;
  listeners.forEach((fn) => fn(previousState, currentState));
  return true;
}

export function onStateChange(fn: (from: GameState, to: GameState) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function resetState() {
  currentState = 'READY';
  previousState = 'READY';
}
