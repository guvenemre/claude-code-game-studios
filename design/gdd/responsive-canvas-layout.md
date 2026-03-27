# Responsive Canvas Layout

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: One Click to Play

## Overview

The Responsive Canvas Layout system owns the game's rendering surface. It mounts a single `<canvas>` element inside a React container component, sets the canvas's logical resolution to 800×450 pixels, and scales it uniformly to fill the available screen space while preserving the 16:9 aspect ratio. All game systems draw to logical coordinates — they never read the screen's physical pixel dimensions. The layout system handles the physical-to-logical mapping entirely, including `devicePixelRatio` correction for crisp rendering on HiDPI screens. On portrait-orientation viewports (width < height), the canvas is hidden and a "Please rotate your device" overlay is shown instead. The system responds to window resize and device orientation events, recalculating the scale factor without disrupting an active game session.

## Player Fantasy

Infrastructure the student never thinks about. On their school Chromebook, the game fills the browser tab and looks sharp. On a friend's iPad, it fills the landscape screen correctly and tap targets land where they look like they should. The canvas doesn't wobble when the window is resized during a run, and answer buttons don't drift off-center after an orientation change. The layout system serves the "One Click to Play" pillar: a student who opens a shared link on any device should see a correctly-sized, correctly-scaled game without ever knowing that a coordinate system translation is happening underneath.

## Detailed Design

### Core Rules

1. The game renders to a single `<canvas>` element. Its logical (internal) resolution is always **800×450** pixels. This never changes at runtime.
2. The canvas element's CSS dimensions are set to fill its container while preserving the 16:9 aspect ratio. The container fills the viewport.
3. **Scale factor** is computed as: `scale = Math.min(containerWidth / 800, containerHeight / 450)`. The canvas CSS width is set to `800 * scale` px and CSS height to `450 * scale` px.
4. **HiDPI correction**: The canvas `width` and `height` attributes (not CSS) are set to `800 * devicePixelRatio` and `450 * devicePixelRatio`. The 2D context is then scaled by `devicePixelRatio` via `ctx.scale(dpr, dpr)` before any drawing. This ensures sharp rendering on Retina/HiDPI screens with no changes to game drawing code.
5. The canvas is centered in the viewport with black letterbox bars if the container aspect ratio doesn't exactly match 16:9. Letterbox color is `#000000`.
6. **Input coordinate translation**: All pointer events (click, touch) on the canvas must convert physical pixel coordinates to logical coordinates before passing to game systems. Conversion: `logicalX = physicalX / scale`, `logicalY = physicalY / scale`. This translation is the exclusive responsibility of the canvas container component — no game system ever reads raw pointer coordinates.
7. **Portrait mode**: If `window.innerWidth < window.innerHeight` (portrait orientation), the canvas is hidden and a `RotationPrompt` overlay is displayed. The prompt shows a rotation icon and the text "Rotate your device to play". The canvas remains mounted but not visible — no teardown or remount needed on orientation change.
8. The layout recalculates (recomputes scale, resets canvas attributes and context) on:
   - Initial component mount
   - `window` `resize` event
   - `screen.orientation` `change` event (covers device rotation)
9. Recalculation on resize/rotation does NOT restart or interrupt the game session. The game loop (`requestAnimationFrame`) continues uninterrupted. The new scale takes effect on the next rendered frame.
10. The canvas `ref` is exposed to the game via React context (`useCanvas()` hook) — it returns `{ canvasRef, ctx, logicalWidth: 800, logicalHeight: 450 }`. All systems that draw to the canvas read from this hook.
11. The canvas is always rendered in the DOM (even during `LOADING` state). The State Machine controls what is drawn on it, not whether it exists.

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **Runner Engine** | Reads `canvasRef`, `ctx`, `logicalWidth`, `logicalHeight` from `useCanvas()` | Draws to canvas each frame |
| **Math Gate System** | Reads `ctx` and logical dimensions for gate obstacle and question overlay rendering | Draws gate visuals to canvas |
| **State Machine** | None — layout system has no state machine dependency | None — layout system does not change game state |
| **All input handlers** | Receive raw pointer events from the DOM | Translate to logical coordinates before passing to game systems |

## Formulas

**Scale factor:**
```
scale = Math.min(containerWidth / LOGICAL_WIDTH, containerHeight / LOGICAL_HEIGHT)
      = Math.min(containerWidth / 800, containerHeight / 450)
```
- `scale` range: `0 < scale ≤ devicePixelRatio` (bounded by physical screen size)
- Example: 1366×768 Chromebook → `scale = Math.min(1366/800, 768/450) = Math.min(1.7075, 1.7067) = 1.7067`

**Canvas CSS dimensions:**
```
cssWidth  = 800 * scale   (px)
cssHeight = 450 * scale   (px)
```

**Canvas buffer dimensions (HiDPI):**
```
bufferWidth  = 800 * devicePixelRatio
bufferHeight = 450 * devicePixelRatio
```

