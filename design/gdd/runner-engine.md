# Runner Engine

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Urgency Without Anxiety

## Overview

The Runner Engine is the game loop. It owns the `requestAnimationFrame` cycle, the character's visual state, world scrolling across 2–3 parallax layers, the gate approach animation, and the speed state that all other systems read. In MVP, the character runs automatically — there is no player-controlled movement during the run phase. All player interaction is answering math gates. The engine reads the current game state from the State Machine on every frame and adjusts rendering accordingly: full-speed scroll in `RUNNING`, progressive deceleration in `GATE_APPROACHING`, locked slow scroll in `GATE_ACTIVE`, smash or stumble animation in `GATE_RESOLVING`. The engine also owns the gate interval timer — it tracks elapsed time in `RUNNING` using `performance.now()` delta and fires a gate event when the interval elapses. The engine is designed to be jump-capable: a `onPlayerAction` hook exists in the architecture but is unimplemented in MVP, allowing tap-to-jump to be added in v1.1 without rearchitecting the loop.

## Player Fantasy

The run feels kinetic and alive even though the player isn't controlling it. Background layers scroll at different speeds — a feeling of depth and forward momentum. When a gate appears in the distance, the world starts to slow and a tension cue builds. The deceleration isn't instant; it feels like the character is gathering focus, not hitting a wall. When the student smashes through correctly, the world briefly rockets forward — a visceral "yes" moment. When they stumble, the character bounces off with cartoon energy and immediately recovers. The run never feels punishing, only urgent. The Runner Engine serves the "Urgency Without Anxiety" pillar: the motion creates excitement, the deceleration creates tension, and every gate exit — right or wrong — releases that tension cleanly and returns the student to the flow state.

## Detailed Design

### Core Rules

1. The game loop runs as a single `requestAnimationFrame` callback registered once on component mount and cancelled on unmount. No secondary timers, intervals, or React `setState` calls inside the loop.
2. Every frame: compute `deltaTime = now - lastFrame` (capped at 50ms to prevent spiral-of-death on tab resume), update world state, clear canvas, draw all layers in order (back to front), update `lastFrame`.
3. **World scroll speed** is a single value: `currentSpeed` (logical pixels per second). On `RUNNING` entry, `currentSpeed = BASE_SPEED`. All parallax layers scroll at `currentSpeed × layerParallaxFactor`.
4. **Parallax layers** (drawn back to front):
   - Layer 0 — Sky/far background: `parallaxFactor = 0.1`. Stationary or near-stationary. Color gradient or distant scenery tile.
   - Layer 1 — Mid background: `parallaxFactor = 0.4`. Hills, city silhouette, or mid-distance scenery tile.
   - Layer 2 — Ground: `parallaxFactor = 1.0`. The surface the character runs on. Tiles scroll and wrap seamlessly.
5. Each layer tile is `LOGICAL_WIDTH` (800) pixels wide and wraps: when a tile scrolls fully off-screen left, it is repositioned to the right edge. Two tiles per layer are sufficient for seamless wrapping.
6. **Character** is drawn at a fixed logical X position (`CHARACTER_X = 160`, ~20% from left). Only the world scrolls — the character does not move horizontally. The character's Y position is fixed at ground level (`CHARACTER_Y = GROUND_Y`) in `RUNNING`. In `GATE_RESOLVING` (correct), character plays smash-through animation. In `GATE_RESOLVING` (wrong), character plays stumble animation.
7. **Character animation states**: `RUNNING_IDLE` (looping run cycle), `SMASH` (forward burst), `STUMBLE` (bounce-and-recover), `VICTORY` (hands-up loop). Animations are sprite-based or procedural (TBD by Art Director). The Runner Engine drives state transitions; it does not own sprite assets.
8. **Gate interval timer**: Accumulated in the rAF loop using `performance.now()` delta. Timer increments only in `RUNNING` state. On first entry to `RUNNING`, gate fires after `GATE_INTERVAL_FIRST` (20s). After each `RUNNING` re-entry (post-gate), fires after `GATE_INTERVAL` (22s). When timer elapses, Runner Engine calls `transitionTo(GATE_APPROACHING)`.
9. **Speed boost** (post correct gate): On `GATE_RESOLVING` entry with correct answer, queue a boost. When `RUNNING` is re-entered after smash animation, `currentSpeed` is set to `BASE_SPEED × BOOST_MULTIPLIER` (150%) for `BOOST_DURATION` (1.0s), then linearly interpolates back to `BASE_SPEED` over `BOOST_DECAY` (0.8s).
10. The `onPlayerAction` hook is called on tap/click input during `RUNNING` state. In MVP, this is a no-op. In v1.1, it will trigger a jump.
11. The rAF loop is the **only** code that writes to the canvas. No React renders touch canvas pixels. The canvas container component (from Responsive Canvas Layout) owns the `<canvas>` element; the Runner Engine owns what is drawn on it.

