# Game Concept: edukado Mini-Games — JetRun & Math Heist

*Created: 2026-03-26*
*Status: Draft*

---

## Elevator Pitch

> **JetRun**: An endless runner where students solve Socratic-step math questions at each gate — answer correctly to smash through and keep running, building genuine problem-solving intuition one step at a time.
>
> **Math Heist** *(v2)*: A heist puzzle game where math questions are the security locks — crack every door before the alarm triggers to steal the treasure.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Edtech mini-game / Endless runner (JetRun); Puzzle-heist (Math Heist) |
| **Platform** | Web browser (React + HTML5 Canvas) — desktop-first, tablet-compatible |
| **Target Audience** | Students grades 3–8 (ages 8–14), deployed via edukado.ai |
| **Player Count** | Single-player (v1); class leaderboard mode (v2) |
| **Session Length** | 2–3 minutes per run (micro-session design) |
| **Monetization** | Gated behind edukado.ai subscription (existing model) |
| **Estimated Scope** | JetRun MVP: Small (2–3 weeks solo); Full suite: Medium (3–6 months) |
| **Comparable Titles** | ST Math (spatial math + mastery-gating), Blooket (quiz + mini-games), Geometry Dash (runner + mastery loop) |

---

## Core Fantasy

**JetRun**: *"I am fast, I am sharp, and math can't stop me."*
The student feels like a problem-solving machine — not someone who is being tested, but someone who is too clever for every obstacle the world throws at them. Every gate smashed open is a small proof of intelligence, not a checkbox on a worksheet.

**Math Heist**: *"I am the genius who can crack any code."*
Math stops being homework and becomes a superpower. You're not answering questions — you're dismantling security systems with your brain. The reframe matters: the same multiplication problem that feels like drudgery on a worksheet feels like hacking when it opens a vault door.

---

## Unique Hook

**JetRun**: Like Geometry Dash, AND ALSO each question is a *Socratic reasoning step* — so completing a run means you actually solved a real STAAR/standardized test problem through guided reasoning, not just recalled an isolated fact.

**Math Heist**: Like Among Us' tension, AND ALSO the math IS the hacking mechanic — wrong answers don't just cost points, they trigger the alarm and change the game state.

