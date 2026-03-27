# Systems Index: edukado Mini-Games (JetRun + Math Heist)

> **Status**: Approved
> **Created**: 2026-03-26
> **Last Updated**: 2026-03-26
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

JetRun is a 2D endless runner mini-game embedded in an existing React edtech platform (edukado.ai). The game's mechanical scope is intentionally lean — no physics engine, no inventory, no multiplayer. The core systems are a canvas-based runner loop, a math gate mechanic that interrupts the run with Socratic reasoning questions, and a curriculum-agnostic content layer that pipes question data from DynamoDB. The game is hosted as a React component (no separate game engine), which constrains both the tech choices and the system design. Systems are organized around two pillars: "Reasoning Over Recall" (every gate question is a meaningful reasoning step, not a random fact) and "One Click to Play" (no login wall, no install friction). Math Heist (v2) shares systems 6–16 with JetRun — its runner engine is replaced by a countdown-heist loop, but the content, progression, and platform integration layers are identical.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Game State Machine | Core | MVP | Designed | design/gdd/game-state-machine.md | — |
| 2 | Responsive Canvas Layout | Core | MVP | Designed | design/gdd/responsive-canvas-layout.md | — |
| 3 | Question Data Layer | Content | MVP | Designed | design/gdd/question-data-layer.md | — |
| 4 | Content Pipeline *(pre-prod tool, inferred)* | Content | Pre-MVP | Designed | design/gdd/content-pipeline.md | — |
| 5 | Runner Engine | Core | MVP | Designed | design/gdd/runner-engine.md | State Machine, Canvas Layout |
| 6 | Socratic Step Sequencer | Gameplay | MVP | Designed | design/gdd/socratic-step-sequencer.md | Question Data Layer |
| 7 | Lives & Score System | Gameplay | MVP | Designed | design/gdd/lives-and-score-system.md | State Machine |
| 8 | Math Gate System | Gameplay | MVP | Designed | design/gdd/math-gate-system.md | Runner Engine, Step Sequencer, Lives & Score |
| 9 | Score Card & Win State | UI | MVP | Not Started | — | Lives & Score, State Machine |
| 10 | Standard Selector & Game Route | UI | MVP | Not Started | — | Question Data Layer, Auth Bridge |
| 11 | Platform Auth Bridge *(inferred)* | Persistence | v1.0 | Not Started | — | — |
| 12 | Outcome Tracking Bridge | Persistence | v1.0 | Not Started | — | Auth Bridge, Lives & Score, Step Sequencer |
| 13 | Cosmetic Skin System | Progression | v1.0 | Not Started | — | Auth Bridge, Lives & Score |
| 14 | Sound System *(inferred)* | Audio | v1.0 | Not Started | — | State Machine |
| 15 | Tutorial System *(inferred)* | Meta | v1.0 | Not Started | — | Math Gate System, State Machine, Auth Bridge |
| 16 | Analytics / Event Tracking *(inferred)* | Meta | v2.0 | Not Started | — | State Machine, Auth Bridge |

---

## Categories

| Category | Description | Systems in This Game |
|----------|-------------|----------------------|
| **Core** | Foundation infrastructure everything depends on | State Machine, Canvas Layout |
| **Gameplay** | The systems that make the game fun | Runner Engine, Step Sequencer, Lives & Score, Math Gate |
| **Content** | Question data, curriculum config, content tooling | Question Data Layer, Content Pipeline |
| **Progression** | How the student grows over time | Cosmetic Skin System |
| **Persistence** | Auth, save state, outcome tracking | Platform Auth Bridge, Outcome Tracking Bridge |
| **UI** | Player-facing screens and input | Score Card, Standard Selector & Game Route |
| **Audio** | Sound effects | Sound System |
| **Meta** | Onboarding, analytics, teacher-facing tools | Tutorial System, Analytics / Event Tracking |

---

## Priority Tiers

| Tier | Definition | Target Milestone |
|------|------------|------------------|
| **Pre-MVP** | Offline tools needed before content can exist | Before first run |
| **MVP** | Required for the core loop to function and the hypothesis to be tested | Weeks 1–3 |
| **v1.0** | Full product — login, outcomes, cosmetics, sound, onboarding | Weeks 4–7 |
| **v2.0** | Growth and analytics layer | Week 8+ |

---

## Dependency Map

### Foundation Layer (no dependencies)

1. **Game State Machine** — All game behavior is driven by state transitions; nothing can animate, respond, or trigger without knowing the current state
2. **Responsive Canvas Layout** — The canvas element must be sized and mounted before any pixel is drawn
3. **Platform Auth Bridge** — Guest vs. logged-in context is needed by persistence, progression, and analytics systems; reads from the existing edukado.ai auth context (already in platform)
4. **Question Data Layer** — Pure DynamoDB fetch + normalization; no game knowledge required

### Core Layer (depends on Foundation)

1. **Runner Engine** — depends on: Canvas Layout, State Machine
2. **Socratic Step Sequencer** — depends on: Question Data Layer
3. **Lives & Score System** — depends on: State Machine
4. **Sound System** — depends on: State Machine
5. **Analytics / Event Tracking** — depends on: State Machine, Auth Bridge
6. **Standard Selector & Game Route** — depends on: Question Data Layer, Auth Bridge

### Feature Layer (depends on Core)

