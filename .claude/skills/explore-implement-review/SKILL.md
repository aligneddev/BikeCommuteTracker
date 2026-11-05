---
name: explore-implement-review
description: Run a code change through the explorer, implementer, and reviewer subagents, then commit. Use for any code change the user wants done with the pipeline, e.g. "use the pipeline", "explore implement review".
---

Subagents cannot call each other, so you (the main session) orchestrate and relay between them.

## Setup (once per repo)

Background: [Matt Pocock's video](https://youtu.be/LlgiOCmFG_w).

The implementer must not learn the coding standards; only the reviewer reads them. Any agent file a tool auto-loads leaks them.

1. Put the standards in `coding_standards.md` at the repo root. `.claude/agents/reviewer.md` lists it (plus any other standards docs) as its sources.
2. Clean up `AGENTS.md` (auto-loaded by Codex/Copilot-style agents): keep only the project intro, environment/run commands, the "Agent skills" section, and the speckit `SPECKIT START/END` plan pointer. Remove coding rules and links to standards docs; don't link `coding_standards.md` from it.
3. Remove standards from other auto-loaded instruction files: `.github/copilot-instructions.md`, `CLAUDE.md` (and no `@AGENTS.md` import that pulls standards back in), `.cursorrules` or similar.
4. Keep the exclusion lists in `.claude/agents/implementer.md` (do not open) and `explorer.md` (do not include) in sync with the reviewer's sources. They are instructions, not enforcement: the implementer can still read those files if it ignores them.
5. Skills: `code-review`, `implement` and `tdd` come from mattpocock/skills (installed under `.agents/skills/`) and must also be copied into `.claude/skills/` so the agents can preload them. `skills-lock.json` tracks only the `.agents` copies, so recopy after a skills update.
6. Spec Kit: set `context_file: AGENTS.md` in `.specify/extensions/agent-context/agent-context-config.yml`; its managed block is only a plan pointer. Re-check it after `specify init` or `specify integration install`, which can reset it (e.g. to `CLAUDE.md`, which Claude Code auto-loads).

## Steps

1. **Pin.** Confirm the task and its spec. Record the fixed point with `git rev-parse HEAD` before any work starts.
2. **Explore.** Spawn `explorer` with the task. Keep its brief.
3. **Implement.** Spawn `implementer` with the task and the explorer brief. Never paste coding standards into its prompt.
4. **Review.** Spawn `reviewer` with the fixed point and the spec.
5. **Fix loop.** On `VERDICT: CHANGES REQUESTED`, send the findings to the same implementer with SendMessage, then spawn the reviewer again. Cap at 3 review rounds; if it still fails, stop and ask the user.
6. **Commit.** On `VERDICT: PASS`, tell the implementer "review passed, commit" and give it the exact commit message to use, with a Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `chore:`, ...) that you choose, taking the reviewer's view into account.

Report to the user: the commit SHA, the number of review rounds, and any judgement calls left unaddressed.
