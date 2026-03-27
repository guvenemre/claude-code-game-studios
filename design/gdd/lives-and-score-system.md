# Lives & Score System

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Urgency Without Anxiety

## Overview

The Lives & Score System tracks the student's run health (shields) and cumulative score. It starts each run with 3 shields. A wrong answer or timeout at a gate costs 1 shield; reaching 0 shields triggers `GAME_OVER`. A correct answer adds points to the score with a streak multiplier that increases on consecutive correct answers and resets on a miss. The system exposes `useLivesScore()` — a React context hook that returns current shields, score, streak count, and streak multiplier. It has no rendering responsibilities; the HUD and Score Card read from this hook. The system is stateless between runs — it resets on every `READY` entry.

## Player Fantasy

Three shields feel like a safety net, not a countdown to failure. The student knows they can make a mistake and recover — that's what "Urgency Without Anxiety" means. The streak multiplier turns a good run into a dopamine loop: "I've got 3x right now, I don't want to lose it." When a shield breaks, it stings just enough to sharpen focus without triggering shutdown. When the streak counter climbs to 3x, 4x, 5x, the student feels *smart* — they've earned that multiplier through consecutive correct reasoning, not luck. Score exists to make each run comparable: "I got 1200 last time, can I beat it?" It's personal progress without leaderboard pressure.

## Detailed Design

### Core Rules

1. The Lives & Score System is a React context provider exposing `useLivesScore()`. Pure state — no rendering, no canvas drawing.
2. On run start (`READY` entry), the system resets:
   - `shields = STARTING_SHIELDS` (3)
   - `score = 0`
   - `streak = 0`
   - `streakMultiplier = 1`
3. The Math Gate System calls `onGateResult(correct: boolean)` when a gate resolves:
   - **Correct answer**: `score += BASE_GATE_SCORE × streakMultiplier`. `streak++`. `streakMultiplier = Math.min(streak + 1, MAX_STREAK_MULTIPLIER)`.
   - **Wrong answer or timeout**: `shields--`. `streak = 0`. `streakMultiplier = 1`. Score unchanged.
4. After `onGateResult`, if `shields <= 0`, the system sets `isGameOver = true`. The State Machine reads this to decide `GATE_RESOLVING` → `GAME_OVER`.
5. After `onGateResult`, if `shields > 0` and the Socratic Step Sequencer reports `allGatesComplete`, the State Machine reads this to decide `GATE_RESOLVING` → `WIN`.
6. The `useLivesScore()` hook exposes:
   ```typescript
   interface LivesScoreState {
     shields: number;            // current shields remaining (0 to STARTING_SHIELDS)
     score: number;              // cumulative points this run
     streak: number;             // consecutive correct answers (0+)
     streakMultiplier: number;   // current multiplier (1 to MAX_STREAK_MULTIPLIER)
     isGameOver: boolean;        // true when shields reach 0
   }
   ```
7. The system is read-only to all consumers except the Math Gate System (which calls `onGateResult`). The HUD reads `shields`, `score`, and `streakMultiplier` to render the display.
8. Score is an integer. No fractional points. `BASE_GATE_SCORE × streakMultiplier` is floored to the nearest integer.

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **State Machine** | System reads `gameState` to know when to reset (`READY` entry) | Exposes `isGameOver` — State Machine reads this in `GATE_RESOLVING` to decide next state |
| **Math Gate System** | None | Calls `onGateResult(correct)` when a gate resolves. This is the only write interface. |
| **Socratic Step Sequencer** | None — no direct interaction | None — WIN condition is checked by State Machine combining `allGatesComplete` (from Sequencer) and `shields > 0` (from this system) |
| **Score Card & Win State** | None | Reads `score`, `shields`, `streak`, `streakMultiplier` to render end-of-run screen |
| **Outcome Tracking Bridge** (v1.0) | None | Reads `score` and `shields` remaining on `SCORE_CARD` entry |
| **Runner Engine** | None | No direct interaction — speed boost is Runner Engine's responsibility |

## Formulas

**Score per gate (correct answer):**
```
pointsEarned = floor(BASE_GATE_SCORE × streakMultiplier)
score        = score + pointsEarned
```
Variables: `BASE_GATE_SCORE = 100`, `streakMultiplier` (1 to `MAX_STREAK_MULTIPLIER`)

**Streak multiplier** (updated AFTER score is added):
```
On correct:  score += BASE_GATE_SCORE × streakMultiplier   // use current multiplier
             streak++
             streakMultiplier = min(streak + 1, MAX_STREAK_MULTIPLIER)

On wrong:    streak = 0
             streakMultiplier = 1
```
With `MAX_STREAK_MULTIPLIER = 5`:

| Gate # (consecutive correct) | Multiplier used | Points earned | Multiplier after |
|---|---|---|---|
| 1st correct | 1x | 100 | 2x |
| 2nd correct | 2x | 200 | 3x |
| 3rd correct | 3x | 300 | 4x |
| 4th correct | 4x | 400 | 5x |
| 5th+ correct | 5x (capped) | 500 | 5x |

