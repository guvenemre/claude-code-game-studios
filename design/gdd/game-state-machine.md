# Game State Machine

> **Status**: Designed — Pending Review
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Urgency Without Anxiety

## Overview

The Game State Machine is the central coordinator of a JetRun session. It defines the 10 states a run can occupy — from initial content loading through running, gate questioning, and end-of-run resolution — and the exact conditions that trigger every transition. No game system acts on its own initiative; each system reads the current state and responds accordingly. The machine is implemented as a simple enum + transition function in React context, making the current state globally readable without prop drilling. The student never interacts with the state machine directly, but every visible behavior — when the world slows, when the question appears, when confetti fires — is driven by a state change event.

## Player Fantasy

The student never thinks about the state machine — that's the goal. What they feel is a game that *responds instantly* and *never gets stuck*. The gate appears exactly when expected, the question is readable before they have to answer, the stumble animation plays and immediately resolves, and "Play Again" is always one tap away. The state machine serves the "Urgency Without Anxiety" pillar by ensuring that every tense moment (gate approaching, timer counting) has a clean exit — either a satisfying smash-through or a quick, funny stumble with instant recovery. A well-designed state machine is invisible; a broken one makes the game feel unpolished regardless of how good the art is.

## Detailed Design

### Core Rules

1. The game has exactly **10 states**: `LOADING`, `READY`, `RUNNING`, `GATE_APPROACHING`, `GATE_ACTIVE`, `GATE_RESOLVING`, `PAUSED`, `GAME_OVER`, `WIN`, `SCORE_CARD`
2. Only **one state is active at a time**. There are no sub-states or parallel states.
3. State transitions are **synchronous and immediate** — the new state takes effect in the same frame the transition is triggered.
4. No system may change game state by writing directly to the state enum. All transitions go through a single `transitionTo(newState)` function which validates the transition is legal and fires a state-change event.
5. On `transitionTo()`, all listening systems receive a `{ from, to }` event and update themselves accordingly.
6. The state machine is exposed via React context. All game components read state via `useGameState()` hook.
7. **Gate pacing**: Gates are scheduled at `GATE_INTERVAL_FIRST` (T+20s) for Gate 1, then `GATE_INTERVAL` (22s) for subsequent gates. Timing is measured from the moment `RUNNING` is entered (excluding time spent in `PAUSED`). Gate timer is suspended during `PAUSED`.
8. **PAUSED** stores the prior state and restores it exactly on resume — it does not always return to `RUNNING`.

### States and Transitions

| State | Entry Condition | Behavior | Valid Exits |
|---|---|---|---|
| `LOADING` | Run starts (component mounts) | Fetch question + steps from Question Data Layer. Show loading indicator. Canvas not yet active. | → `READY` (data loaded successfully) · → `SCORE_CARD` with error flag (fetch fails after 3 retries) |
| `READY` | Data loaded successfully | Show question preview card and "Play" button. Canvas visible but paused at first frame. | → `RUNNING` (student taps Play) |
| `RUNNING` | Student taps Play, or `GATE_RESOLVING` completes with shields > 0 and gates remaining | Character auto-runs. World scrolls at 100% speed. Gate interval timer counts up. No UI overlay. | → `GATE_APPROACHING` (gate interval fires) · → `PAUSED` (tab hidden) |
| `GATE_APPROACHING` | Gate interval timer fires | World decelerates from 100% → 30% speed over `GATE_APPROACH_DURATION` (1.5s). Gate obstacle grows in screen space. No question shown yet. Tension sound cue begins. | → `GATE_ACTIVE` (deceleration complete) · → `PAUSED` (tab hidden) |
| `GATE_ACTIVE` | Deceleration complete | World locked at 30% speed. Question overlay renders with step description + 3–4 answer choices. Gate answer timer (`GATE_TIMER_DURATION`, 15s) counts down visually. | → `GATE_RESOLVING` (answer tapped or timer expires) · → `PAUSED` (tab hidden) |
| `GATE_RESOLVING` | Answer submitted or timer expires | Answer evaluated against correct step result. If correct: smash animation + speed boost queued + score updated. If wrong or timeout: stumble animation + shield decremented. Animation duration: `GATE_RESOLVE_DURATION` (1.2s). Answer input disabled for full duration. | → `RUNNING` (animation complete, shields > 0, gates remaining > 0) · → `WIN` (animation complete, final gate passed, shields > 0) · → `GAME_OVER` (shields reach 0) |
| `PAUSED` | Page Visibility API `visibilitychange` fires (document hidden) | All animation timers suspended. Canvas rendering paused. Gate answer timer suspended. Prior state stored. "Game Paused — Return to tab to continue" overlay shown. | → prior state (Page Visibility API fires with document visible) |
| `GAME_OVER` | Shields reach 0 in `GATE_RESOLVING` | Final stumble animation completes. "Game Over" overlay shown with score and accuracy. "Try Again" is primary CTA. | → `LOADING` (student taps Try Again — re-fetches same standard + tier) · → `SCORE_CARD` (student taps View Score) |
| `WIN` | Final gate resolves in `GATE_RESOLVING` with shields > 0 | Confetti fires. Win overlay shown with score. After `WIN_DISPLAY_DURATION` (1.5s) or student tap, transitions automatically. | → `SCORE_CARD` |
| `SCORE_CARD` | Entered from `WIN` or `GAME_OVER` | Displays: accuracy %, total score, personal best delta, per-step accuracy breakdown, "Play Again" and "Choose Standard" CTAs. Outcome Tracking Bridge fires its API call on entry to this state. | → `LOADING` (Play Again) · → Standard Selector route (Choose Standard / exit) |

