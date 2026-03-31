# Standard Selector & Game Route

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-31
> **Implements Pillar**: One Click to Play

## Overview

The Standard Selector is a React route (`/play` or `/play/:standardId`) that serves as the game's entry point. In MVP, it renders a simple list of available math standards (e.g., "Grade 5 — Fractions", "Grade 6 — Ratios") fetched from a static config array — not from DynamoDB. The student taps a standard, and the route mounts the JetRun game component with `standardId` passed as a prop. If a `standardId` is present in the URL (deep link from the platform), the selector is skipped and the game loads directly. The selector has no auth dependency in MVP — it works for anonymous users. In v1.0, the Auth Bridge adds student-specific data: last-played standard, recommended topics, and unlock state. The route also handles the "Change Topic" navigation from the Score Card, returning the student to the selector without a full page reload.

## Player Fantasy

The student opens a link and sees a clean, simple menu: a few topic buttons, each one a door into a run. No login wall, no loading screen, no tutorial before the tutorial. They tap "Fractions" and the jetpack fires up. That's it — one tap from "what should I practice?" to "I'm playing." When they come back from a run via "Change Topic," the selector is already there, instant, no spinner. The platform can deep-link them straight into a standard — the student doesn't even see the selector if the teacher assigned a topic. The feeling is: *the game is always ready for me*.

## Detailed Design

### Core Rules

1. **Route structure**: The game lives at `/play` (selector) and `/play/:standardId` (direct launch). Both are React Router routes in the existing edukado.ai SPA.
2. **Standard config** (MVP): A static TypeScript array defines available standards:
   ```typescript
   interface StandardOption {
     standardId: string;       // opaque ID matching DynamoDB partition key
     label: string;            // "Grade 5 — Fractions"
     gradeLabel: string;       // "Grade 5"
     topicLabel: string;       // "Fractions"
     icon?: string;            // optional emoji or icon key
   }

   const AVAILABLE_STANDARDS: StandardOption[] = [
     { standardId: "5.3F", label: "Grade 5 — Fractions", gradeLabel: "Grade 5", topicLabel: "Fractions" },
     // ... more entries added as content pipeline processes them
   ];
   ```
3. **Selector screen** renders when the URL is `/play` (no `:standardId` param). It displays `AVAILABLE_STANDARDS` as a list of tappable cards, grouped by grade.
4. **Direct launch**: When URL is `/play/:standardId`, skip the selector entirely. Validate that `standardId` exists in `AVAILABLE_STANDARDS`. If valid, mount the game component immediately. If invalid, redirect to `/play` (selector) with a toast: "Topic not found — pick one below."
5. **Game mounting**: Tapping a standard card (or arriving via deep link) renders `<JetRunGame standardId={standardId} />`. The game component handles its own `LOADING → READY → ...` lifecycle via the State Machine.
6. **"Change Topic" return**: The Score Card's "Change Topic" CTA calls `navigate('/play')` via React Router. This unmounts the game component and shows the selector. No full page reload. Game state is discarded — the hooks (`useGameState`, `useLivesScore`, `useSequencer`) reset on unmount.
7. **"Play Again" loop**: The Score Card's "Play Again" calls `transitionTo(LOADING)` — stays on `/play/:standardId`, game component stays mounted, only internal state resets.
8. **No auth in MVP**: The selector shows all standards to all users. No login required, no personalization. In v1.0, the Auth Bridge adds: last-played badge, recommended topic highlight, locked/unlocked state per standard.
9. **Platform deep-linking**: The edukado.ai platform can link directly to `/play/5.3F` from a lesson page or teacher assignment. The student lands in-game with zero intermediate screens.
10. **Selector layout**: Cards arranged in a responsive CSS grid. Min card width 200px, max 2 columns on mobile, up to 3 on desktop. Each card shows: grade label, topic label, optional icon. No scores or progress in MVP.

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **Question Data Layer** | None at selector level. `standardId` is passed to the game component, which passes it to `fetchQuestion(standardId)` during `LOADING`. | Provides `standardId` prop to the game component. |
| **Game State Machine** | None — the selector exists outside the game's state machine scope. The state machine initializes when the game component mounts. | Mounts/unmounts the game component, which creates/destroys the state machine context. |
| **Score Card & Win State** | None directly. | Receives `navigate('/play')` from Score Card's "Change Topic" CTA via React Router. |
| **Platform Auth Bridge** (v1.0) | Reads student profile for last-played standard, recommended topics, unlock state. | None. |
| **React Router** | Reads URL params (`:standardId`). | Pushes `/play/:standardId` on card tap; pushes `/play` on "Change Topic". |

## Formulas

