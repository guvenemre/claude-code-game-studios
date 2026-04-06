# ADR-002: React Overlay for Game UI Instead of Canvas-Drawn UI

> **Status**: Accepted
> **Date**: 2026-03-26
> **Decision Makers**: Emre
> **Applies To**: Math Gate System, Score Card, Standard Selector, all player-facing text

## Context

JetRun displays math questions with LaTeX expressions (fractions, exponents, algebraic notation) during gate encounters. The game also has UI screens (score card, standard selector) with buttons, text, and layout. We needed to decide where to render this UI: inside the canvas or as React components positioned over the canvas.

We evaluated two approaches:
1. **Canvas-drawn UI** — render all text, buttons, and layout with `fillText()`, `drawImage()`, and manual hit-testing
2. **React overlay** — position React components absolutely over the canvas element

## Decision

**Use React components absolutely positioned over the canvas for all game UI (gates, score card, selector). The canvas renders only the game world (parallax, character, obstacles).**

## Rationale

### Why not canvas-drawn UI?

- **Math rendering**: Canvas `fillText()` cannot render LaTeX. KaTeX (already in the platform's `package.json`) outputs HTML/MathML. Rendering math expressions on canvas would require a separate LaTeX-to-canvas rasterizer — a significant dependency with no benefit.
- **Text layout**: Canvas has no line wrapping, no text flow, no automatic sizing. Every line break, word wrap, and overflow would be manual. React + CSS handles this natively.
- **Accessibility**: Canvas content is invisible to screen readers. React components are semantic HTML — buttons are focusable, text is selectable, ARIA labels work natively.
- **Touch targets**: HTML buttons have built-in tap targets with CSS sizing. Canvas hit-testing requires manual coordinate math that must account for DPI scaling and viewport transforms.
- **Responsiveness**: CSS flexbox/grid handles layout across screen sizes. Canvas coordinates must be recalculated manually on resize.

### Why React overlay works here

- **Clean separation**: The canvas is the game world (scrolling, sprites, animation). React is the game UI (questions, buttons, text, scores). Neither crosses into the other's domain.
- **No z-fighting**: The gate overlay appears during `GATE_ACTIVE` when the world is at 30% speed with a backdrop dimmer (`GATE_BACKDROP_OPACITY = 0.6`). The overlay doesn't compete visually with canvas content.
- **Performance**: React components only render during UI-active states (`GATE_ACTIVE`, `GATE_RESOLVING`, `SCORE_CARD`). During `RUNNING`, no React overlay exists — zero reconciliation overhead during the performance-critical game loop.
- **KaTeX integration**: KaTeX renders directly into the React component tree. No bridging, no iframe, no postMessage. `<InlineMath math="\\frac{3}{4}" />` just works.

## Consequences

### Positive
- KaTeX math rendering works out of the box — no custom rasterizer
- Native CSS layout for all UI screens — no manual coordinate math
- Accessible by default (focusable buttons, screen reader support, keyboard navigation)
- Minimum 48x48 logical px tap targets enforced via CSS, not manual hitbox math
- UI components are testable with standard React testing tools

### Negative
- Two rendering layers (canvas + DOM) must be z-indexed correctly
- Canvas must be paused/dimmed when overlay is active to avoid visual competition
- Overlay positioning depends on the canvas element's DOM position — if the canvas layout changes, the overlay must follow

### Risks
- **Input event routing**: Click events on the React overlay must not propagate to the canvas. Mitigated by: `pointer-events: none` on the overlay container during `RUNNING` (canvas active), `pointer-events: auto` during `GATE_ACTIVE` (overlay active). Only one layer accepts input at a time.
- **Layout sync**: If the canvas resizes (orientation change, window resize), the overlay must match. Mitigated by: both canvas and overlay share the same parent container with `position: relative`, and the overlay uses `position: absolute; inset: 0` to fill it.