### Interactions with Other Systems

| System | What it reads from State Machine | What it sends to State Machine |
|---|---|---|
| **Runner Engine** | Runs animation loop only in `RUNNING`, `GATE_APPROACHING`, `GATE_ACTIVE`, `GATE_RESOLVING`; reads speed modifier from state | Fires gate interval elapsed event → triggers `GATE_APPROACHING` |
| **Math Gate System** | Activates question overlay on `GATE_ACTIVE` entry; disables answer input on `GATE_RESOLVING` entry | Calls `transitionTo(GATE_RESOLVING)` when answer submitted or timer expires |
| **Lives & Score System** | Reads `GATE_RESOLVING` entry event to evaluate and record answer | Notifies state machine when shields reach 0 → triggers `GAME_OVER` |
| **Sound System** | Listens to all state entry events; plays state-specific audio cues | No writes to state machine |
| **Score Card & Win State** | Renders only when state = `SCORE_CARD` or `WIN` | Calls `transitionTo(LOADING)` on Play Again; routes to Standard Selector on exit |
| **Tutorial System** | Intercepts first `GATE_ACTIVE` entry (if tutorial flag unset); suppresses timer and substitutes tutorial overlay | Calls `transitionTo(GATE_RESOLVING)` when tutorial interaction complete |
| **Analytics / Event Tracking** | Fires events on state entries: `run_started` on `RUNNING`, `gate_shown` on `GATE_ACTIVE`, `gate_answered` on `GATE_RESOLVING`, `run_completed` on `WIN`/`GAME_OVER` | No writes to state machine |
| **Outcome Tracking Bridge** | Fires API call on `SCORE_CARD` entry | No writes to state machine |

## Formulas

This system contains no mathematical formulas. All logic is boolean or conditional (state comparisons, shield count checks). Timing durations are designer-adjustable constants documented in the Tuning Knobs section.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| Data fetch fails in `LOADING` | After 3 retries, transition to `SCORE_CARD` with an error message ("Couldn't load the question — check your connection"). No game over penalty. | Students on school WiFi hit flaky connections; failing silently or crashing is worse than a clear error. |
| Student answers correct on final gate AND loses last shield simultaneously | `WIN` takes priority over `GAME_OVER`. | Rewarding correct reasoning on the final step; ambiguity resolved in the student's favor. |
| Timer expires in `GATE_ACTIVE` with 0 shields remaining | Treat as wrong answer → `GATE_RESOLVING` → `GAME_OVER`. | Timer expiry is functionally equivalent to a wrong answer. |
| `transitionTo()` called with an illegal state transition | Log a warning to console, ignore the transition. Do not crash or show an error to the student. | Defensive; unexpected event firing should never break the game session. |
| Tab hidden during `GATE_RESOLVE_DURATION` animation (1.2s) | Complete the `GATE_RESOLVING` animation on resume; store the intended next state and transition after animation completes. | Interrupting the stumble/smash mid-animation looks broken. The 1.2s animation is short enough that completing it on resume is acceptable. |
| Student rapidly taps an answer multiple times during `GATE_ACTIVE` | Only the first tap is registered. All subsequent taps during `GATE_ACTIVE` and throughout `GATE_RESOLVING` are ignored. | Prevents double-submission; answer input is disabled the frame `GATE_RESOLVING` is entered. |
| `PAUSED` → resume while gate timer was at < 1s remaining | Resume with timer restored to a minimum of 3 seconds. | Prevents the student returning to a tab and having near-zero time to answer due to legitimate tab-switching. |
| Page refreshed mid-run | Run resets to `LOADING`. No partial progress saved in MVP. In v1.0, save per-step accuracy to localStorage so the Outcome Tracking Bridge can submit partial data on next load. | Simplest safe behavior for MVP; micro-sessions are short enough that restarting is not punishing. |
| Browser closed mid-run | In MVP: run is abandoned, no data saved. In v1.0: `beforeunload` event fires Outcome Tracking Bridge with partial per-step accuracy for steps already answered. No "resume" prompt on next visit — student starts fresh. | Micro-sessions are 2–3 min; losing progress to a browser close is a minor inconvenience, not a significant penalty. |

