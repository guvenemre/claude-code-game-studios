# Question Data Layer

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Curriculum-Agnostic Core

## Overview

The Question Data Layer is the game's content gateway. It abstracts the DynamoDB question database behind a single clean interface, transforming raw question records (with their Socratic solution steps) into a standardized game-ready format that the rest of the game consumes without any knowledge of how the data is stored. It is called once per run during the `LOADING` state, returns a fully prepared `GameQuestion` object, and is otherwise invisible. The system is curriculum-agnostic by design: it accepts a standard ID and tier as runtime parameters — it has no hardcoded knowledge of TEKS, Common Core, or any curriculum.

## Player Fantasy

Infrastructure the student never thinks about. What they feel is the absence of waiting — the game loads fast, the question feels fresh each run, and the content is always appropriate to their grade and skill level. The system serves the "One Click to Play" pillar: a guest student who shares a link to a specific standard should experience a sub-2-second load before their first gate appears.

## Detailed Design

### Core Rules

1. The Question Data Layer exposes a single async function: `fetchGameQuestion(standardId, tier)`. This is the only public interface.
2. `standardId` is a string (e.g., `"M.5.3"`, `"CCSS.MATH.5.NF.A.1"`). It has no curriculum semantics — it is treated as an opaque filter key.
3. `tier` is an integer: `1`, `2`, or `3`. If omitted, defaults to `1`.
4. The function calls the existing platform backend API (`/api/game/question?standard=X&tier=Y`) — never DynamoDB directly. This keeps AWS credentials server-side and is consistent with the existing platform security model.
5. The backend selects **one question at random** from all confirmed (`confirmed: true`) questions tagged with the given `standardId` whose computed tier matches the requested tier.
6. **Tier computation** (server-side, applied in order):
   - If `difficulty` field is present and not `"N/A"`: `2/10`–`3/10` → Tier 1, `4/10`–`6/10` → Tier 2, `7/10`–`10/10` → Tier 3.
   - If `difficulty` is `"N/A"` or absent: fall back to step count — 2–3 steps → Tier 1, 4–5 steps → Tier 2, 6+ steps → Tier 3.
7. The backend transforms the raw DynamoDB record into a `GameQuestion` object before responding. The game component never sees raw DynamoDB records.
8. On network failure, the client retries up to 3 times with exponential backoff (500ms, 1000ms, 2000ms). On third failure, throws `GameLoadError`. The State Machine catches this and routes to `SCORE_CARD` with an error message.
9. **Session cache**: The backend response (pool of questions for a given `standardId + tier`) is cached in browser memory for the duration of the session. Subsequent calls to `fetchGameQuestion` with the same params draw a new random question from the cached pool without a network call. Cache is cleared on page refresh.
10. Cache holds at most `QUESTION_CACHE_SIZE` (20) questions per `(standardId, tier)` pair. If more than 20 questions exist, only 20 are fetched and cached.

### Data Schemas

**Public interface:**
```typescript
fetchGameQuestion(standardId: string, tier?: 1 | 2 | 3): Promise<GameQuestion>
```

**`GameQuestion` — the game-ready format returned to all consumers:**
```typescript
interface GameQuestion {
  id: string;          // DynamoDB question UUID — used by Outcome Tracking Bridge
  standardId: string;  // e.g., "M.5.3.A" — opaque tag, no curriculum semantics in game
  grade: number;       // Derived: M.5.x → 5; or from DynamoDB grade field if set
  tier: 1 | 2 | 3;    // Computed tier (see Core Rule 6)
  contextText: string; // Full problem statement shown on READY preview card and as gate context
  gates: GameGate[];   // Ordered gate questions for the run (length = total gate count)
}

interface GameGate {
  gateIndex: number;    // 0-based position in the gate sequence
  isActive: boolean;    // true = displayed as an answerable gate; false = shown as hint text only
  stepNumber: number;   // Source step number from solutionSteps (for outcome tracking)
  prompt: string;       // Question text shown to student (from solutionStep.description)
  correctAnswer: string;// Correct answer text
  options: string[];    // 3–4 shuffled choices including correctAnswer
  reasoning: string;    // Explanation shown after gate resolves (from solutionStep.reasoning)
  isFinalGate: boolean; // true for the last gate in sequence
}
```