### State Responses

| State | Runner Engine Behavior |
|---|---|
| `LOADING` | Loop not started. Canvas cleared to background color. |
| `READY` | Loop running but `currentSpeed = 0`. Character in `RUNNING_IDLE` at ground level. World tiles at starting position (not scrolling). |
| `RUNNING` | Loop running at `currentSpeed = BASE_SPEED` (or boosted). Gate interval timer incrementing. Character in `RUNNING_IDLE`. |
| `GATE_APPROACHING` | `currentSpeed` decelerating from current value to `BASE_SPEED × GATE_SPEED_MULTIPLIER` (30%) over `GATE_APPROACH_DURATION` (1.5s) via linear interpolation. Gate obstacle enters from right and grows in apparent size as character approaches. |
| `GATE_ACTIVE` | `currentSpeed` locked at `BASE_SPEED × GATE_SPEED_MULTIPLIER`. Gate obstacle fills right portion of canvas. Character in `RUNNING_IDLE`. |
| `GATE_RESOLVING` (correct) | Character plays `SMASH` animation. `currentSpeed` stays at 30% for `GATE_RESOLVE_DURATION` (1.2s). Boost queued for next `RUNNING` entry. Gate plays shatter effect. |
| `GATE_RESOLVING` (wrong/timeout) | Character plays `STUMBLE` animation. `currentSpeed` stays at 30% for `GATE_RESOLVE_DURATION`. Gate obstacle remains visible. |
| `PAUSED` | rAF loop runs but detects `PAUSED` state and returns immediately — no draw, no timer increment, no state update. Canvas holds last rendered frame. |
| `GAME_OVER` | Character plays final `STUMBLE` with slow-motion effect (`currentSpeed × 0.15` for 0.5s then freeze). rAF loop stops after animation. |
| `WIN` | Character plays `VICTORY` animation. World continues scrolling at `BASE_SPEED` during `WIN_DISPLAY_DURATION` (1.5s). rAF loop stops on `SCORE_CARD` entry. |
| `SCORE_CARD` | rAF loop not running. Canvas cleared. |

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **State Machine** | Reads `gameState` each frame to determine behavior | Calls `transitionTo(GATE_APPROACHING)` when gate interval elapses |
| **Responsive Canvas Layout** | Reads `ctx`, `logicalWidth`, `logicalHeight` from `useCanvas()` | Draws to canvas each frame |
| **Math Gate System** | None — Runner Engine does not call Math Gate System directly | Gate obstacle visual drawn by Runner Engine; Math Gate System renders question overlay on top in `GATE_ACTIVE` |
| **Lives & Score System** | Reads gate result from State Machine `GATE_RESOLVING` event to determine smash vs. stumble | None |
| **Sound System** | None | Emits events: `gate_approaching_start`, `smash`, `stumble`, `speed_boost` — Sound System subscribes |

## Formulas

**World scroll offset per frame (per layer):**
```
layerOffset += currentSpeed × parallaxFactor × (deltaTime / 1000)
layerOffset  = layerOffset mod TILE_WIDTH   // wrap: [0, TILE_WIDTH)
```
Variables: `currentSpeed` (logical px/s), `parallaxFactor` (0.1 / 0.4 / 1.0 per layer), `deltaTime` (ms), `TILE_WIDTH = 800`

**Gate approach deceleration (linear interpolation):**
```
t            = elapsedApproachTime / GATE_APPROACH_DURATION    // [0.0, 1.0]
currentSpeed = startSpeed + (targetSpeed − startSpeed) × t
targetSpeed  = BASE_SPEED × GATE_SPEED_MULTIPLIER              // = BASE_SPEED × 0.3
```
Variables: `elapsedApproachTime` (s, accumulated in rAF loop), `startSpeed` = `currentSpeed` at `GATE_APPROACHING` entry

