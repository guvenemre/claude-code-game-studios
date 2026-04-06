# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: React 19 + HTML5 Canvas (no game engine — embedded in edukado.ai SPA)
- **Language**: TypeScript (strict mode)
- **Rendering**: HTML5 Canvas 2D Context + requestAnimationFrame
- **Physics**: None (no physics simulation — auto-run with scripted movement)

## Naming Conventions

- **Components**: PascalCase (`GateOverlay`, `ScoreCard`, `JetRunGame`)
- **Hooks**: camelCase with `use` prefix (`useGameState`, `useLivesScore`, `useSequencer`, `useCanvas`)
- **Variables/Functions**: camelCase (`gateResults`, `transitionTo`, `fetchQuestion`)
- **Interfaces/Types**: PascalCase (`GameQuestion`, `GameGate`, `LivesScoreState`, `StandardOption`)
- **Files**: kebab-case (`game-state-machine.ts`, `lives-and-score.ts`, `gate-overlay.tsx`)
- **Config Constants**: UPPER_SNAKE_CASE (`GATE_TIMER_DURATION`, `BASE_GATE_SCORE`, `MAX_STREAK_MULTIPLIER`)
- **CSS Classes**: kebab-case or CSS modules (`score-card`, `gate-overlay__timer`)

## Performance Budgets

- **Target Framerate**: 60fps (16.67ms frame budget)
- **Frame Budget**: 16ms — canvas render + rAF callback must complete within this
- **Max Delta Time**: 50ms — clamp to prevent spiral-of-death on slow frames
- **Draw Calls**: N/A (single Canvas 2D context, no WebGL draw call batching)
- **Memory Ceiling**: 50MB total JS heap (targeting school Chromebooks with 2-4GB RAM)
- **Logical Resolution**: 800x450 (16:9), uniform scale to viewport, HiDPI-corrected
- **Asset Budget**: <2MB total (sprites PNG, audio MP3/OGG)

## Testing

- **Framework**: Vitest (aligned with Vite toolchain)
- **Minimum Coverage**: 80% on gameplay hooks (`useGameState`, `useLivesScore`, `useSequencer`)
- **Required Tests**: Score formulas, streak multiplier table, state machine transitions, gate timer logic, accuracy computation

## Forbidden Patterns

- **No game engines**: Never import Phaser, PixiJS, Godot, Unity, or any game engine/framework
- **No hardcoded curriculum**: `standardId` is an opaque string — never branch on TEKS/Common Core/etc.
- **No hardcoded gameplay values**: All timing, scoring, and balance constants must live in `GAME_CONFIG`
- **No canvas-drawn text for questions**: Math expressions use KaTeX in React overlay, never canvas `fillText`
- **No singletons**: All game state via React context + hooks (dependency injection)
- **No synchronous fetches**: All DynamoDB calls are async with retry logic

## Allowed Libraries / Addons

- **KaTeX** — LaTeX math rendering (already in platform package.json)
- **canvas-confetti** — WIN celebration animation (already in platform package.json)
- **React Router** — Route management (already in platform)
- **Vitest** — Test framework (aligned with Vite)

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [ADR-001](../../docs/architecture/adr-001-react-canvas-over-game-engine.md) — React + Canvas over game engine
- [ADR-002](../../docs/architecture/adr-002-react-overlay-for-game-ui.md) — React overlay for game UI instead of canvas-drawn UI
