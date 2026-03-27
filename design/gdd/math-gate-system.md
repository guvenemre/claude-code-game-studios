# Math Gate System

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Reasoning Over Recall

## Overview

The Math Gate System is the game's defining interaction. When the Runner Engine fires a gate event and the State Machine enters `GATE_ACTIVE`, this system renders a React overlay on top of the canvas showing the question prompt, the reasoning hint chain (from the Socratic Step Sequencer), answer buttons (3–4 MCQ options), and a countdown timer. The student clicks or taps an answer before the timer expires. On answer submission or timeout, the system records the result with the Socratic Step Sequencer (`recordGateResult`) and the Lives & Score System (`onGateResult`), then triggers the `GATE_RESOLVING` transition. The overlay is a React component absolutely positioned over the canvas; the canvas continues drawing the world at 30% scroll speed underneath, maintaining the runner's visual context. Math expressions in prompts and answers are rendered via KaTeX. The Math Gate System has no persistent state — it reads from the Sequencer and writes results to the Sequencer and Lives & Score on each gate event.

## Player Fantasy

The gate is a moment of focus, not a wall of dread. The world has slowed. The question fades in with the hint chain already visible — the student recognizes the reasoning they just saw building up. The answer buttons are big, clear, and tappable. The timer ticks but doesn't scream; it's a gentle arc that shrinks, not a flashing red countdown. When they tap the right answer, the gate shatters and the world rockets forward — instant, visceral, *earned*. When they miss, the stumble is brief and the reasoning is shown: "The answer was X because Y." The gate teaches even when the student fails. This is the "Reasoning Over Recall" pillar made interactive: every gate is the payoff of a Socratic chain, not a random quiz question.

## Detailed Design

### Core Rules

1. The Math Gate System is a React component (`<GateOverlay />`) that renders only when `gameState === GATE_ACTIVE` or `gameState === GATE_RESOLVING`. It is absolutely positioned over the canvas container, filling the same visual area. It has a semi-transparent backdrop (`GATE_BACKDROP_OPACITY = 0.6`) so the runner world is visible underneath.
2. On `GATE_ACTIVE` entry, the component:
   - Reads `currentGate` and `hintSteps` from `useSequencer()`
   - Starts the countdown timer at `GATE_TIMER_DURATION` (15s)
   - Renders the gate UI (see Gate UI Layout below)
3. The student interacts by clicking/tapping one of the answer buttons. Input is disabled after the first selection (no double-tap).
4. On answer selection:
   - Compare selected answer to `currentGate.correctAnswer`
   - Set `correct = (selected === correctAnswer)`
   - Calculate `timeSpentMs = performance.now() - gateActiveEntryTime`
   - Call `recordGateResult({ gateIndex, stepNumber, correct, timeSpentMs, timedOut: false })` on the Sequencer
   - Call `onGateResult(correct)` on Lives & Score
   - Call `transitionTo(GATE_RESOLVING)` on the State Machine
   - Show feedback flash: green highlight on correct answer / red highlight on selected + green highlight on correct answer
5. On timer expiry (student did not answer):
   - `correct = false`, `timedOut = true`
   - `timeSpentMs = GATE_TIMER_DURATION × 1000`
   - Same calls as step 4: `recordGateResult(...)`, `onGateResult(false)`, `transitionTo(GATE_RESOLVING)`
   - Show timeout feedback: correct answer highlighted in green with label "Time's up!"
6. During `GATE_RESOLVING` (1.2s), the overlay shows the **reasoning text** (`currentGate.reasoning`) below the question. Answer buttons are locked. This is the teaching moment — even on a correct answer, the reasoning is shown briefly to reinforce *why*.
7. After `GATE_RESOLVE_DURATION` elapses, the overlay fades out. The State Machine transitions to `RUNNING`, `WIN`, or `GAME_OVER` based on `allGatesComplete` and `shields > 0`.
8. The countdown timer is a visual arc (circular progress) that depletes clockwise over `GATE_TIMER_DURATION`. Timer pauses during `PAUSED` state (component checks `gameState` and suspends delta accumulation). Per State Machine GDD: remaining time after unpause = `Math.max(remainingTime, PAUSED_TIMER_MINIMUM)` (3s minimum).
9. The overlay handles both mouse click and touch events. Answer buttons have a minimum tap target of 48×48 logical pixels (accessibility).
10. KaTeX is used to render any LaTeX expressions in `prompt`, `options[]`, and `reasoning` fields. Non-LaTeX text renders as plain HTML.

### Gate UI Layout

Positioned within the 800×450 logical space:

