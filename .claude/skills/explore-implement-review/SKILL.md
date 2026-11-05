---
name: explore-implement-review
description: Run a code change through the explorer, implementer, and reviewer subagents, then commit. Use for any code change the user wants done with the pipeline, e.g. "use the pipeline", "explore implement review".
---

Subagents cannot call each other, so you (the main session) orchestrate and relay between them.

1. **Pin.** Confirm the task and its spec. Record the fixed point with `git rev-parse HEAD` before any work starts.
2. **Explore.** Spawn `explorer` with the task. Keep its brief.
3. **Implement.** Spawn `implementer` with the task and the explorer brief. Never paste coding standards into its prompt.
4. **Review.** Spawn `reviewer` with the fixed point and the spec.
5. **Fix loop.** On `VERDICT: CHANGES REQUESTED`, send the findings to the same implementer with SendMessage, then spawn the reviewer again. Cap at 3 review rounds; if it still fails, stop and ask the user.
6. **Commit.** On `VERDICT: PASS`, tell the implementer "review passed, commit" and give it the exact commit message to use, with a Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `chore:`, ...) that you choose, taking the reviewer's view into account.

Report to the user: the commit SHA, the number of review rounds, and any judgement calls left unaddressed.
