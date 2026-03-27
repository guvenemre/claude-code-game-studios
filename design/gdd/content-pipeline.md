# Content Pipeline

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: One Click to Play

## Overview

The Content Pipeline is an offline developer tool — a Node.js script run from the command line before the game launches. It is not shipped as game code and has no runtime presence. Its job is to bridge the gap between raw DynamoDB question records and the game's quality bar: it reads every question in `MathCoach_Flexible_Questions`, applies the same validation logic the Question Data Layer will use at runtime, and produces an audit report identifying which questions are game-ready and which need manual attention. For MVP, the pipeline is read-only — it writes nothing to DynamoDB, it only reports. In v1.1, the pipeline gains a second mode: it generates MCQ distractors for intermediate solution steps (used by the multi-gate mechanic) and writes them back to DynamoDB as `stepDistractors[]` arrays. The pipeline is curriculum-agnostic: it operates on `standardId` as an opaque tag and has no knowledge of TEKS, Common Core, or any other curriculum standard.

## Player Fantasy

The developer runs the pipeline in 30 seconds and knows exactly where they stand. A green question pool means the game launches without surprise blank gates or broken MCQ options. A flagged question means a clear, actionable fix — not a runtime mystery. The pipeline serves the "One Click to Play" pillar: the student's seamless experience starts with the developer's confidence that every question in the pool is clean. Conversely, the pipeline's v1.1 distractor generation mode removes the biggest content bottleneck for multi-gate: instead of manually writing 3 wrong answers for each of 465 × ~4 intermediate steps (~1860 distractors), the pipeline generates them in a single run, reviewed once, then left to the database.

## Detailed Design

### Core Rules

1. The Content Pipeline is a Node.js CLI script. It is invoked as `node pipeline.js [mode] [options]`.
2. Two modes:
   - `audit` (MVP): Read-only scan. Validates all questions. Writes nothing to DynamoDB. Outputs a JSON report to `./pipeline-output/audit-report.json` and a summary to stdout.
   - `generate-distractors` (v1.1): Read + write. For each intermediate step without `stepDistractors[]`, calls Claude API to generate 3 wrong answers, then writes them back to the DynamoDB record.
3. **Validation rules** (applied identically in both `audit` mode and at runtime by the Question Data Layer). A question is `READY` if ALL of the following are true:
   - `confirmed: true`
   - `solutionSteps` array is present and has ≥ 1 entry
   - Every step has non-empty `description` (after trimming whitespace) AND non-empty `result`
   - Every step `description` is ≤ `MAX_STEP_CHARS` (600) characters
   - The final step's `options[]` array has 2–4 entries
   - Tier can be computed: either `difficulty` is a valid `"N/10"` string, OR `solutionSteps.length ≥ 2`
4. A question is `NEEDS_REVIEW` if it fails any validation rule. The report lists the specific rules that failed per question.
5. A question is `BLOCKED` if `confirmed: false`. Blocked questions are counted but not analyzed further.
6. The report groups questions by `standardId`. For each standard, it shows: total questions, READY count, NEEDS_REVIEW count, BLOCKED count, and pool sizes by tier (T1/T2/T3 READY count).
7. **Minimum pool warning**: Any `(standardId, tier)` combination with fewer than `MIN_POOL_SIZE` (5) READY questions is flagged as `POOL_INSUFFICIENT`. The game can technically run with 1 question but repetition becomes obvious fast.
8. **Distractor generation rules** (v1.1 `generate-distractors` mode):
   - Only generates distractors for steps that are `isActive: false` in the current MVP gate construction (i.e., steps 1 to n−1).
   - Generates exactly 3 distractors per step. Each distractor must: be mathematically plausible (common student errors — wrong operation, off-by-one, sign error), match the format of the correct answer (fraction → fraction, decimal → decimal), and be distinct from the correct answer and each other.
   - Writes distractors to the DynamoDB record as `solutionSteps[i].stepDistractors: string[]`.
   - Skips steps that already have `stepDistractors[]` (idempotent — safe to re-run).
   - Never overwrites a `stepDistractors[]` array that already exists unless `--force` flag is passed.
