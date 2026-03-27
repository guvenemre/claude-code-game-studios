# Score Card & Win State

> **Status**: In Design
> **Author**: Emre + Claude
> **Last Updated**: 2026-03-26
> **Implements Pillar**: Reasoning Over Recall

## Overview

The Score Card is the end-of-run screen. It renders as a full-screen React component (replacing the canvas) when the State Machine enters `SCORE_CARD`. It shows the run outcome (WIN or GAME OVER), final score, accuracy (correct/total gates), shields remaining, and the best streak achieved during the run. On a WIN, a confetti animation plays via `canvas-confetti` (already in the platform's `package.json`). The screen has two CTAs: "Play Again" (restart the same standard + tier) and "Change Topic" (return to the Standard Selector). The Score Card reads from the Lives & Score System and the Socratic Step Sequencer — it writes nothing. It has no state of its own beyond what it reads from upstream hooks.

## Player Fantasy

The score card is a mirror, not a judge. On a WIN, the screen celebrates: confetti bursts, the score pulses in, and the student sees their accuracy front and center. It says "you reasoned through this." On a GAME OVER, the tone is warm, not punishing: "Great effort — you got X out of Y right. Try again?" The retry button is the largest element on the screen — the path back is always one tap away. The student never feels stuck or shamed. The "One Click to Play" pillar means the retry loop is instant: tap → LOADING → READY → RUNNING in under 2 seconds.

## Detailed Design

### Core Rules

[To be designed]

### Interactions with Other Systems

[To be designed]

## Formulas

[To be designed]

## Edge Cases

[To be designed]

## Dependencies

[To be designed]

## Tuning Knobs

[To be designed]

## Acceptance Criteria

[To be designed]

## Open Questions

[To be designed]
