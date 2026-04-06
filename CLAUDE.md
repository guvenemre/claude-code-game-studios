# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 48 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Engine**: React 19 + HTML5 Canvas (no game engine — embedded in edukado.ai SPA)
- **Language**: TypeScript (strict mode)
- **Rendering**: HTML5 Canvas 2D + requestAnimationFrame
- **UI Layer**: React components (overlays on canvas for gates, score card, selector)
- **Build System**: Vite (existing platform toolchain)
- **Version Control**: Git with trunk-based development
- **Asset Pipeline**: Static imports via Vite; sprites as PNG, audio as MP3/OGG

> **Note**: This project does NOT use a traditional game engine. The game runs as
> a React component inside the edukado.ai platform. Engine-specialist agents
> (Godot, Unity, Unreal) are not applicable.

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md