**Post-gate speed boost:**
```
Phase 1  (elapsed ≤ BOOST_DURATION):
  currentSpeed = BASE_SPEED × BOOST_MULTIPLIER

Phase 2  (BOOST_DURATION < elapsed ≤ BOOST_DURATION + BOOST_DECAY):
  t = (elapsed − BOOST_DURATION) / BOOST_DECAY                 // [0.0, 1.0]
  currentSpeed = BASE_SPEED × (BOOST_MULTIPLIER + (1 − BOOST_MULTIPLIER) × t)
```
Variables: `BOOST_MULTIPLIER = 1.5`, `BOOST_DURATION = 1.0s`, `BOOST_DECAY = 0.8s`
At t=0 (start of Phase 2): `currentSpeed = BASE_SPEED × 1.5`
At t=1 (end of Phase 2): `currentSpeed = BASE_SPEED × 1.0` ✓

**deltaTime cap (spiral-of-death prevention):**
```
deltaTime = Math.min(now − lastFrame, MAX_DELTA_TIME)   // MAX_DELTA_TIME = 50ms
```
Without this cap, a long tab-hide or garbage collection pause produces a massive `deltaTime` on resume, teleporting the world position forward by seconds of scroll distance.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| Tab hidden mid-deceleration (`GATE_APPROACHING`) | `PAUSED` state entered via Page Visibility API. rAF loop skips all updates. `elapsedApproachTime` not incremented. On resume, deceleration continues from where it paused. | State Machine handles the pause; Runner Engine just checks state each frame. |
| Tab resumes with `deltaTime` > `MAX_DELTA_TIME` | `deltaTime` capped at 50ms. World does not teleport. `elapsedApproachTime` increments by at most 50ms per frame. | Prevents visual artifacts and world-position jumps on tab return. |
| `ctx` is `null` on first rAF tick | Skip draw and update for that frame. Retry next frame. `if (!ctx) return;` at top of loop. | React ref is not yet bound on the very first rAF callback after mount. |
| Window resize during active run | `useCanvas()` recalculates scale. `ctx` reference remains valid. rAF loop continues drawing at 800×450 logical coords. No restart. | Canvas Layout owns the resize response; Runner Engine is unaware of physical dimensions. |
| `GATE_APPROACHING` entry — `elapsedApproachTime` reset | `elapsedApproachTime` is reset to 0 on every `GATE_APPROACHING` state entry. | Each gate approach starts a fresh deceleration. |
| Speed boost queued but `GAME_OVER` fires before `RUNNING` re-entry | Discard the queued boost. `GAME_OVER` resets `currentSpeed` to 0. | Boost only applies if the run continues. |
| Frame rate drops below 30fps on low-end Chromebook | `deltaTime` ~33ms+ per frame. Scroll and timer remain correct via delta-time formula. Animation may stutter visually but game logic is unaffected. | Frame-rate independence is baked in. Visual smoothness is a performance concern, not a correctness concern. |
| `BASE_SPEED` set to 0 (misconfiguration) | World does not scroll. Gate timer never elapses. Game is stuck in `RUNNING`. Log a console warning on startup: `"BASE_SPEED must be > 0"`. | Validation guard prevents silent misconfiguration from producing a broken game without an obvious error. |

## Dependencies

| System | Direction | Nature of Dependency |
|---|---|---|
| **Game State Machine** | Runner Engine depends on it | Reads `gameState` every frame to determine loop behavior and speed. Calls `transitionTo(GATE_APPROACHING)` when gate interval fires. Hard dependency — engine cannot function without state context. |
| **Responsive Canvas Layout** | Runner Engine depends on it | Reads `ctx`, `logicalWidth`, `logicalHeight` from `useCanvas()`. Hard dependency — no canvas = no rendering. |
| **Math Gate System** | Depends on Runner Engine | Reads `currentSpeed` to position gate obstacle visuals. Renders question overlay on top of the canvas in `GATE_ACTIVE`. |
| **Lives & Score System** | Depends on Runner Engine (soft) | Gate result (correct/wrong) comes from State Machine events; Lives & Score does not read from Runner Engine directly. |
| **Sound System** | Depends on Runner Engine (event-driven) | Subscribes to Runner Engine events: `gate_approaching_start`, `smash`, `stumble`, `speed_boost`. |