```
┌──────────────────────────────────────────────────────┐
│  [Timer Arc]              Gate 1 of 1        [🛡🛡🛡] │  ← Top bar
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │  Hint Steps (if any):                         │     │
│  │  Step 1: "Find the common denominator..."  ✓  │     │  ← Hint chain
│  │  Step 2: "Convert both fractions..."       ✓  │     │    (scrollable if >3)
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │  QUESTION PROMPT (currentGate.prompt)          │     │  ← Main question
│  │  "What is 3/4 + 1/2?"                         │     │    (KaTeX rendered)
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  ┌─────────────┐  ┌─────────────┐                     │
│  │    5/4       │  │    1/2       │                     │  ← Answer buttons
│  └─────────────┘  └─────────────┘                     │    (2×2 grid for 4 opts
│  ┌─────────────┐  ┌─────────────┐                     │     1×3 row for 3 opts)
│  │    3/8       │  │    7/4       │                     │
│  └─────────────┘  └─────────────┘                     │
└──────────────────────────────────────────────────────┘
```

- **Timer arc**: top-left, circular, depletes clockwise. No numeric countdown (reduces anxiety). Color: blue → orange → red in last 3 seconds.
- **Gate counter**: "Gate 1 of 1" (MVP) or "Gate 2 of 4" (v1.1). Top-center.
- **Shields**: top-right, small shield icons matching `shields` from `useLivesScore()`.
- **Hint chain**: shown only if `hintSteps.length > 0`. Each step shows its `prompt` with a ✓ checkmark. Scrollable if more than 3 hints.
- **Question prompt**: center, largest font size. KaTeX-rendered.
- **Answer buttons**: bottom half, 2×2 grid (4 options) or 1×3 row (3 options). Each button shows option text (KaTeX-rendered). Min tap target 48×48 logical px.
- **Reasoning text** (shown during `GATE_RESOLVING`): appears below the question, replacing or pushing down the answer buttons. Shows `currentGate.reasoning`.

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **State Machine** | Reads `gameState` — overlay visible in `GATE_ACTIVE` and `GATE_RESOLVING` | Calls `transitionTo(GATE_RESOLVING)` on answer/timeout |
| **Socratic Step Sequencer** | Reads `currentGate`, `hintSteps`, `isLastGate`, `activeGateNumber`, `totalActiveGates` from `useSequencer()` | Calls `recordGateResult()` with gate outcome |
| **Lives & Score System** | Reads `shields` from `useLivesScore()` for shield display | Calls `onGateResult(correct)` on answer/timeout |
| **Runner Engine** | None — Runner Engine draws canvas underneath | None — overlay does not control scroll speed |
| **Responsive Canvas Layout** | Reads logical dimensions for overlay positioning and scale-aware sizing | None |

## Formulas

**Timer countdown:**
```
remainingTime    = GATE_TIMER_DURATION − elapsedActiveTime
timerArcFraction = remainingTime / GATE_TIMER_DURATION     // [1.0 → 0.0]
```
Timer pauses when `gameState === PAUSED`. On unpause: `remainingTime = Math.max(remainingTime, PAUSED_TIMER_MINIMUM)`.

**Timer color transition:**
```
if remainingTime > TIMER_WARNING_THRESHOLD (3s):  color = blue (#3B82F6)
if remainingTime ≤ TIMER_WARNING_THRESHOLD:        color = lerp(orange #F59E0B, red #EF4444, 1 − remainingTime / TIMER_WARNING_THRESHOLD)
```

**Time spent calculation:**
```
timeSpentMs = performance.now() − gateActiveEntryTime
```
Excludes paused time (entry time is adjusted on unpause so delta only counts active seconds).

No scoring formulas — scoring is owned by the Lives & Score System.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| Student clicks answer in the last 100ms before timer expiry | Answer takes priority. `timedOut = false`. Timer check sees answer already recorded and does not fire timeout. | Penalizing for a race condition would be unfair. |
| Double-click on answer button | First click registers and disables all buttons. Second click ignored. | Prevents double-scoring or double-shield-loss. |
| `currentGate.options` has 2 entries | Render as 1×2 row. Buttons stretch to fill width. | QDL allows 2–4 options. Layout adapts. |
| `currentGate.prompt` exceeds 600 characters | Truncated with "..." after 600 chars. Console warning logged. | Content Pipeline should prevent this, but UI must not overflow. |
| `currentGate.reasoning` is empty string | Skip reasoning display during `GATE_RESOLVING`. Show only correct answer highlight. | Resolve phase is still meaningful as feedback. |
| KaTeX rendering fails on malformed LaTeX | Fall back to plain text of raw string. Log warning with question ID. | Never crash the gate UI over a rendering failure. |
| `PAUSED` during `GATE_ACTIVE` (tab hidden) | Timer pauses. Overlay invisible (canvas hidden per Canvas Layout). On resume: `remainingTime = Math.max(remaining, 3s)`. | PAUSED_TIMER_MINIMUM = 3s ensures re-orientation time. |
| Correct answer on final gate | `allGatesComplete = true`, `shields > 0` → `WIN`. | Happy path for MVP. |
| Wrong answer on final gate with 1 shield | `shields = 0`, `isGameOver = true` → `GAME_OVER`. Takes priority over `allGatesComplete`. | State Machine: "WIN requires shields > 0". |

