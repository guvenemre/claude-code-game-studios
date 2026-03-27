# Socratic Step Sequencer

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Reasoning Over Recall

## Overview

The Socratic Step Sequencer is a stateful cursor over a run's `GameQuestion`. It receives the `GameQuestion` (with its pre-built `gates[]` array) when the game enters `READY`, and from that point it is the single source of truth for which gate is currently active, which inactive steps precede it as hint context, and what results the student has achieved so far. Each time a gate resolves, the sequencer advances its cursor to the next active gate. It exposes a `useSequencer()` hook that the Math Gate System reads to render the current question and hint chain. It accumulates per-gate results (correct/wrong, time spent) that the Outcome Tracking Bridge reads on run completion. The sequencer is stateless between runs — it is initialized fresh from a new `GameQuestion` on every `LOADING` entry. It has no rendering responsibilities; it is pure state management.

## Player Fantasy

Infrastructure the student never thinks about — but deeply feels. What they experience is a question that *builds*: before the final answer button appears, they can see the reasoning steps that led there, laid out like a trail of breadcrumbs. They're not guessing randomly at a cold MCQ. They've been walked through the problem's logic. The sequencer is what makes the gate feel like the culmination of a Socratic conversation rather than a pop quiz. It serves the "Reasoning Over Recall" pillar directly: each inactive step in the hint chain is evidence that the student was *with* the problem before they had to answer it.

## Detailed Design

### Core Rules

1. The Socratic Step Sequencer is a React context provider exposing `useSequencer()`. It holds no canvas rendering logic — it is pure state.
2. The sequencer is initialized by calling `initSequencer(gameQuestion: GameQuestion)` during the `LOADING` → `READY` transition. This resets all internal state.
3. On initialization, the sequencer partitions `gameQuestion.gates[]` into two lists:
   - `activeGates`: all entries where `isActive === true`, preserving original order
   - `hintSteps`: all entries where `isActive === false`, preserving original order
4. A cursor `activeGateIndex` starts at `0`. The current gate is `activeGates[activeGateIndex]`.
5. The `useSequencer()` hook exposes:
   ```typescript
   interface SequencerState {
     question: GameQuestion;         // full question for context
     currentGate: GameGate;          // the active gate to answer NOW
     hintSteps: GameGate[];          // all inactive steps (reasoning breadcrumbs)
     activeGateNumber: number;       // 1-based: "Gate 1 of 1" in MVP
     totalActiveGates: number;       // count of isActive gates
     isLastGate: boolean;            // true when currentGate.isFinalGate
     gateResults: GateResult[];      // per-gate outcomes accumulated this run
   }
   ```
6. When `GATE_ACTIVE` is entered, the Math Gate System reads `currentGate` to render the question overlay and `hintSteps` to render the reasoning breadcrumb chain.
7. When a gate resolves, the Math Gate System calls `recordGateResult(result: GateResult)`:
   ```typescript
   interface GateResult {
     gateIndex: number;       // from GameGate.gateIndex
     stepNumber: number;      // from GameGate.stepNumber
     correct: boolean;        // true = correct, false = wrong or timeout
     timeSpentMs: number;     // ms from GATE_ACTIVE entry to answer/timeout
     timedOut: boolean;       // true if GATE_TIMER expired without answer
   }
   ```
   This appends to `gateResults[]` and advances `activeGateIndex++`.
8. After `recordGateResult`, if `activeGateIndex >= activeGates.length`, all gates are exhausted. The sequencer sets `allGatesComplete = true`. The State Machine reads this to determine WIN vs. RUNNING after `GATE_RESOLVING`.
9. In **MVP** (Option A — final gate only): `activeGates` has exactly 1 entry; `hintSteps` has 0 to n−1 entries. One gate event → one `recordGateResult` → `allGatesComplete = true`.
10. In **v1.1** (Option B — multi-gate): `activeGates` has 1+ entries. Each Runner Engine gate interval triggers one gate event, which maps to `activeGates[activeGateIndex]`. The sequencer does not control gate timing — the Runner Engine does.
11. The sequencer is read-only to all consumers. Only `initSequencer()` and `recordGateResult()` mutate state.

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **Question Data Layer** | `GameQuestion` provided via `initSequencer()` during `LOADING` | None — QDL is fire-and-forget after providing the question |
| **Math Gate System** | None | Reads `currentGate`, `hintSteps`, `isLastGate` from `useSequencer()` on `GATE_ACTIVE` entry. Calls `recordGateResult()` on answer/timeout. |
| **State Machine** | Reads `gameState` to know when `LOADING` completes (trigger `initSequencer`) | Exposes `allGatesComplete` — State Machine reads this in `GATE_RESOLVING` to decide WIN vs. continue to `RUNNING` |
| **Outcome Tracking Bridge** | None | Reads `gateResults[]` and `question.id`, `question.standardId` on `SCORE_CARD` entry to report per-step accuracy |
| **Runner Engine** | None | None — gate timing is owned by Runner Engine; sequencer only tracks which gate is current |

