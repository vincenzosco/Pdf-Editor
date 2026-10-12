---
name: release
description: Commit and push Folio changes safely. Use before any git commit or push in this repository — enforces the no-ai-trailers rule and the pre-push checks.
---

# Releasing Folio

## Hard rule

**No AI trailers.** Never add `Co-Authored-By: ...` or "Generated with ..." to a
commit message or PR. Prefer to hand the user the `git` commands and let them
push. If asked to commit, write a plain message. See
`agents/no-ai-trailers.md`.

## Pre-push checks

```bash
npm test            # server + client tests must pass
git status          # confirm only intended files are staged
git diff --stat     # sanity-check the change
```

Do not stage: `node_modules/`, `.bug-hunter/`, `.freebuff/`, `.env`, logs.

## Commit

Keep the message imperative and focused on *why*, one or two sentences, with no
attribution footer:

```bash
git add <files>
git commit -m "Add server-side PDF tools and host the site with Express"
git push
```

## When in doubt

Stop and give the user the commands rather than pushing for them.