1. **Math Gate System** — depends on: Runner Engine, Socratic Step Sequencer, Lives & Score System, Sound System
2. **Score Card & Win State** — depends on: Lives & Score System, State Machine
3. **Outcome Tracking Bridge** — depends on: Platform Auth Bridge, Lives & Score System, Socratic Step Sequencer
4. **Cosmetic Skin System** — depends on: Platform Auth Bridge, Lives & Score System

### Polish Layer (depends on Feature)

1. **Tutorial System** — depends on: Math Gate System, State Machine, Platform Auth Bridge

### Pre-Production (not shipped as game code)

1. **Content Pipeline** — Offline Node.js/Python script that reads from DynamoDB, normalizes solution steps to game-safe length, pre-generates MCQ distractors for intermediate steps, and outputs a static JSON bundle consumed by Question Data Layer

---

## Recommended Design Order

Design these in order. Systems at the same layer with no mutual dependencies can be designed in parallel.

| Order | System | Priority | Layer | Est. Effort | Notes |
|-------|--------|----------|-------|-------------|-------|
| 1 | **Game State Machine** | MVP | Foundation | S | Design first — all other systems reference its states |
| 2 | **Question Data Layer** | MVP | Foundation | S | Define the data contract the game expects; unblocks Content Pipeline and Step Sequencer |
| 3 | **Content Pipeline** | Pre-MVP | Pre-prod | M | Build the offline tool that fills the data layer with real content |
| 4 | **Responsive Canvas Layout** | MVP | Foundation | S | Simple but must be decided before Runner Engine is touched |
| 5 | **Runner Engine** | MVP | Core | M | Highest-effort MVP system; canvas loop, character, scrolling, obstacles |
| 6 | **Socratic Step Sequencer** | MVP | Core | S | Loads steps from Question Data Layer, sequences them for the run |
| 7 | **Lives & Score System** | MVP | Core | S | Shields, scoring, streak multiplier — straightforward rules |
| 8 | **Math Gate System** | MVP | Feature | M | The defining mechanic; gate spawn, question overlay, timer, answer, feedback |
| 9 | **Score Card & Win State** | MVP | Feature | S | End-of-run screen; confetti, accuracy, retry CTA |
| 10 | **Standard Selector & Game Route** | MVP | Feature | S | React route + URL params; minimal UI for MVP (one standard hardcoded) |
| 11 | **Platform Auth Bridge** | v1.0 | Foundation | S | Reads existing edukado auth context; thin wrapper |
| 12 | **Outcome Tracking Bridge** | v1.0 | Feature | S | POST run data to existing platform API |
| 13 | **Sound System** | v1.0 | Core | S | Web Audio API; 4–5 sound effects |
| 14 | **Cosmetic Skin System** | v1.0 | Feature | M | Sprite swap + unlock logic + skin selector UI |
| 15 | **Tutorial System** | v1.0 | Polish | S | First-run tutorial gate; no timer; mechanic explanation overlay |
| 16 | **Analytics / Event Tracking** | v2.0 | Meta | M | Event schema + integration with analytics provider |

*Effort: S = 1 design session · M = 2–3 sessions · L = 4+ sessions*

---

## Circular Dependencies

None found. The dependency graph is a clean DAG (directed acyclic graph).

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| **Game State Machine** | Design | Getting states/transitions wrong cascades to 9 dependent systems. A missing state (e.g., "gate-resolving" between Gate and Running) causes bugs everywhere. | Design all states and transitions explicitly before writing any game code. Prototype on paper first. |
| **Runner Engine** | Technical | 60fps canvas animation in React without layout thrashing. Older school Chromebooks may drop frames. requestAnimationFrame + React reconciliation can conflict. | Benchmark on low-end Chromebook early. Use a single canvas ref outside React's render cycle. |
| **Math Gate System** | Design | The "world slows to 30%" mechanic is unvalidated. Wrong pacing = breaks urgency OR makes question unreadable. | Prototype this mechanic first. Test with 2–3 real Grade 5 students before locking the design. |
| **Content Pipeline** | Scope | Someone must review, normalize, and tag all 465 existing questions for game-safe display. This is the largest non-code time investment before MVP. | Start with one standard (Grade 5 fractions, ~10 questions) for MVP. Pipeline the rest iteratively. |
| **Responsive Canvas Layout** | Technical | Canvas hitboxes must not distort across Chromebook, iPad, and mobile resolutions. Wrong scaling = students tapping the wrong answer button. | Define a fixed logical resolution (e.g., 800×450) and scale uniformly. Test on all target device sizes early. |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 16 |
| Design docs started | 8 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| MVP systems designed | 7 / 10 |
| v1.0 systems designed | 0 / 5 |

---

## Next Steps

- [ ] Design **Game State Machine** first (`/design-system game-state-machine`) — unblocks everything else
- [ ] Design **Question Data Layer** in parallel or immediately after — defines the data contract
- [ ] Build **Content Pipeline** offline tool to normalize Grade 5 fraction questions for MVP
- [ ] Prototype **Runner Engine** + **Math Gate System** together (`/prototype runner-loop`) — validates the highest-risk mechanic before full GDD investment
- [ ] Run `/design-review design/gdd/systems-index.md` to validate completeness
- [ ] Run `/gate-check pre-production` when all MVP system GDDs are approved
