# ADR-001: React + HTML5 Canvas Over Game Engine

> **Status**: Accepted
> **Date**: 2026-03-26
> **Decision Makers**: Emre
> **Applies To**: All game systems

## Context

JetRun is a 2D math runner mini-game for edukado.ai, an existing React 19 + Vite edtech platform. The game needs to be embedded directly in the SPA — not hosted externally or in an iframe. Target devices are school Chromebooks (2-4GB RAM), iPads, and phones. The game's visual complexity is low: parallax scrolling, a single character, gate obstacles, and UI overlays.

We evaluated three approaches:
1. **Game engine (Phaser, PixiJS, Godot HTML5 export)** — purpose-built for games
2. **React + HTML5 Canvas 2D** — vanilla browser APIs, no engine dependency
3. **Pure React/CSS animation** — no canvas at all, DOM-based rendering

## Decision

**Use React 19 + HTML5 Canvas 2D with requestAnimationFrame. No game engine.**

## Rationale

### Why not a game engine?

- **Bundle size**: Phaser adds ~500KB min-gzipped. PixiJS adds ~200KB. The edukado.ai platform is already a React SPA — adding a game engine doubles the JS payload for school Chromebook connections.
- **Integration friction**: Game engines manage their own render loop, input, and state. Embedding one inside a React SPA creates two competing frameworks. State synchronization (React context vs. engine state) becomes a maintenance burden.
- **Hiring/maintenance**: The team is a solo React/TypeScript developer. Introducing Phaser or Godot GDScript adds a second paradigm to maintain.
- **Overkill**: JetRun has no physics, no particle systems, no complex scene graphs. A 2D canvas with `drawImage()` and `requestAnimationFrame` covers 100% of the rendering needs.

### Why not pure React/CSS?

- **60fps scrolling**: CSS transforms can handle parallax, but coordinating 3 layers + character animation + gate obstacles at 60fps with React reconciliation introduces jank risk. Canvas bypasses the DOM entirely for the game viewport.
- **HiDPI control**: Canvas gives pixel-level control over DPI scaling. CSS-based games on Retina/HiDPI screens require careful handling of `devicePixelRatio` across every element.

### Why React + Canvas?

- **Zero new dependencies**: Canvas 2D and rAF are browser-native. No npm package needed for the render loop.
- **Clean boundary**: Canvas handles the game viewport (scrolling, sprites, animation). React handles everything else (gate UI, score card, selector, routing). Each does what it's best at.
- **Existing toolchain**: Vite bundles the sprites as static imports. TypeScript types the entire game. Vitest tests the hooks. No new build pipeline.
- **Platform integration**: The game component is a regular React component. It reads platform auth context, uses React Router, and shares the existing design system for non-game UI.

## Consequences

### Positive
- Zero additional bundle size for game rendering
- Single language (TypeScript) across platform and game
- Game state lives in React context — debuggable with React DevTools
- No framework lock-in — Canvas 2D is a stable browser standard

### Negative
- No built-in sprite animation system — must implement sprite sheet logic manually
- No built-in collision detection — must implement AABB manually (simple for this game)
- No scene graph — all draw ordering is manual `drawImage()` calls
- Canvas text rendering is limited — hence the decision to use React overlay for math (see ADR-002)

### Risks
- **Performance on low-end Chromebooks**: Canvas 2D is single-threaded. If the rAF callback exceeds 16ms, frames drop. Mitigated by: simple scene (3 parallax layers + 1 character + 1 gate), 50ms max delta time clamp, and early Chromebook benchmarking.
- **React reconciliation interference**: If React re-renders the canvas parent during animation, the canvas can flicker. Mitigated by: isolating the canvas in a `useRef`-based component that never re-renders, and keeping the rAF loop outside React's render cycle.