9. The pipeline authenticates using the AWS SDK default credential chain (same as the platform backend). No new credentials required.
10. The pipeline is idempotent in `audit` mode — running it multiple times produces the same report (assuming DynamoDB data is unchanged).

### Interactions with Other Systems

| System | Data flows in | Data flows out |
|---|---|---|
| **DynamoDB** (`MathCoach_Flexible_Questions`) | All question records (full scan) | In v1.1 mode: `stepDistractors[]` written back to each solutionStep |
| **Question Data Layer** | Pipeline validation rules are derived from QDL edge cases — same checks, run offline | No direct interface; QDL reads from DynamoDB which pipeline has validated |
| **Claude API** (v1.1 only) | Step `description` + `result` sent as prompt | 3 distractor strings returned per step |
| **Developer / CI** | Pipeline invoked manually or as pre-deploy check | `audit-report.json` + exit code (0 = all READY, 1 = any NEEDS_REVIEW or POOL_INSUFFICIENT) |

## Formulas

This system contains no mathematical formulas. Tier computation is a discrete lookup copied from the Question Data Layer (Core Rule 6) — the pipeline applies the same logic to flag questions where tier cannot be determined. No scaling curves, scoring functions, or derived stats.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|---|---|---|
| DynamoDB scan returns 0 questions | Pipeline exits with error: `"DynamoDB scan returned 0 results — check table name and region"`. No report written. | Almost certainly a configuration error (wrong region, wrong table name). Don't silently produce an empty report. |
| Question has `solutionSteps: []` (empty array) | Marked `NEEDS_REVIEW` with flag `EMPTY_STEPS`. | The QDL will skip this question at runtime; better to catch it pre-launch. |
| A step's `result` contains LaTeX or a math expression (e.g., `"\\frac{3}{4}"`) | Treated as valid — no format normalization. Character count measured on the raw string. | The display layer handles LaTeX rendering; the pipeline doesn't need to understand the math. |
| `difficulty` is `"10/10"` | Valid — maps to Tier 3. | Upper bound of the difficulty range. |
| `difficulty` is `"1/10"` | Flagged — maps to no tier (below Tier 1 threshold of 2/10). Marked `NEEDS_REVIEW` with flag `DIFFICULTY_OUT_OF_RANGE`. | Tier 1 starts at 2/10. A 1/10 question is either mis-tagged or too trivial for the game. |
| Claude API call fails during distractor generation (v1.1) | Skip that step, log the error with the question ID and step index, continue to the next step. Re-running the pipeline will retry skipped steps (they have no `stepDistractors[]` yet). | Transient API failures should not abort the entire pipeline run. |
| Claude API returns a distractor that matches the correct answer | Re-prompt once with explicit instruction. If second attempt still returns a duplicate, mark that step `DISTRACTOR_NEEDS_REVIEW` and skip writing — don't write known-bad distractors. | A distractor that is the correct answer would make the question unsolvable on non-final gates. |
| DynamoDB write fails during distractor generation (v1.1) | Log the failure with question ID, continue processing. Report all write failures at the end. | Partial completion is better than aborting — successfully generated distractors should be saved. |
| Pipeline run is interrupted mid-scan | Subsequent run starts a fresh full scan. `audit` mode is read-only and idempotent. `generate-distractors` mode skips already-written steps (idempotent). | No state file to manage; DynamoDB records are the source of truth for completion status. |

## Dependencies

This system is a **Pre-Production tool** with no upstream game-system dependencies. It reads from DynamoDB and optionally calls the Claude API. All game systems depend on the data quality it ensures, but none depend on the pipeline at runtime.

| System | Direction | Nature of Dependency |
|---|---|---|
| **DynamoDB** (`MathCoach_Flexible_Questions`) | Pipeline depends on it | Full table scan for `audit`; read + write for `generate-distractors`. The pipeline cannot run without DynamoDB access (AWS credentials + correct region). |
| **Question Data Layer** | This pipeline serves it | Validation logic is kept in sync with QDL's runtime checks. If QDL validation rules change, the pipeline must be updated to match. Neither system imports the other — the rules are duplicated by design (one offline, one runtime). |
| **Claude API** | Pipeline depends on it (v1.1 only) | `generate-distractors` mode requires an Anthropic API key via environment variable (`ANTHROPIC_API_KEY`). Not required for `audit` mode. |
| **Platform Backend API** | No dependency | The pipeline writes directly to DynamoDB; it does not call the platform API. The platform API is a runtime concern. |

