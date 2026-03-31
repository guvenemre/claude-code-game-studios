# Score Card & Win State

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Reasoning Over Recall

## Overview

The Score Card is the end-of-run screen. It renders as a full-screen React component (replacing the canvas) when the State Machine enters `SCORE_CARD`. It shows the run outcome (WIN or GAME OVER), final score, accuracy (correct/total gates), shields remaining, and the best streak achieved during the run. On a WIN, a confetti animation plays via `canvas-confetti` (already in the platform's `package.json`). The screen has two CTAs: "Play Again" (restart the same standard + tier) and "Change Topic" (return to the Standard Selector). The Score Card reads from the Lives & Score System and the Socratic Step Sequencer — it writes nothing. It has no state of its own beyond what it reads from upstream hooks.

## Player Fantasy

The score card is a mirror, not a judge. On a WIN, the screen celebrates: confetti bursts, the score pulses in, and the student sees their accuracy front and center. It says "you reasoned through this." On a GAME OVER, the tone is warm, not punishing: "Great effort — you got X out of Y right. Try again?" The retry button is the largest element on the screen — the path back is always one tap away. The student never feels stuck or shamed. The "One Click to Play" pillar means the retry loop is instant: tap → LOADING → READY → RUNNING in under 2 seconds.

## Detailed Design

### Core Rules

1. The Score Card is a React component (`<ScoreCard />`) that renders only when `gameState === SCORE_CARD`. It replaces the canvas — the canvas is unmounted or hidden (`display: none`) while the Score Card is visible.
2. On `SCORE_CARD` entry, the component reads all data in a single render pass:
   - From `useLivesScore()`: `score`, `shields`, `streak`
   - From `useSequencer()`: `gateResults[]`, `totalActiveGates`, `question` (for standard/topic label)
   - From `useGameState()`: `previousState` — either `WIN` or `GAME_OVER` (determines outcome display)
3. **Derived stats** computed on mount (not stored elsewhere):
   - `outcome = previousState === 'WIN' ? 'WIN' : 'GAME_OVER'`
   - `correctCount = gateResults.filter(r => r.correct).length`
   - `accuracy = totalActiveGates > 0 ? Math.round((correctCount / totalActiveGates) * 100) : 0`
   - `bestStreak` — longest run of consecutive correct answers, computed by scanning `gateResults[]`
4. **WIN path**: Confetti fires via `canvas-confetti` on mount. Config: `{ particleCount: 150, spread: 70, origin: { y: 0.6 } }`. Heading: "You did it!" Score pulses in with a CSS scale animation.
5. **GAME OVER path**: No confetti. Heading: "Great effort!" (warm, not punishing). Sub-heading: "You got X out of Y right."
6. **Stats display** (both paths):
   - **Score**: final score from `useLivesScore()`, displayed large
   - **Accuracy**: `X / Y correct (Z%)` — e.g., "3 / 4 correct (75%)"
   - **Shields remaining**: shield icons (filled for remaining, empty outlines for lost)
   - **Best streak**: `bestStreak` value with a fire label if bestStreak >= 3 (visual flair only)
7. **CTAs** (both paths):
   - **"Play Again"** — primary button, largest on screen. Calls `transitionTo(LOADING)` with the same `standardId` and `tier`. Triggers a full re-fetch and new run.
   - **"Change Topic"** — secondary link/button. Navigates to the Standard Selector route via React Router (not a state machine transition).
8. The Score Card has no internal state beyond what it derives on mount. It writes nothing to any system. It is a pure read-only display.
9. Keyboard-accessible: "Play Again" is auto-focused on mount. Enter/Space activates. Tab navigates between CTAs.
10. On MVP (1 active gate per run): accuracy is always 0% or 100%, bestStreak is 0 or 1, score is 0 or 100. The layout must still look good at these extremes.

### Score Card Layout

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              You did it!                             │  ← "Great effort!" on GAME OVER
│                                                      │
│              ┌────────────────┐                      │
│              │     1,200      │                      │  ← Score (large, bold)
│              │     points     │                      │
│              └────────────────┘                      │
│                                                      │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│    │ Accuracy │  │ Shields  │  │  Streak  │        │  ← Stat cards
│    │   75%    │  │  🛡🛡◇  │  │   3      │        │
│    │ 3/4 right│  │  2 left  │  │  best    │        │
│    └──────────┘  └──────────┘  └──────────┘        │
│                                                      │
│         ┌──────────────────────────┐                │
│         │       PLAY AGAIN         │                │  ← Primary CTA
│         └──────────────────────────┘                │
│                                                      │
│              Change Topic                            │  ← Secondary link
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **State Machine** | Reads `gameState` — visible only in `SCORE_CARD`. Reads `previousState` to determine WIN vs GAME OVER outcome. | Calls `transitionTo(LOADING)` on "Play Again" tap. |
| **Lives & Score System** | Reads `score`, `shields`, `streak` from `useLivesScore()`. | None — Score Card is read-only. |
| **Socratic Step Sequencer** | Reads `gateResults[]`, `totalActiveGates`, `question` from `useSequencer()`. | None — Score Card is read-only. |
| **Standard Selector & Game Route** | None. | "Change Topic" navigates to Standard Selector route via React Router. |
| **Outcome Tracking Bridge** (v1.0) | None — not the Score Card's responsibility. | None — the Bridge fires its own API call on `SCORE_CARD` state entry independently. |
| **canvas-confetti** | None. | On WIN: fires confetti on mount. Library call only — no game system interaction. |

## Formulas

### Accuracy Percentage

```
accuracy = round((correctCount / totalActiveGates) * 100)
```

| Variable | Source | Range |
|---|---|---|
| `correctCount` | `gateResults.filter(r => r.correct).length` | 0 – `totalActiveGates` |
| `totalActiveGates` | `useSequencer().totalActiveGates` | 1–5 (MVP: 1) |
| `accuracy` | Derived | 0–100 (integer) |

**Example**: 3 correct out of 4 gates → `round((3/4) × 100)` = **75%**

### Best Streak

```
bestStreak = max consecutive run of gateResults[i].correct === true
```

Computed by linear scan of `gateResults[]`. Reset counter on each `correct === false`. Track max.

| Variable | Range |
|---|---|
| `bestStreak` | 0 – `totalActiveGates` |

**Example**: results = [✓, ✓, ✗, ✓] → streaks are [2, 1] → bestStreak = **2**

### Score Display

No formula — `score` is read directly from `useLivesScore()`. Computed by the Lives & Score System using `floor(BASE_GATE_SCORE × streakMultiplier)` per gate. The Score Card displays it as-is with thousands separator formatting (e.g., `1,200`).

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| `totalActiveGates === 0` (fetch error path — no gates were played) | Display accuracy as "—" instead of "0%". Score shows 0. Hide streak and shields stats. Show "Try Again" as sole CTA. | Division by zero guard. The student didn't play — showing "0%" is misleading. |
| All gates correct (100% accuracy, bestStreak === totalActiveGates) | WIN path. All stat cards show max values. No special treatment needed — layout handles this naturally. | Common happy path; verify it looks good in QA. |
| All gates wrong (0% accuracy, bestStreak === 0) | GAME OVER path. Accuracy shows "0 / N correct (0%)". Streak card shows "0". Tone remains warm — heading still says "Great effort!" | Never shame the student. The warm tone is most important when performance is lowest. |
| Student taps "Play Again" rapidly multiple times | Only the first tap triggers `transitionTo(LOADING)`. Subsequent taps are no-ops (button disables on first click). | Prevents double-fetch or race conditions in the Question Data Layer. |
| `canvas-confetti` library fails to load or throws | Catch error silently. Score Card renders normally without confetti. No error shown to student. | Confetti is decorative — its failure must never block the core experience. |
| Score exceeds 9,999 (5 gates, all correct with max streak) | Thousands separator formatting handles any score. Max theoretical: 100 + 200 + 300 + 400 + 500 = 1,500 in MVP. Layout tested up to 99,999. | Future-proofing for v1.0 with more gates or bonus scoring. |
| `previousState` is neither `WIN` nor `GAME_OVER` (defensive) | Default to GAME OVER display path. Log warning to console. | Should never happen with valid state machine, but defensive fallback avoids a broken screen. |
| Browser back button pressed while on Score Card | Standard React Router behavior — navigates away from the game route. No special handling in MVP. | The Score Card is not a modal; it's a route-level component. Browser navigation works normally. |

## Dependencies

The Score Card sits at the top of the dependency chain — it depends on nearly everything but nothing depends on it.

| System | Direction | Nature of Dependency |
|---|---|---|
| **Game State Machine** | Score Card depends on | Reads `gameState` and `previousState`. Calls `transitionTo(LOADING)` for replay. |
| **Lives & Score System** | Score Card depends on | Reads `score`, `shields`, `streak` via `useLivesScore()`. |
| **Socratic Step Sequencer** | Score Card depends on | Reads `gateResults[]`, `totalActiveGates`, `question` via `useSequencer()`. |
| **Standard Selector & Game Route** | Score Card depends on | "Change Topic" navigates to the selector route. Score Card must know the route path. |
| **canvas-confetti** | Score Card depends on | External library. Used for WIN confetti. Failure is non-blocking (edge case handled). |
| **Outcome Tracking Bridge** (v1.0) | Independent | The Bridge listens to `SCORE_CARD` state entry on its own. No direct coupling with the Score Card component. |

**No system depends on the Score Card.** It is a leaf node — pure consumer, zero producers.

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `CONFETTI_PARTICLE_COUNT` | 150 | 50–300 | Performance hit on low-end devices; overwhelming visually | Celebration feels underwhelming; confetti barely visible |
| `CONFETTI_SPREAD` | 70 | 40–120 | Confetti too diffuse; loses focal impact | Confetti in a narrow column; feels cheap |
| `CONFETTI_ORIGIN_Y` | 0.6 | 0.3–0.8 | Confetti starts too low; obscured by stats | Confetti starts above viewport; particles fall before being seen |
| `SCORE_ANIMATE_DURATION` | 0.6s | 0.3–1.2s | Score count-up too slow; student waits | Score appears instantly; no celebration beat |
| `PLAY_AGAIN_AUTOFOCUS_DELAY` | 100ms | 0–300ms | Perceptible delay before keyboard interaction works | Focus fires before DOM fully painted on slower devices |

All values in `GAME_CONFIG`. No hardcoded constants in the component.

## Acceptance Criteria

- [ ] Score Card renders when `gameState === SCORE_CARD` and is hidden in all other states
- [ ] WIN outcome shows "You did it!" heading with confetti; GAME OVER shows "Great effort!" with no confetti
- [ ] Score displays with thousands separator formatting (e.g., `1,200`)
- [ ] Accuracy shows `X / Y correct (Z%)` with correct values derived from `gateResults[]`
- [ ] Best streak is correctly computed as the longest consecutive correct run in `gateResults[]`
- [ ] Shield icons show filled for remaining, empty outlines for lost
- [ ] "Play Again" calls `transitionTo(LOADING)` with the same `standardId` and `tier`
- [ ] "Change Topic" navigates to the Standard Selector route
- [ ] "Play Again" is auto-focused on mount — pressing Enter without clicking works
- [ ] Rapid taps on "Play Again" trigger only one `transitionTo` call
- [ ] `canvas-confetti` failure does not break the Score Card render
- [ ] Layout renders correctly at MVP extremes: 0% accuracy (0/1) and 100% accuracy (1/1)
- [ ] All timing/count constants read from `GAME_CONFIG` — zero hardcoded values
- [ ] Component is keyboard-navigable: Tab cycles between "Play Again" and "Change Topic"

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should the Score Card show a per-gate breakdown (step text + correct/wrong indicator for each gate)? | Emre | Defer to v1.0. MVP has 1 gate — breakdown is meaningless. Add when `totalActiveGates > 1`. |
| Should "Play Again" re-use the cached question or always re-fetch? | Dev | Always re-fetch. The student just played this question — showing the same one defeats the purpose. The Question Data Layer should exclude the just-played `questionId` from the next fetch. |
| Personal best tracking — show "New best!" on Score Card? | Emre | Defer to v1.0. Requires localStorage persistence for per-standard high scores. Not needed for MVP validation. |