Note: In MVP (1 active gate per run), the single gate always earns 100 pts at 1x. Streak growth is visible in v1.1 multi-gate runs.

**Shields:**
```
On wrong/timeout:  shields = shields − 1
On correct:        shields unchanged (no shield recovery)
```
Range: `[0, STARTING_SHIELDS]`. No shield recovery in MVP — shields only decrease.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| Student gets all gates correct (perfect run) | Score accumulates with growing multiplier. Shields remain at `STARTING_SHIELDS`. `WIN` state entered. | Happy path — must work. |
| Student fails 3 gates in a row (MVP: only 1 gate) | Shield breaks on each wrong. After 3rd miss, `shields = 0`, `isGameOver = true`. | `GAME_OVER` triggers cleanly. |
| `onGateResult(false)` called when `shields` is already 0 | Ignore — `shields` stays at 0, `isGameOver` stays `true`. No underflow to negative. | Defensive against double-call. |
| `onGateResult(true)` called when `shields` is 0 | Ignore — `isGameOver` is already `true`. Score not updated. | Once game over, no more scoring. |
| Streak at `MAX_STREAK_MULTIPLIER` and student answers correctly again | `streak` increments but `streakMultiplier` stays capped at `MAX_STREAK_MULTIPLIER`. | `Math.min` cap prevents unbounded multiplier growth. |
| Very long v1.1 run (20+ gates, all correct) | Score = `100 + 200 + 300 + 400 + 500×16 = 9000`. Well within integer range. | No overflow risk — JavaScript `Number` handles this trivially. |
| `STARTING_SHIELDS` set to 0 in config (misconfiguration) | `isGameOver` immediately `true` on `READY` entry. Log console warning: `"STARTING_SHIELDS must be > 0"`. | Prevents silent misconfiguration. |

## Dependencies

| System | Direction | Nature of Dependency |
|---|---|---|
| **State Machine** | Bidirectional read-only | This system reads `gameState` for reset timing. State Machine reads `isGameOver` to route `GATE_RESOLVING` → `GAME_OVER`. |
| **Math Gate System** | Depends on this | Calls `onGateResult(correct)`. Hard dependency — Math Gate System is the only writer. |
| **Score Card & Win State** | Depends on this | Reads `score`, `shields`, `streak` on `SCORE_CARD` entry. |
| **Outcome Tracking Bridge** (v1.0) | Depends on this (soft) | Reads `score` and `shields` remaining for analytics. Not present in MVP. |
| **Cosmetic Skin System** (v1.0) | Depends on this (soft) | May read cumulative score across runs to unlock cosmetics. Not present in MVP. |

## Tuning Knobs

All values exported from `GAME_CONFIG`.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `STARTING_SHIELDS` | 3 | 1–5 | Too forgiving; no stakes — students learn mistakes don't matter | Too punishing; grade 3 students shut down after 1 wrong answer |
| `BASE_GATE_SCORE` | 100 | 50–500 | Large numbers look impressive but make scores hard to compare across runs | Scores too small; doesn't feel rewarding |
| `MAX_STREAK_MULTIPLIER` | 5 | 2–10 | Runaway scores for perfect runs; score gap between perfect and imperfect becomes extreme | Streak barely matters; no incentive to maintain it |

## Acceptance Criteria

- [ ] On `READY` entry: `shields === STARTING_SHIELDS`, `score === 0`, `streak === 0`, `streakMultiplier === 1`
- [ ] `onGateResult(true)`: score increases by `BASE_GATE_SCORE × streakMultiplier`, streak increments, multiplier updates
- [ ] `onGateResult(false)`: shields decrements by 1, streak resets to 0, multiplier resets to 1, score unchanged
- [ ] `shields` never goes below 0 — floor check after decrement
- [ ] `streakMultiplier` never exceeds `MAX_STREAK_MULTIPLIER` — confirmed with 10 consecutive correct calls
- [ ] `isGameOver === true` when `shields` reaches 0 after `onGateResult(false)`
- [ ] `isGameOver` is read by State Machine and triggers `GAME_OVER` transition
- [ ] Score is an integer after every `onGateResult` call (no floating-point artifacts)
- [ ] `useLivesScore()` returns all 5 fields with correct types
- [ ] System resets cleanly on second run — no state leaks from the previous run
- [ ] All constants (`STARTING_SHIELDS`, `BASE_GATE_SCORE`, `MAX_STREAK_MULTIPLIER`) read from `GAME_CONFIG`

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should shields regenerate on correct answers in v1.1 (e.g., earn back 1 shield after 3 consecutive correct)? | Game Designer / Emre | Defer to playtesting. MVP = no recovery. If students find 3 shields too punishing on long multi-gate runs, add recovery as a v1.1 tuning knob (`SHIELDS_RECOVERY_STREAK = 3`). |
| Should score persist across runs (cumulative career score) or reset each run? | Emre | Reset each run for MVP. Cumulative career score is a Cosmetic Skin System concern (v1.0) — it reads from Outcome Tracking Bridge, not from this system. |