This system contains no mathematical formulas. It is a routing and UI selection layer. The only logic is:
- `standardId` string comparison for deep-link validation: `AVAILABLE_STANDARDS.find(s => s.standardId === param)`
- Grade grouping: `Object.groupBy(AVAILABLE_STANDARDS, s => s.gradeLabel)` (or equivalent reduce)

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| Deep link with invalid `standardId` (e.g., `/play/FAKE_ID`) | Redirect to `/play` with toast: "Topic not found — pick one below." | Invalid IDs must never reach the Question Data Layer. Fail at the gate. |
| Deep link with valid `standardId` but Question Data Layer returns 0 questions during `LOADING` | Game component handles this — transitions to `SCORE_CARD` with error flag (per State Machine edge case). Selector is not involved. | The selector's job ends when it passes a valid `standardId`. Fetch failures are the game's concern. |
| `AVAILABLE_STANDARDS` array is empty (no content processed yet) | Selector shows a message: "No topics available yet. Check back soon!" No cards rendered. No crash. | Defensive for early development and content pipeline bootstrapping. |
| Student navigates browser back from `/play/:standardId` mid-run | React Router unmounts game component. Student returns to selector (or previous platform page if they deep-linked). Run is lost — no partial save in MVP. | Standard SPA back-button behavior. The game is a micro-session; losing a 2-min run to back-button is acceptable. |
| Student refreshes `/play/:standardId` mid-run | Page reloads, game component re-mounts, `LOADING` state begins fresh with the same `standardId`. Previous run lost. | Same as page refresh edge case in State Machine GDD. Consistent behavior. |
| "Change Topic" tapped while game is in `LOADING` or `READY` (before any gates played) | `navigate('/play')` works identically. Game component unmounts, selector renders. No penalty, no tracking event. | Student changed their mind — let them go instantly. |
| Multiple rapid taps on different standard cards | Only the first `navigate('/play/:standardId')` fires. Subsequent taps are no-ops because the route has already changed and the selector is unmounting. | React Router's `navigate()` is synchronous; the component unmounts on the first call. |
| URL has query params from the platform (e.g., `/play/5.3F?assignmentId=abc`) | Selector ignores query params in MVP. `standardId` is read from the path param only. In v1.0, `assignmentId` is passed to the Outcome Tracking Bridge. | Keep MVP simple. Query params are a v1.0 integration concern. |

## Dependencies

| System | Direction | Nature of Dependency |
|---|---|---|
| **Question Data Layer** | Selector depends on (indirectly) | The `standardId` passed to the game must be valid for `fetchQuestion()`. The selector validates against `AVAILABLE_STANDARDS` which mirrors content pipeline output. |
| **React Router** | Selector depends on | Route matching, URL params, `navigate()` for transitions. Already in the platform. |
| **Score Card & Win State** | Score Card depends on Selector | Score Card's "Change Topic" navigates to the selector route. |
| **Platform Auth Bridge** (v1.0) | Selector depends on | Reads student profile for personalization. Not used in MVP. |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `SELECTOR_CARD_MIN_WIDTH` | 200px | 150–300px | Too few cards per row; excessive scrolling on mobile | Cards feel cramped; text truncates |
| `SELECTOR_MAX_COLUMNS` | 3 | 2–4 | Sparse layout on wide screens | Cards too wide on desktop |
| `INVALID_STANDARD_TOAST_DURATION` | 3s | 2–5s | Toast lingers too long after student has already picked a topic | Toast disappears before student reads it |

All values in `GAME_CONFIG`. No hardcoded layout constants.

## Acceptance Criteria

- [ ] `/play` renders the selector with all entries from `AVAILABLE_STANDARDS`
- [ ] Standards are grouped by `gradeLabel` with visible group headings
- [ ] Tapping a standard card navigates to `/play/:standardId` and mounts the game
- [ ] `/play/:standardId` with a valid ID skips the selector and mounts the game directly
- [ ] `/play/:standardId` with an invalid ID redirects to `/play` with an error toast
- [ ] Score Card "Change Topic" navigates to `/play` without full page reload
- [ ] Score Card "Play Again" stays on `/play/:standardId` — game resets, route unchanged
- [ ] Game component fully unmounts on "Change Topic" (all hooks reset, no memory leak)
- [ ] Selector is keyboard-navigable: Tab moves between cards, Enter selects
- [ ] Selector layout is responsive: 1 column on narrow mobile, up to `SELECTOR_MAX_COLUMNS` on desktop
- [ ] Empty `AVAILABLE_STANDARDS` shows a friendly message, not a blank screen or crash
- [ ] All layout constants read from `GAME_CONFIG` — zero hardcoded values

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should the selector show the student's last score per standard? | Emre | Defer to v1.0. Requires localStorage or Auth Bridge persistence. MVP selector is stateless. |
| Should teachers be able to hide/lock specific standards for their class? | Emre | Defer to v1.0. Requires Auth Bridge + teacher config. MVP shows all standards to everyone. |
| Route prefix — is `/play` correct, or does the platform use a different path convention? | Dev | Confirm with the existing edukado.ai router config before implementation. Use whatever prefix the platform already uses for feature pages. |