## Formulas

This system contains no mathematical formulas. It is a stateful cursor — it partitions, iterates, and records. No scaling, no interpolation, no computed values.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| `GameQuestion.gates[]` has zero active gates (all `isActive: false`) | `initSequencer` throws `SequencerError("No active gates in question")`. State Machine routes to `SCORE_CARD` with error. | A run with zero answerable gates is meaningless. Content Pipeline should prevent this, but the sequencer must not silently proceed. |
| `GameQuestion.gates[]` has exactly 1 entry, and it is active | `activeGates = [gate]`, `hintSteps = []`. Single gate, no hints. Valid run. | A 1-step question with no reasoning chain is unusual but valid. |
| `recordGateResult` called when `activeGateIndex` is already past end of `activeGates` | Ignore the call. Log a console warning. Do not advance past array bounds. | Defensive against double-call bugs in the Math Gate System. |
| `recordGateResult` called with `correct: true` on a non-final gate (v1.1) | Result recorded. `activeGateIndex++`. `allGatesComplete` remains `false`. Run continues. | Correct on an intermediate gate is normal v1.1 behavior — only the final gate triggers WIN check. |
| `initSequencer` called while a run is already in progress | Resets all state. Previous `gateResults` are discarded. `activeGateIndex` back to 0. | The sequencer is stateless between runs. Re-initialization must be clean. |
| `PAUSED` state during `GATE_ACTIVE` | Sequencer state frozen — no mutation. `currentGate` remains the same gate. `timeSpentMs` tracking is owned by the Math Gate System (which pauses its timer). | Sequencer has no timer of its own. It does not know about `PAUSED`. |

## Dependencies

| System | Direction | Nature of Dependency |
|---|---|---|
| **Question Data Layer** | Sequencer depends on it | Receives `GameQuestion` on `initSequencer()`. Hard dependency — no question = no run. |
| **Math Gate System** | Depends on this | Reads `currentGate` and `hintSteps` to render gate UI. Calls `recordGateResult()`. Hard dependency. |
| **State Machine** | Bidirectional read-only | Sequencer reads `gameState` to know when to initialize. State Machine reads `allGatesComplete` to decide WIN vs. continue after `GATE_RESOLVING`. Neither calls the other's mutation methods. |
| **Outcome Tracking Bridge** | Depends on this (soft, v1.0) | Reads `gateResults[]` on `SCORE_CARD` entry. Not present in MVP — sequencer still accumulates results for when the bridge is added. |

## Tuning Knobs

This system has no tuning knobs. It is a deterministic cursor — behavior is fully determined by the `GameQuestion` data and the sequence of `recordGateResult` calls. Gate timing is owned by the Runner Engine. Gate count and active/inactive partition are owned by the Question Data Layer.

## Acceptance Criteria

- [ ] `initSequencer(gameQuestion)` partitions `gates[]` correctly: `activeGates` contains only `isActive: true` entries; `hintSteps` contains only `isActive: false` entries
- [ ] After `initSequencer`, `activeGateIndex === 0` and `allGatesComplete === false`
- [ ] `useSequencer().currentGate` returns the correct `activeGates[0]` on first read
- [ ] `recordGateResult()` advances `activeGateIndex` by 1 and appends to `gateResults[]`
- [ ] After recording the final active gate result, `allGatesComplete === true`
- [ ] In MVP (1 active gate): single `recordGateResult` call sets `allGatesComplete = true`
- [ ] `gateResults[]` contains all recorded results with correct `gateIndex`, `stepNumber`, `correct`, `timeSpentMs`, and `timedOut` values
- [ ] `initSequencer` with `gates[]` having zero active entries throws `SequencerError`
- [ ] Calling `recordGateResult` after all gates are complete does not crash — call is ignored with a warning
- [ ] `initSequencer` called during a run resets all state cleanly — previous `gateResults` discarded, `activeGateIndex` back to 0
- [ ] `useSequencer().hintSteps` returns the inactive gates in their original order from `gates[]`

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| In v1.1 multi-gate, should the hint chain grow as gates are answered? (e.g., after answering gate 1 correctly, its step moves from active to "completed hint" and is shown as green breadcrumb for gate 2) | Emre / Game Designer | Defer to v1.1 design. The sequencer already stores `gateResults[]` so the UI layer can render completed steps distinctly. No sequencer change needed — it's a rendering concern. |