## Dependencies

| System | Direction | Nature of Dependency |
|---|---|---|
| **Runner Engine** | Math Gate depends on it (soft) | Runner Engine draws gate obstacle on canvas; Math Gate renders React overlay on top. No direct data exchange. |
| **Socratic Step Sequencer** | Math Gate depends on it | Reads `currentGate`, `hintSteps`, gate counter fields. Writes `recordGateResult()`. Hard dependency. |
| **Lives & Score System** | Math Gate depends on it | Reads `shields` for display. Writes `onGateResult(correct)`. Hard dependency. |
| **State Machine** | Bidirectional | Reads `gameState` for visibility/timer. Writes `transitionTo(GATE_RESOLVING)`. |
| **Responsive Canvas Layout** | Math Gate depends on it (soft) | Reads logical dimensions for overlay sizing and scale-aware CSS. |
| **Tutorial System** (v1.0) | Depends on Math Gate | Tutorial wraps the gate with no timer and extra explanation. Not present in MVP. |

## Tuning Knobs

All values exported from `GAME_CONFIG`. Gate timing constants from State Machine GDD listed for reference only.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `GATE_TIMER_DURATION` | 15s | 8–30s | Too much time; no urgency | Too little time to read and reason; anxiety spikes |
| `GATE_BACKDROP_OPACITY` | 0.6 | 0.3–0.9 | Canvas barely visible; loses runner context | Too transparent; text hard to read against moving background |
| `TIMER_WARNING_THRESHOLD` | 3s | 2–5s | Warning too early; entire timer feels urgent | Warning too late; student doesn't notice time running out |
| `GATE_RESOLVE_DURATION` | 1.2s | *(see State Machine GDD)* | — | — |
| `PAUSED_TIMER_MINIMUM` | 3s | *(see State Machine GDD)* | — | — |

## Acceptance Criteria

- [ ] `<GateOverlay />` renders when `gameState === GATE_ACTIVE` or `GATE_RESOLVING`; hidden in all other states
- [ ] Question prompt shows `currentGate.prompt` rendered with KaTeX
- [ ] Answer buttons show all entries from `currentGate.options`, each KaTeX-rendered
- [ ] Correct answer click: button highlights green, `onGateResult(true)` called, `recordGateResult` called with `correct: true`
- [ ] Wrong answer click: selected highlights red, correct highlights green, `onGateResult(false)` called, `recordGateResult` called with `correct: false`
- [ ] Timer expiry: correct answer highlighted, "Time's up!" shown, `onGateResult(false)` called with `timedOut: true`
- [ ] Timer arc depletes from full to empty over `GATE_TIMER_DURATION` (±200ms)
- [ ] Timer color: blue → orange → red in last `TIMER_WARNING_THRESHOLD` seconds
- [ ] During `GATE_RESOLVING`: reasoning text visible below question for `GATE_RESOLVE_DURATION`
- [ ] Answer buttons disabled after first click — no double-tap
- [ ] All answer buttons ≥ 48×48 logical pixel tap target
- [ ] Tab hidden during `GATE_ACTIVE`: timer pauses. Restored: resumes with `Math.max(remaining, PAUSED_TIMER_MINIMUM)`
- [ ] KaTeX failure falls back to plain text — no crash
- [ ] Hint steps displayed when `hintSteps.length > 0`; hidden when empty
- [ ] Answer click in last 100ms before timeout: answer wins, not timeout

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should the reasoning text be shown on correct answers too, or only on wrong/timeout? | Emre / Game Designer | Show on all outcomes for MVP. The 1.2s reasoning flash reinforces *why* even when the student got it right. If playtesting shows it slows the flow, make it configurable (`SHOW_REASONING_ON_CORRECT = true`). |
| Should answer button order be re-shuffled on each gate render, or preserved from the QDL `options[]` order? | Dev | Preserve QDL order for MVP — the QDL already shuffles on fetch. Re-shuffling on render would change button positions if the student pauses and resumes. |
| For v1.1 multi-gate: should the hint chain grow after each gate (showing completed steps in green)? | Emre / UX Designer | Yes conceptually, but this is a rendering concern for the v1.1 Gate UI update. The Sequencer already stores `gateResults[]` for this purpose. |