**Input coordinate translation:**
```
logicalX = event.offsetX / scale
logicalY = event.offsetY / scale
```
Where `event.offsetX/Y` are the pointer coordinates relative to the canvas element's top-left corner. Using `offsetX/Y` instead of `clientX/Y` avoids needing to subtract the canvas's position in the page.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| Viewport is exactly 800×450 | `scale = 1.0`. Canvas CSS dimensions = 800×450. No letterbox bars. Buffer dimensions = 800×450 × dpr. Normal operation. | Exact match is the baseline case — must work. |
| Viewport is smaller than 800×450 (e.g., 640×360) | `scale < 1.0`. Canvas shrinks proportionally. All logical coordinates still valid. Game is playable but small. | Don't refuse to render — small screen is still better than nothing. |
| `devicePixelRatio = 1` (non-HiDPI, most Chromebooks) | Buffer dimensions = 800×450. Context scale = 1. No change to rendering. | Most school Chromebooks are 1:1 — this is the most common case. |
| `devicePixelRatio = 2` (Retina Mac, iPad) | Buffer dimensions = 1600×900. All drawing coordinates remain 0–800/0–450. Text and curves render crisply. | The dpr correction is transparent to all drawing code. |
| `devicePixelRatio = 3` (some Android phones) | Buffer dimensions = 2400×1350. Same logic as dpr=2. No special case needed. | Formula generalizes to any dpr. |
| Window resize during active run (e.g., student resizes browser) | Layout recalculates scale. Game loop continues. Next frame draws at new scale. No state reset, no question re-fetch. | Resizing mid-run is unusual but should not punish the student. |
| Orientation change from landscape to portrait mid-run | Canvas hidden, `RotationPrompt` shown. Game loop is still running (State Machine is not informed). When rotated back, canvas reappears, layout recalculates, game resumes visually. | Do not interrupt game state or cause a re-fetch. The 1–2 seconds of hidden canvas is acceptable. |
| Orientation change from landscape to portrait while in `PAUSED` state | Same as above — canvas hidden, rotation prompt shown. The `PAUSED` overlay is also hidden (canvas is hidden). The Page Visibility API has already handled the pause. | No conflict — `PAUSED` state is already protecting the game session. |
| `window.innerWidth === window.innerHeight` (exact square viewport) | Treated as landscape (not portrait) since `width < height` condition is not met. Scale computed normally. | Unlikely in practice; square viewport handles like landscape to avoid false rotation prompts. |
| Canvas context (`ctx`) is null on first draw attempt | Drawing systems must guard against `ctx === null` — skip the draw and retry next frame. | React `useRef` returns null before the component mounts. The first rAF tick may fire before mount completes. |

## Dependencies

This system is a **Foundation-layer** system with no upstream game-system dependencies. It has no dependencies on the State Machine or any gameplay system.

| System | Direction | Nature of Dependency |
|---|---|---|
| **Runner Engine** | Depends on this | Reads canvas `ref` and `ctx` from `useCanvas()` to drive the animation loop. Cannot draw without a mounted canvas. |
| **Math Gate System** | Depends on this | Reads `ctx` to render gate obstacles and question overlays at logical coordinates. |
| **State Machine** | No dependency in either direction | The layout system is always active regardless of game state. The State Machine controls what is drawn, not the canvas itself. |
| **All input-handling game systems** | Depend on this for coordinate translation | Must use the translated logical coordinates provided by the canvas container. Any system reading raw pointer coordinates will have hitbox errors at non-1.0 scale. |

## Tuning Knobs

All values exported from `GAME_CONFIG`. `LOGICAL_WIDTH` and `LOGICAL_HEIGHT` must maintain a 16:9 ratio — changing one without the other breaks the scaling formula.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `LOGICAL_WIDTH` | 800 | 640–1280 | More logical pixels = more room for content but heavier canvas buffer (especially on HiDPI) | Too small = text and UI elements cramped; hard to fit gate prompt and answer buttons |
| `LOGICAL_HEIGHT` | 450 | 360–720 | Taller canvas may not fit on Chromebook screens without shrinking | Too short = vertical content (question overlay, gate, score HUD) stacked too tightly |
| `LETTERBOX_COLOR` | `#000000` | Any CSS color | Cosmetic only — affects the bars visible outside the 16:9 canvas area | N/A |

## Acceptance Criteria

- [ ] On a 1366×768 Chromebook viewport, the canvas renders at the correct scaled CSS dimensions with no distortion
- [ ] On a 2560×1440 HiDPI display (`devicePixelRatio = 2`), text and lines are sharp (not blurry) — confirmed visually
- [ ] A click/tap at a known logical coordinate (e.g., center of an answer button at logical 400,225) registers correctly at all tested scale factors: 0.8×, 1.0×, 1.5×, 2.0×
- [ ] Resizing the browser window mid-run does not reset game state, cause a re-fetch, or produce a console error
- [ ] On a portrait viewport (`innerWidth < innerHeight`), the `RotationPrompt` overlay is shown and the canvas is not visible
- [ ] Rotating back to landscape dismisses the `RotationPrompt` and the canvas is visible again at the correct dimensions
- [ ] `useCanvas()` hook returns `{ canvasRef, ctx, logicalWidth: 800, logicalHeight: 450 }` — all four fields present
- [ ] `ctx` returned by `useCanvas()` has been pre-scaled by `devicePixelRatio` — game systems draw at logical pixels and see correct physical output
- [ ] Zero game systems read `window.innerWidth`, `window.innerHeight`, `canvas.getBoundingClientRect()`, or raw `event.clientX/Y` — all coordinate reading goes through `useCanvas()` and the translated pointer events
- [ ] `LOGICAL_WIDTH`, `LOGICAL_HEIGHT`, and `LETTERBOX_COLOR` are read from `GAME_CONFIG` — not hardcoded in the component

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should the canvas container have a maximum CSS width even on very large monitors (e.g., cap at 1920px)? | Dev | Not needed for MVP — school Chromebooks don't have 4K screens. Add a `MAX_CANVAS_CSS_WIDTH` cap in v1.0 if desktop play becomes a use case. |
| Do we need to handle the browser's zoom level (e.g., `window.devicePixelRatio` changes due to user zoom)? | Dev | Treat browser zoom the same as dpr — it changes `devicePixelRatio`. The current formula handles it correctly. Add `zoom` to the resize event listener if needed. |
