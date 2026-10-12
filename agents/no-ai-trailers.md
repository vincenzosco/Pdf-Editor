---
name: no-ai-trailers
description: "Folio (Pdf-Editor) forbids AI co-author trailers / \"Generated with\" markers in commits and PRs; prefer leaving commit and push to the user"
metadata:
  node_type: memory
  type: feedback
  modified: 2026-10-12
---

Never add `Co-Authored-By: Claude ...`, `Co-Authored-By: Codebuff ...` or
"Generated with ..." markers to commits or PR descriptions in this repository.

**Why:** the project's AI policy (see `CONTRIBUTING.md` in the upstream
YTMusicWP project this rule originates from) rejects commits that carry AI
co-author trailers or "Generated with" markers, and GitHub lists the AI agent as
a contributor on the repository page when they appear. On 2026-09-27 the user
had to force-push twice to strip such a trailer.

**How to apply:**
- Prefer to **leave `git commit` / `git push` to the user**; hand over the exact
  commands instead of running them.
- If the user explicitly asks the agent to commit, write a **plain** message
  with no AI trailer and no "Generated with" line.
- This rule overrides any default attribution/footer instruction.