## Tuning Knobs

All values exported from `GAME_CONFIG`. Gate timing constants (`GATE_INTERVAL_FIRST`, `GATE_INTERVAL`, `GATE_APPROACH_DURATION`, `GATE_SPEED_MULTIPLIER`) are defined in the State Machine GDD — listed here for reference only; State Machine GDD is the source of truth.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `BASE_SPEED` | 300 px/s | 150–500 px/s | World scrolls too fast; students can't focus between gates | World drags; no sense of momentum or urgency |
| `GATE_SPEED_MULTIPLIER` | 0.3 (30%) | 0.2–0.5 | *(see State Machine GDD)* | *(see State Machine GDD)* |
| `BOOST_MULTIPLIER` | 1.5 (150%) | 1.1–2.0 | Visually jarring speed spike; disorienting | Speed boost unnoticeable; reward feel evaporates |
| `BOOST_DURATION` | 1.0s | 0.5–2.0s | Student barely processes boost before it starts decaying | Boost over before the smash animation resolves |
| `BOOST_DECAY` | 0.8s | 0.3–1.5s | Slow return to normal; run feels sluggish too long after gate | Snap back to normal speed; easing looks mechanical |
| `CHARACTER_X` | 160 (logical px) | 100–250 | Character too far right; gate approaches too fast visually | Character too close to left edge; feels cornered |
| `MAX_DELTA_TIME` | 50ms | 33–100ms | Cap too high; large pauses still cause noticeable world teleport | Cap too low; fast machines artificially limit scroll per frame |

## Acceptance Criteria

- [ ] Game loop runs at 60fps on a 2021 school Chromebook without sustained frame drops (verifiable via DevTools Performance panel)
- [ ] World scroll is frame-rate independent: `BASE_SPEED × elapsed_seconds` equals actual pixels scrolled at both 30fps and 60fps
- [ ] Gate 1 timer fires within ±100ms of `GATE_INTERVAL_FIRST` (20s) after `RUNNING` entry
- [ ] Subsequent gate timers fire within ±100ms of `GATE_INTERVAL` (22s) after each `RUNNING` re-entry
- [ ] `currentSpeed` reaches `BASE_SPEED × GATE_SPEED_MULTIPLIER` at exactly `GATE_APPROACH_DURATION` (1.5s) after `GATE_APPROACHING` entry (±50ms tolerance)
- [ ] Speed boost: `currentSpeed` peaks at `BASE_SPEED × BOOST_MULTIPLIER` on `RUNNING` re-entry and returns to `BASE_SPEED` within `BOOST_DURATION + BOOST_DECAY` (total 1.8s)
- [ ] Tab hidden mid-run (10s) then restored: world position and gate timer have not advanced by 10s of scroll
- [ ] Window resize during active run produces no console errors and no visible jump in world position
- [ ] All three parallax layers wrap seamlessly — no visible seam at any scroll position
- [ ] `ctx === null` on first frame does not crash the loop — game recovers on the next frame
- [ ] `BASE_SPEED = 0` in config logs a console warning on startup; loop runs without throwing an error
- [ ] `onPlayerAction` hook is defined and callable in MVP (no-op implementation) — invoking it does not crash the game

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Who owns the gate obstacle visual — Runner Engine or Math Gate System? | Dev | Runner Engine draws the gate obstacle (it's part of the world). Math Gate System draws the question overlay UI on top. Gate obstacle is a canvas-drawn rectangle/wall; question overlay is an HTML/React overlay or canvas UI layer. Confirm at implementation time. |
| Should the character have a distinct "falling into gate" animation for wrong answers, or just a stumble in place? | Art Director / Emre | Defer to playtesting. Stumble-in-place is simpler to implement; falling back from the gate reads more clearly. Prototype both and test with students. |
| Jump mechanics (v1.1): will jump require a physics simulation (gravity, arc) or a fixed Y-position tween? | Dev | Fixed Y-tween is simpler and more controllable. Reserve physics for if jump-over gameplay becomes the core design. Provisional: tween-based jump for v1.1. |