**Gate construction — MVP (Option A: final gate only):**
- All steps become `GameGate` entries in order.
- Steps 1 to (n−1): `isActive: false`. Shown as hint text in the gate lead-up UI.
- Step n (final): `isActive: true`, `isFinalGate: true`. Options come from the DynamoDB question's `options` array (A/B/C/D already present).
- Result: every run has exactly 1 active gate regardless of how many steps the question has.

**Gate construction — v1.1 (Option B: multi-gate):**
- Steps whose `result` is a numeric value or simple expression become `isActive: true` with distractors pre-generated by the Content Pipeline and stored as `stepDistractors` in DynamoDB.
- Reasoning/setup steps without clean answer values remain `isActive: false`.
- The final step is always `isActive: true`, `isFinalGate: true`.

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **Platform Backend API** | `standardId`, `tier` as query params | Raw DynamoDB question record (one, randomly selected) |
| **State Machine** | `GameLoadError` on fetch failure → routes `LOADING` to `SCORE_CARD` | `LOADING` → `READY` transition triggered on successful fetch |
| **Socratic Step Sequencer** | Receives `GameQuestion` (full object) | Sequences `gates[]` array into timed gate events during run |
| **Standard Selector & Game Route** | `standardId` + `tier` from URL params; calls `fetchGameQuestion` | Returns `GameQuestion` to mount the game |
| **Outcome Tracking Bridge** | Reads `question.id` and `question.standardId` from the in-memory `GameQuestion` | No writes |

## Formulas

This system contains no mathematical formulas. Tier assignment is a discrete lookup (defined in Core Rule 6): difficulty string → tier integer, with a step-count fallback. There is no continuous function, scaling curve, or derived stat. The session cache size (`QUESTION_CACHE_SIZE = 20`) is a fixed constant, not a formula.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| No questions exist for `standardId + tier` | `fetchGameQuestion` throws `GameLoadError` with message `"No questions available for this standard and tier"`. State Machine routes to `SCORE_CARD` with error. | Empty pool is indistinguishable from a fetch failure from the game's perspective. No silent fallback to a different tier — that would silently serve wrong-difficulty content. |
| `standardId` is valid but all questions for that tier have `confirmed: false` | Same as empty pool — `GameLoadError` thrown. | Unconfirmed questions are excluded server-side. The game never sees them. |
| `difficulty` field is present but not in the expected `"N/10"` format (e.g., `"hard"`, `""`, `null`) | Treat as `"N/A"` — fall through to step-count tier computation. | Defensive; malformed difficulty data should degrade gracefully, not crash. |
| A `solutionStep` has an empty `description` or `result` | Skip that step when constructing `gates[]`. If skipping leaves zero active gates, throw `GameLoadError`. | Empty prompts render as blank UI. Better to fail loudly than to show a broken gate. |
| `solutionSteps` array has only 1 step | Single step becomes the final gate (`isActive: true`, `isFinalGate: true`). No inactive hint steps. Still a valid run. | A 1-step question is unusual but valid — the Socratic preview card shows the problem context instead. |
| Backend returns a question where `options` array has fewer than 2 entries | Throw `GameLoadError` — a gate with 0 or 1 options can't be presented as MCQ. | Content pipeline should prevent this, but the client must never render a broken gate. |
| `fetchGameQuestion` called with the same `standardId + tier` while a fetch is already in-flight | Queue the second call; resolve both from the same response. Do not fire two parallel network requests. | Prevents duplicate fetches if two components mount simultaneously. |
| Cache is full (20 questions) and all have been shown in this session | Loop from the beginning of the cached pool. Reshuffle before looping if > 1 question exists. | Students on long sessions should still get variety, not a hard stop. |
| `grade` cannot be derived from `standardId` format and no `grade` field exists in DynamoDB record | Default to `grade: 0`. Downstream systems using grade for cosmetics must treat `0` as "unknown grade" and apply a neutral theme. | Grade is used for visual theming only — failing to load over a missing grade field would be disproportionate. |

## Dependencies

This system is a **Foundation-layer** system with no upstream game-system dependencies. It depends on the platform backend API (external). All dependency arrows point outward.