## Dependencies

This system has **no upstream dependencies** — it is a Foundation-layer system that everything else builds on.

| System | Direction | Nature of Dependency |
|---|---|---|
| **Runner Engine** | Depends on this | Reads current state to know when to animate, when to decelerate, when to stop |
| **Math Gate System** | Depends on this | Reads `GATE_ACTIVE` entry to show question overlay; calls `transitionTo()` to submit answer |
| **Lives & Score System** | Depends on this | Reads `GATE_RESOLVING` entry event to evaluate and record answer result; notifies state machine when shields reach 0 |
| **Sound System** | Depends on this | Subscribes to all state entry events to play contextual audio cues |
| **Score Card & Win State** | Depends on this | Renders conditionally on `WIN` and `SCORE_CARD` states; calls `transitionTo(LOADING)` on Play Again |
| **Tutorial System** | Depends on this | Intercepts first `GATE_ACTIVE` entry to inject tutorial overlay; calls `transitionTo(GATE_RESOLVING)` on completion |
| **Analytics / Event Tracking** | Depends on this | Fires `run_started`, `gate_shown`, `gate_answered`, `run_completed` events on specific state entries |
| **Outcome Tracking Bridge** | Depends on this | Fires platform API call on `SCORE_CARD` entry; fires partial accuracy data on `beforeunload` (v1.0) |
| **Standard Selector & Game Route** | Depends on this | Receives navigation trigger from `SCORE_CARD` "Choose Standard" exit path |

## Tuning Knobs

All values below are exported as named constants (e.g., `GAME_CONFIG.GATE_TIMER_DURATION`). No timing value is hardcoded inline. Changing any of these requires no code changes — only config updates.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `GATE_INTERVAL_FIRST` | 20s | 15–30s | Student forgets game context before first gate; loses running flow | No settling time; first gate feels jarring and unexpected |
| `GATE_INTERVAL` | 22s | 15–30s | Run feels like pure running with math as an afterthought | Constant interrogation; no flow recovery between gates |
| `GATE_APPROACH_DURATION` | 1.5s | 0.8–2.5s | Deceleration too gradual; urgency fades before question appears | Jarring snap to slow speed; feels glitchy |
| `GATE_TIMER_DURATION` | 15s | 8–25s | Students wait passively for timer; urgency collapses | Grade 3–4 students cannot read and process a question in time |
| `GATE_RESOLVE_DURATION` | 1.2s | 0.8–2.0s | Game feels sluggish between questions; flow breaks | Feedback animation unreadable; smash/stumble unclear |
| `WIN_DISPLAY_DURATION` | 1.5s | 0.5–3.0s | Students wait too long before Score Card; post-win momentum lost | Win moment barely registers; no celebration beat |
| `GATE_SPEED_MULTIPLIER` | 0.3 (30%) | 0.2–0.5 | World barely slows; question hard to read against moving background | World nearly stops; urgency completely lost |
| `PAUSED_TIMER_MINIMUM` | 3s | 2–8s | Student gets extended time on resume regardless of prior remaining time | Student returns to near-zero timer from legitimate tab switch |

## Visual/Audio Requirements