## Tuning Knobs

All values are exported as named constants from `pipeline-config.js`. Changing any value requires no code changes.

| Parameter | Default | Safe Range | Effect of Too High | Effect of Too Low |
|---|---|---|---|---|
| `MAX_STEP_CHARS` | 600 | 280–800 | Long prompts crowd the gate UI; text overflows on small screens | Flags too many valid questions as needing review; increases manual editing burden |
| `MIN_POOL_SIZE` | 5 | 3–20 | High threshold flags standards with perfectly adequate pools; creates unnecessary editorial work | Pool too small = student sees the same questions repeatedly within a single session |
| `DISTRACTOR_COUNT` | 3 | 2–3 | N/A — QDL expects 3–4 options total (1 correct + 3 wrong = 4 choices max) | Fewer distractors = easier for students to guess; 2 distractors gives only 3 choices total |

## Acceptance Criteria

- [ ] `node pipeline.js audit` completes a full scan of `MathCoach_Flexible_Questions` and exits with code `0` (all READY) or `1` (any NEEDS_REVIEW or POOL_INSUFFICIENT)
- [ ] Output file `./pipeline-output/audit-report.json` is written after every successful `audit` run
- [ ] Each question in the report has a `status` of `READY`, `NEEDS_REVIEW`, or `BLOCKED`
- [ ] `NEEDS_REVIEW` entries include an array of specific failure flags (e.g., `["EMPTY_STEPS", "MISSING_OPTIONS"]`) — not just a generic "failed" marker
- [ ] Report includes per-standard pool summary: READY count by tier (T1/T2/T3) for every `standardId` in the dataset
- [ ] Standards with any `(standardId, tier)` combination below `MIN_POOL_SIZE` READY questions are flagged `POOL_INSUFFICIENT` in the report
- [ ] Running `audit` twice on the same DynamoDB data produces identical output (deterministic, idempotent)
- [ ] `audit` mode makes zero DynamoDB write calls (verifiable via AWS CloudTrail or local mock)
- [ ] A question with a step `description` of exactly 600 characters passes validation; a question with 601 characters is flagged `STEP_TOO_LONG`
- [ ] A question with `confirmed: false` is counted under `BLOCKED` and not analyzed for validation failures
- [ ] `node pipeline.js generate-distractors` (v1.1): writes `stepDistractors: string[3]` to each intermediate step that lacks it; skips steps that already have it
- [ ] Re-running `generate-distractors` with no `--force` flag does not overwrite existing `stepDistractors[]` arrays
- [ ] `generate-distractors` continues processing after a single Claude API failure — one failed step does not abort the run
- [ ] A distractor that duplicates the correct answer triggers a retry; if retry also duplicates, the step is marked `DISTRACTOR_NEEDS_REVIEW` and no write occurs
- [ ] All configurable constants are read from `pipeline-config.js` — zero hardcoded numeric values in the main pipeline script

## Open Questions

| Question | Owner | Resolution |
|---|---|---|
| Should the pipeline validate that `options[]` on the final step includes the correct `result` value? | Dev | Yes — add validation flag `OPTIONS_MISSING_CORRECT_ANSWER`. The QDL assumes `correctAnswer` is in `options[]`; the pipeline should enforce this pre-launch. |
| For v1.1 distractor generation: use Claude Haiku (cheap, fast) or Sonnet (higher quality)? | Emre | Defer to v1.1. Recommend starting with Haiku and reviewing output quality on a sample of 20 steps before committing to full run. |
| Should `audit` mode also check question text (`contextText` / problem statement) for length? | Dev | Not in MVP — the problem statement is shown on the READY preview card which has more space than a gate prompt. Revisit if display issues emerge in playtesting. |