| System | Direction | Nature of Dependency |
|---|---|---|
| **Platform Backend API** | This system depends on it | `fetchGameQuestion` calls `/api/game/question` — the backend owns DynamoDB access, tier computation, and random selection. If the API is unavailable, the game cannot load. |
| **Game State Machine** | Depends on this (indirectly) | `LOADING` state triggers `fetchGameQuestion`. `GameLoadError` thrown here routes the state machine to `SCORE_CARD` with an error flag. |
| **Socratic Step Sequencer** | Depends on this | Receives the `GameQuestion` object (specifically the `gates[]` array) and sequences it into timed gate events during the run. |
| **Standard Selector & Game Route** | Depends on this | Extracts `standardId` and `tier` from URL params and passes them as arguments to `fetchGameQuestion`. The route component is the call site for this layer. |
| **Outcome Tracking Bridge** | Depends on this | Reads `question.id` and `question.standardId` from the in-memory `GameQuestion` object after the run completes. No writes. |
| **Math Gate System** | Depends on this (transitively via Step Sequencer) | Consumes individual `GameGate` objects as sequenced by the Step Sequencer. Does not call `fetchGameQuestion` directly. |

## Tuning Knobs

All values are exported from `GAME_CONFIG`. Retry delays follow `BASE_MS × 2^(attempt−1)`: attempt 1 = 500ms, attempt 2 = 1000ms, attempt 3 = 2000ms.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `QUESTION_CACHE_SIZE` | 20 | 5–50 | More questions cached = more memory per session; negligible in practice since questions are small JSON objects | Too few = network calls mid-session if pool is large; cache exhausted quickly on long sessions |
| `FETCH_RETRY_COUNT` | 3 | 1–5 | More retries = longer wait on total network failure before error shown | 1 retry = flaky school WiFi causes unnecessary load failures |
| `FETCH_RETRY_BASE_MS` | 500ms | 200–2000ms | First retry too slow; student sees spinner too long | Hammers the server too fast; no recovery window for transient errors |
| `FETCH_RETRY_MAX_MS` | 2000ms | 1000–5000ms | Student waits up to 2×max on full failure (2 retries × max delay) before error | Retries fire too fast; exponential backoff loses its value |

## Acceptance Criteria

- [ ] `fetchGameQuestion(standardId, tier)` returns a `GameQuestion` object that validates against the TypeScript interface (all required fields present, correct types)
- [ ] `fetchGameQuestion` called with a valid `standardId + tier` combination returns a different question on successive calls (if pool size > 1)
- [ ] A second call with the same `standardId + tier` does NOT fire a second network request (served from cache)
- [ ] Cache is empty after page refresh — confirmed by intercepting network: first call post-refresh fires a request; same call pre-refresh does not
- [ ] On network failure, `fetchGameQuestion` retries exactly `FETCH_RETRY_COUNT` times before throwing `GameLoadError` (verifiable via network throttle + request count)
- [ ] Retry delays match exponential backoff: ~500ms before retry 1, ~1000ms before retry 2, ~2000ms before retry 3 (±100ms tolerance)
- [ ] `GameLoadError` thrown by `fetchGameQuestion` causes the State Machine to route `LOADING` → `SCORE_CARD` with an error message (not a blank screen or crash)
- [ ] MVP gate construction: for a question with N steps, `gates[]` has length N; exactly 1 gate has `isActive: true` (the final step); all others have `isActive: false`
- [ ] `gates[final].isFinalGate` is `true`; all other gates have `isFinalGate: false`
- [ ] `gates[].options` contains the correct answer plus 2–3 distractors; `correctAnswer` matches exactly one entry in `options`
- [ ] `grade` field correctly derived from `standardId` format (`M.5.x` → grade 5, `M.3.x` → grade 3, etc.)
- [ ] A `standardId + tier` combination with zero confirmed questions throws `GameLoadError` with message `"No questions available for this standard and tier"` — not a generic network error
- [ ] `solutionStep` with empty `description` or `result` is skipped in gate construction — it does not appear as a gate in `gates[]`
- [ ] Cache pool loops (with reshuffle) after all questions have been shown — no hard stop at end of pool
- [ ] All retry/cache constants are read from `GAME_CONFIG` — zero hardcoded numeric values in the fetch function

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should the backend API endpoint return the full question pool (up to 20) in a single call, or return one question at random per call? | Dev | Return the full pool in one call — enables client-side session cache and avoids a network round-trip per run. Backend selects up to `QUESTION_CACHE_SIZE` random confirmed questions matching `standardId + tier`. |
| For v1.1 multi-gate (Option B): where are intermediate step distractors stored and who generates them? | Content / Dev | Pre-generated by the Content Pipeline and stored as `stepDistractors[]` per solutionStep in DynamoDB. The Question Data Layer reads them as-is — no distractor generation at runtime. |
