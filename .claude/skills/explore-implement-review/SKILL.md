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
5. Skills come from the `mattpocock-skills` plugin, enabled in `.claude/settings.json`. The implementer calls `mattpocock-skills:tdd`, the reviewer calls `mattpocock-skills:code-review`, and the user runs `/mattpocock-skills:retro`. Nothing is copied into `.claude/skills/`.
6. Spec Kit: set `context_file: AGENTS.md` in `.specify/extensions/agent-context/agent-context-config.yml`; its managed block is only a plan pointer. Re-check it after `specify init` or `specify integration install`, which can reset it (e.g. to `CLAUDE.md`, which Claude Code auto-loads).

## Steps

1. **Pin.** Confirm the task and its spec. Record the fixed point with `git rev-parse HEAD` before any work starts.
2. **Explore.** Spawn `explorer` with the task. Keep its brief.
3. **Implement.** Spawn `implementer` with the task and the explorer brief. Never paste coding standards into its prompt.
4. **Review.** Spawn `reviewer` with the fixed point and the spec.
5. **Fix loop.** On `VERDICT: CHANGES REQUESTED`, send the findings to the same implementer with SendMessage, then spawn the reviewer again. Cap at 3 review rounds; if it still fails, stop and ask the user.
6. **Commit.** On `VERDICT: PASS`, tell the implementer "review passed, commit" and give it the exact commit message to use, with a Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `chore:`, ...) that you choose, taking the reviewer's view into account.
7. **Retro (continuous improvement).** After the commit, ask the user to run `/mattpocock-skills:retro` on this session. It is model-disabled, so only the user can start it; don't run its workflow yourself. Once it has presented its candidates, apply them yourself, since the implementer must not see the standards and the reviewer is read-only:
   - Turn reviewer findings that came up more than once, or that the reviewer had to invent, into rules in `coding_standards.md`. Prefer an automated check (lint rule, test, hook) for mechanical rules. Remove or clarify rules that misled the reviewer or were never cited.
   - Trim bloat: rules that tooling already enforces, duplicates, vague or unenforceable lines, and anything in `AGENTS.md` beyond the Setup step 2 allow-list.
   - Adapting retro to this repo: the file is `coding_standards.md` (retro says `CODING_STANDARDS.md`). Never add a standards pointer to `AGENTS.md`, despite retro's navigation-pointer advice. If a new standards source is added, update the reviewer's source list and the implementer and explorer exclusion lists.
   - Commit these edits separately with a `docs:` message. If there is nothing worth changing, say so and commit nothing.

When asking for `/mattpocock-skills:retro`, report: the commit SHA, the number of review rounds, and any judgement calls left unaddressed.

After applying retro's candidates, report what changed in `coding_standards.md` and `AGENTS.md` (or that nothing changed), with the reason for each change and the retro commit SHA.