| State Entry | Visual Feedback | Audio Feedback |
|---|---|---|
| `LOADING` | Loading spinner centered on canvas; subtle pulse animation | None |
| `READY` | Question preview card slides in; "Play" button pulses gently | None (silence before run starts) |
| `RUNNING` | Character runs; world scrolls; no overlay | Run loop ambient sound (footsteps / wind) |
| `GATE_APPROACHING` | Gate obstacle grows in screen space; world visibly decelerates; gate frame glows | Tension ramp-up cue (rising tone or percussion build) |
| `GATE_ACTIVE` | Question overlay slides up from bottom; answer buttons appear; countdown ring/bar animates | Tick sound every second for final 5 seconds of timer |
| `GATE_RESOLVING` (correct) | Gate smashes open; character accelerates through with speed blur; score +points flash | Gate smash SFX + success chime |
| `GATE_RESOLVING` (wrong / timeout) | Character stumbles, bounces off gate; shield icon depletes by 1; brief screen shake | Stumble thud SFX + comedic "boing" or wobble sound |
| `PAUSED` | Semi-transparent dark overlay; "Game Paused" text; no canvas animation | Audio muted / fades out |
| `GAME_OVER` | Slow-motion final stumble; "Game Over" overlay fades in | Descending "wah-wah" comic tone; NOT harsh or punishing |
| `WIN` | Confetti burst (canvas-confetti); character does victory animation; "You did it!" overlay | Win fanfare chime (short, celebratory) |
| `SCORE_CARD` | Score card slides in with accuracy breakdown; personal best delta shown | None (student reads quietly) |

## UI Requirements

| State | UI Elements Shown | UI Elements Hidden |
|---|---|---|
| `LOADING` | Loading spinner, platform branding | Game canvas, all game UI |
| `READY` | Question preview card (topic + difficulty), "Play" button, lives display (3 full shields) | Score display, timer, answer buttons |
| `RUNNING` | Lives display, current score, gate counter (e.g., "Gate 2 / 5") | Question overlay, timer, answer buttons |
| `GATE_APPROACHING` | Lives display, current score, gate counter | Question overlay, answer buttons (timer hidden until GATE_ACTIVE) |
| `GATE_ACTIVE` | Full question overlay: step prompt text, 3–4 answer choice buttons, countdown timer ring, lives display | Gate counter (not relevant mid-question) |
| `GATE_RESOLVING` | Answer buttons disabled (grayed out), correct/incorrect indicator on selected button, lives display updating | Timer (already expired or dismissed) |
| `PAUSED` | "Game Paused — Return to this tab to continue" overlay (semi-transparent) | All interactive elements disabled |
| `GAME_OVER` | "Game Over" heading, final score, accuracy %, "Try Again" button (primary CTA), "View Score" link | All game HUD elements |
| `WIN` | "You did it!" heading, confetti, run score, "See Results" button | All game HUD elements |
| `SCORE_CARD` | Accuracy % (large), score, personal best comparison, per-step breakdown list, "Play Again" button (primary), "Choose Standard" link | All game HUD elements |

## Acceptance Criteria

- [ ] All 10 states are reachable through normal gameplay without console errors
- [ ] `transitionTo()` called with an illegal state transition logs a warning and does NOT change the current state
- [ ] Current state is accessible via `useGameState()` hook from any child component without prop drilling
- [ ] Gate 1 fires exactly at `GATE_INTERVAL_FIRST` seconds after `RUNNING` entry (±100ms tolerance)
- [ ] Subsequent gates fire at `GATE_INTERVAL` after the previous `RUNNING` re-entry (±100ms tolerance)
- [ ] Gate timer pauses when entering `PAUSED` and resumes at the exact remaining value on exit
- [ ] Gate timer on `PAUSED` resume is never less than `PAUSED_TIMER_MINIMUM` seconds
- [ ] `WIN` is entered (not `GAME_OVER`) when the correct answer is given on the final gate, even if shields = 0 at that moment
- [ ] `SCORE_CARD` is always reachable after every run — no dead-end states exist
- [ ] Outcome Tracking Bridge API call fires exactly once per run on `SCORE_CARD` entry (not on `WIN` or `GAME_OVER`)
- [ ] Rapid successive taps during `GATE_ACTIVE` register only the first tap; all subsequent taps are no-ops
- [ ] No state transition takes longer than one frame (16ms at 60fps) to execute
- [ ] All timing constants are read from `GAME_CONFIG` — zero hardcoded duration values in component or hook code
- [ ] Tab-hide during `GATE_RESOLVE_DURATION` animation results in the animation completing on resume before the next state transition fires

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should `GATE_TIMER_DURATION` vary by grade band? (e.g., 20s for Grade 3, 15s for Grade 6) | Emre | Defer to playtesting. Default 15s for all grades in MVP; adjust per grade in v1.0 based on observed accuracy data. |
| Does the gate interval timer count wall-clock time or animation frames? | Dev | Use `performance.now()` delta accumulated in `requestAnimationFrame` — immune to tab throttling and frame rate variation. |
