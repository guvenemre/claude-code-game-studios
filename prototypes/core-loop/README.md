# Prototype: Core Loop Validation

> **Status**: In Progress
> **Date**: 2026-04-06
> **Goal**: Validate the highest-risk mechanic — canvas runner + gate overlay + KaTeX math — before entering Production.
> **Throwaway**: Yes. This code is intentionally quick and dirty. It will NOT be promoted to `src/`.

## What This Prototype Validates

1. **Canvas rAF loop** — Can we sustain 60fps with 3 parallax layers + character on a single Canvas 2D context?
2. **Gate deceleration** — Does the world-slows-to-30% mechanic feel right? Is the 1.5s deceleration smooth?
3. **React overlay on canvas** — Does a React component absolutely positioned over the canvas render cleanly without flicker or z-index fighting?
4. **KaTeX in gate overlay** — Does `<InlineMath>` render LaTeX expressions inside the gate overlay without layout jank?
5. **State loop** — Does RUNNING → GATE_APPROACHING → GATE_ACTIVE → GATE_RESOLVING → RUNNING cycle smoothly?
6. **Input routing** — Do clicks route to the overlay during GATE_ACTIVE and to nothing during RUNNING?

## What This Prototype Does NOT Validate

- Score persistence, lives, streak multiplier (pure state — no risk)
- DynamoDB fetch, content pipeline (infrastructure — separate concern)
- Sound, cosmetics, tutorial (v1.0 systems)
- Responsive layout across all devices (tested separately)

## Success Criteria

- [ ] 60fps sustained for 30s of RUNNING on a modern browser (Chrome DevTools Performance tab)
- [ ] Gate deceleration from 100% → 30% speed visually smooth (no stutter, no snap)
- [ ] React overlay appears and disappears without canvas flicker
- [ ] KaTeX renders a fraction (e.g., `\frac{3}{4}`) inside the overlay without layout shift
- [ ] Full RUNNING → GATE → RESOLVE → RUNNING loop completes 3 times without error
- [ ] Click on answer button during GATE_ACTIVE registers; click during RUNNING does nothing

## How to Run

```bash
cd prototypes/core-loop
npm install
npm run dev
# Open http://localhost:5173
```

## Tech

- Vite + React 19 + TypeScript (mirrors production stack)
- Single `index.html` + `main.tsx` entry point
- No routing, no auth, no DynamoDB — hardcoded question data