The shared hook across both games: **the game mechanic IS the pedagogy**. The Socratic step structure (borrowed from the platform's existing tutoring system) turns game play into scaffolded problem-solving — students build mathematical reasoning, not just answer recognition.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Challenge** (mastery, obstacle course) | 1 | Mastery-gated progression per standard; difficulty tiers within each standard |
| **Sensation** (sensory pleasure, feel) | 2 | Satisfying gate-smash animation; confetti on win; speed boost on correct streak |
| **Fantasy** (role-playing, make-believe) | 3 | Grade-scaled character skins and world themes; "you're a hacker / explorer / astronaut" framing |
| **Submission** (low-stress comfort loop) | 4 | 2–3 min micro-sessions; failure is funny not punishing; retry is instant |
| **Discovery** | 5 | Unlockable cosmetic skins; harder difficulty tiers revealed on completion |
| **Narrative** | N/A | Minimal story — the world theme is flavor, not plot |
| **Fellowship** | N/A | v1 solo only; class leaderboard planned for v2 |
| **Expression** | N/A | Cosmetic skins serve expression needs without requiring a creation system |

### Key Dynamics (Emergent behaviors we want)

- Students naturally replay a run to beat their previous score (self-competition)
- Students pay attention to *which step* they missed and think about why (Socratic reflection)
- Students ask to play "one more run" because 2–3 minutes feels completable, not daunting
- Teachers assign specific standards and track which steps students consistently miss
- Students unlock a new skin and show it to friends (social proof / identity expression)

### Core Mechanics

1. **Auto-runner loop** — character runs automatically; the student's only job is to answer math questions correctly
2. **Math Gate system** — every 15–20 seconds, a gate appears with one Socratic step question; correct = smash through; wrong = stumble, lose a shield
3. **Socratic step sequencing** — each run corresponds to one standardized test problem decomposed into 3–5 scaffolded reasoning steps pulled from the platform's existing solution-step data
4. **Cosmetic skin system** — one universal world/character base; grade-band skins (3–4, 5–6, 7–8) unlocked by completing runs; visual complexity scales with grade level
5. **Outcome tracking bridge** — run completion and per-step accuracy feed into the platform's existing learning outcome and standard mastery tracking

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Competence** (mastery, skill growth) | Mastery-gated tiers per standard; score shows improvement over time; per-step accuracy is trackable | Core |
| **Autonomy** (freedom, meaningful choice) | Student chooses which standard to practice; cosmetic skin choice; retry immediately without penalty | Supporting |
| **Relatedness** (connection, belonging) | v1: connection to the edukado platform identity; v2: class leaderboard, teacher-assigned challenges | Minimal (v1) → Supporting (v2) |

### Player Type Appeal

- [x] **Achievers** — Standard mastery badges, tier completion, score maximization
- [ ] **Explorers** — Limited in v1; cosmetic unlocks provide a small discovery loop
- [ ] **Socializers** — v2 class leaderboard; v1 is solo
- [x] **Competitors** — Personal score record; potential class ranking in v2

### Flow State Design

- **Onboarding**: First run uses Grade 5 fractions (or detected student grade level), easiest difficulty tier. Tutorial gate appears at run start with a sample question and 0 time pressure to teach the mechanic. Normal timer starts from gate 2.
- **Difficulty scaling**: Three tiers per standard. Tier 1 = foundational steps (identify the operation, set up the problem). Tier 2 = intermediate steps (execute with one complexity). Tier 3 = full STAAR-level reasoning chain. Students must complete Tier 1 to unlock Tier 2.
- **Feedback clarity**: Immediate visual/audio feedback per gate (smash animation + chime vs. stumble animation + thud). End-of-run score card shows per-step accuracy. Platform dashboard shows standard-level progress.
- **Recovery from failure**: Instant retry. No wait screen, no "sorry" message. Failure state = character stumbles, shield depletes — funny, quick, not shaming. Game over state = 3-second score flash, then "Play Again" is the primary CTA.

---

## Core Loop

### Moment-to-Moment (30 seconds)

Character auto-runs through a scrolling world. The student watches the environment stream by (sensation, anticipation). A Math Gate appears — the world slows to 30% speed (preserves urgency without making the question unreadable). A Socratic step question appears as a concise text prompt with 3–4 answer choices. Student taps/clicks their answer. Gate smashes open (correct) or character stumbles (wrong). Full speed resumes.

*This loop must be satisfying in isolation — the visual feedback of smashing through a gate with a speed boost is the intrinsic reward, independent of any score or progression system.*

### Short-Term (one 2–3 minute run)

One run = one standardized problem decomposed into 3–5 Socratic steps. Run structure:
- Gates 1–2: Comprehension steps ("What does the problem ask us to find?")
- Gates 3–4: Reasoning steps ("Which operation? What's the intermediate result?")
- Gate 5: Synthesis step ("Final answer")

Completion = score card with accuracy percentage, time, and streak multiplier. One optional "bonus gate" at the end (harder version of a step, worth 2× points) creates "one more try" psychology.

### Session-Level (a single student session)

A student session typically = 2–5 runs on the same or adjacent standards. Natural stopping point: completing a standard's Tier 1 ("Mastered Tier 1" badge appears). Natural return hook: "You're 1 run away from unlocking Tier 2" or a new cosmetic skin threshold.

### Long-Term Progression

Each curriculum standard has 3 tiers. Complete all 3 tiers = standard "Mastered" badge, feeds into platform outcome tracking. Cosmetic skin unlocks at milestone run counts (5 runs, 25 runs, etc.). Standard mastery maps directly to the platform's existing grade-level curriculum map — students can see their entire grade's standards light up as they play.

### Retention Hooks

- **Curiosity**: Locked Tier 2/3 visible but not playable — "complete Tier 1 to unlock"
- **Investment**: Mastery badges accumulate on the platform profile; students don't want to lose their streak
- **Mastery**: Personal best score per standard; trying to perfect-run (8/8 first try) a tier
- **Social (v2)**: Class leaderboard; teacher-assigned "standard of the week" challenge

---

## Game Pillars

### Pillar 1: Reasoning Over Recall

The game teaches HOW to solve, not just WHAT the answer is. Every question is a reasoning step, not a fact retrieval.

*Design test: A feature proposes showing "quick drill" random multiplication facts as filler gates between Socratic steps. This pillar says NO — every gate must be a meaningful step in solving a real problem.*

### Pillar 2: Urgency Without Anxiety

Time pressure creates excitement, not stress. Failure is funny, fast, and immediately reversible. The student never feels dumb.

*Design test: The timer runs out and the question is marked wrong. This pillar says the failure animation must be a comedic stumble with an upbeat sound, and the retry button must appear within 1 second.*

### Pillar 3: Curriculum-Agnostic Core

Standards are metadata. The game engine has zero knowledge of TEKS, Common Core, or any specific curriculum. Swapping curricula = config change, not code change.

*Design test: A feature request arrives to add a "TEKS 5.3B" label inside the game UI. This pillar says no — expose the standard label in the platform dashboard, not in the game itself.*

### Pillar 4: One Click to Play

Zero install, zero login required for a guest run. A student can share a link and a friend plays immediately. Login unlocks persistence and outcomes tracking, but is never a gate to the first experience.

*Design test: We consider requiring login before the first run to capture more data. This pillar says NO — guest runs are always available, login prompt appears only after run completion.*

### Anti-Pillars

- **NOT a flashcard drill**: Random isolated facts are explicitly excluded. Every question sequence tells a coherent problem-solving story.
- **NOT a full game engine**: No Phaser.js, Godot, or Unity. Games are React components with HTML5 Canvas. This keeps the bundle size small and integration trivial.
- **NOT multiplayer-first**: Social features (leaderboards, class challenges) are v2 additions. The core experience is single-player and self-contained.
- **NOT curriculum-specific**: No TEKS or Common Core branding inside game code. Standards are injected as data at runtime.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| **ST Math** | Visual feedback IS the teaching; mastery-gating; JiJi emotional anchor | We use Socratic text steps + existing question data rather than visual puzzles; our character is cosmetic, not pedagogically load-bearing | Proves that game mechanic ↔ math teaching is possible and produces real learning outcomes |
| **Geometry Dash** | One-tap mastery loop; short sessions; brutal-but-fair retry; cult status with 10–14 year olds | We replace rhythm timing with reasoning steps; failure is gentler | Proves that simple one-action games build intense engagement with this demographic |
| **Blooket** | Every student has their own game screen (vs. Kahoot spectating); quiz content injected into mini-game shells | We own the question data and the game — no third-party platform dependency | Proves the "quiz inside a game shell" model has strong classroom adoption |
| **Duolingo** | Daily streak mechanics; loss-aversion psychology; micro-session design (2–5 min) | We target classroom deployment (teacher-assigned) as primary channel, not just habit formation | Proves 2–3 minute sessions can sustain daily engagement and measurable learning |

**Non-game inspirations**: Socratic method (Plato) — guide students to the answer through questions, never just hand it to them. The solution-step data already in the edukado.ai backend is the Socratic tutor; the game is the delivery mechanism.

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 8–14 (Grades 3–8) |
| **Gaming experience** | Casual to mid-core mobile gamers |
| **Time availability** | 5–15 minute homework/practice sessions; classroom transitions (2–3 min) |
| **Platform preference** | School Chromebook or iPad (browser); personal phone (mobile web) |
| **Current games they play** | Roblox, Brawl Stars, Geometry Dash, Blooket (in-class), Coolmath Games (school filter bypass) |
| **What they're looking for** | Feeling smart and fast; something that doesn't feel like homework |
| **What would turn them away** | Slow load times; login walls before first play; punishing failure states; visually dated or "babyish" UI; questions that feel disconnected from real schoolwork |

**Secondary target: Teachers**
Teachers deploy the game as a supplemental practice tool. Their needs: easy assignment (link to specific standard), reportable outcomes (existing platform dashboard), no setup friction, works on school devices without install.

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Technology** | React + HTML5 Canvas + requestAnimationFrame. No separate game engine. Games are React components embedded in the existing Vite/React app. |
| **Key Technical Challenges** | (1) Smooth 60fps canvas animation in React without layout thrashing; (2) graceful question overlay on top of running canvas without breaking game state; (3) mobile-responsive canvas sizing |
| **Art Style** | 2D flat/cartoon. Chunky characters, bright saturated palette. Grade 3–4: cute/round. Grade 7–8: sleek/angular. One base character, multiple cosmetic skins. |
| **Art Pipeline Complexity** | Low — sprite sheets + CSS variable theming for color palette swaps. Minimal custom art required for MVP (can use freely licensed sprite assets). |
| **Audio Needs** | Minimal — Web Audio API for 4–5 sound effects (gate smash, stumble, run loop, win chime). No music required for MVP. |
| **Networking** | None (v1). Backend integration via existing edukado.ai API for outcome tracking. |
| **Content Volume** | MVP: 1 standard × 3 tiers × ~5 questions per tier = 15 question sets. Full Grades 3–8: ~70 standards × 3 tiers = 210 question sets (sourced from existing S3 library + solution step data). |
| **Curriculum Integration** | Standards injected as JSON config at runtime. Question sets tagged with standard ID, grade, difficulty tier, and curriculum type (TEKS / Common Core / AZ / FL / IB-PYP / IB-MYP). Game engine reads only grade + difficulty + question text — zero curriculum knowledge. |
| **Existing Assets to Leverage** | S3 question image library (TEKS/STAAR), solution step data (Socratic sequences), DragAndDropRenderer, canvas-confetti, existing question/outcome API, react-router-dom routing |

---

## Risks and Open Questions

### Design Risks

- **Socratic step quality**: If the existing solution steps are too long or complex for in-game display, they need a condensed "game-safe" version. A question that takes 30 seconds to read breaks the urgency pillar.
- **Grade 3 readability**: Simple enough for 8-year-olds? The gate question and 3 answer choices must be legible and understandable without teacher help.
- **Math complexity vs. game pacing**: Higher-grade standards (Grade 8 algebra) may have reasoning chains longer than 5 steps — pacing could break.

### Technical Risks

- **Canvas performance on Chromebooks**: Older school-issued Chromebooks may struggle with 60fps canvas animation. Needs profiling on low-end hardware.
- **Image questions in-game**: Full STAAR image questions (with diagrams) are too large to display during a fast runner. Solution: Socratic step questions are always short text — the full STAAR image is reserved for the post-run "review" screen.
- **Mobile canvas sizing**: Canvas must resize correctly across iPad, phone, and Chromebook without distorting game hitboxes.

### Market Risks

- **Blooket/Prodigy incumbency**: Both are free-to-play with large installed bases. edukado.ai's differentiator is (1) Socratic reasoning steps (not just answer drills) and (2) direct STAAR alignment — these must be communicated clearly to teachers.
- **Teacher adoption friction**: Teachers adopt edtech through word-of-mouth from other teachers. First deployments need to produce shareable outcome data.

### Scope Risks

- **Art production**: Even a simple sprite sheet takes time solo. Recommended mitigation: use freely licensed placeholder art for MVP, commission custom art for v1.1 after validation.
- **Question content pipeline**: Someone must tag existing S3 questions with Socratic steps for all standards. This is the largest non-code time investment.

### Open Questions

- **How many Socratic steps exist per question?** — Audit 10 questions from the existing solution step data to confirm length and condensability for in-game display.
- **Does the 30%-speed gate mechanic feel right?** — Only a prototype answers this. The game could fully pause instead; this needs playtesting with real Grade 5 students.
- **What's the minimum viable art?** — Can we ship with freely licensed sprite assets + custom color palette for MVP, or does the art quality undermine teacher confidence in the platform?

---

## MVP Definition

**Core hypothesis**: *Students find the Socratic runner loop engaging enough to complete 2–3 runs on a single standard, and per-step accuracy improves measurably across runs.*

**Required for MVP:**
1. Auto-runner canvas loop (character, scrolling background, obstacle stream)
2. Math Gate system — 5 gates per run, each showing a Socratic step question with 3 answer choices and a 15-second timer
3. One standard fully wired (Grade 5 fractions — M.5.3 or Common Core equivalent), Tier 1 only
4. 3 lives (shields), game-over state, score card with accuracy
5. Win state — confetti (canvas-confetti already integrated) + "standard Tier 1 complete" message
6. Guest play (no login required)
7. Desktop + iPad responsive

**Explicitly NOT in MVP:**
- Multiple standards or grades
- Cosmetic skin unlocks
- Outcome tracking integration (validate fun first, then wire up data)
- Math Heist (v2)
- Leaderboard or class mode
- Mobile phone layout
- Sound (add in v1.1 — don't let audio production block the prototype)

### Scope Tiers

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 1 standard, Tier 1 | Runner loop, 5 math gates, score card, guest play | 2–3 weeks |
| **v1.0** | Grade 5–6 standards (20–25 standards), all 3 tiers | Outcome tracking, cosmetic skins, sound, login integration | +3–4 weeks |
| **v1.5** | Grades 3–8 all standards | Teacher assignment, class leaderboard, mobile layout | +4–6 weeks |
| **v2.0** | Math Heist + JetRun | Full game suite, multi-curriculum config (TEKS + Common Core + IB) | +4–6 weeks |

---

## Game 2 Preview: Math Heist *(v2)*

**Elevator pitch**: You're pulling off a heist. Each math problem is a security door — solve it before the alarm triggers to steal the treasure.

**Grade-scaled themes**:
- Grade 3–4: Museum cookies heist — cute cartoon thief, whimsical alarm, bouncy art
- Grade 5–6: Ancient temple relic heist — explorer aesthetic, torch-lit corridors
- Grade 7–8: Cyber city data heist — neon hacker aesthetic, circuit-board visuals

**Inherits from JetRun**: Same question engine, same Socratic step data, same curriculum-agnostic config system, same outcome tracking. Math Heist is primarily a new art theme + game loop (timer countdown vs. runner), not a new question infrastructure.

**Key addition over JetRun**: Wrong answers *change the game state* — each wrong answer advances the alarm closer to triggering, adding escalating tension. This serves students who find the runner loop less engaging but respond to puzzle/tension mechanics.

---

## Next Steps

- [ ] Audit 10 existing solution-step sequences to confirm Socratic step condensability for in-game display
- [ ] Prototype the runner loop in `../MathCoachTexas/src/pages/GamePage.jsx`
- [ ] Playtest the 30%-speed gate mechanic with 2–3 real students
- [ ] Source placeholder sprite assets (freely licensed) for MVP character + environment
- [ ] Wire one standard (Grade 5 fractions) into the gate question system
- [ ] Run `/map-systems` to decompose the game into individual systems with dependencies
- [ ] Run `/prototype runner-loop` after the audit above
- [ ] Run `/sprint-plan new` once the prototype validates the core hypothesis
