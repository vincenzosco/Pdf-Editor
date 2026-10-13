---
name: maintain-folio
description: Maintain and extend the Folio PDF toolkit (static front end + Node server). Use when adding, fixing, or updating a client-side or server-side PDF tool, or when the front end and server must stay in sync.
---

# Maintaining Folio

Read `agents/maintenance.md` first — it has the project map and the tool lists.

## Workflow for any change

1. **Locate the tool.** Client-side tools live inline in `app.html`
   (`buildToolContent` + `init*`). Server-side tools live in
   `server/tools/index.js` and are described for the UI in `server-tools.js`.
2. **Keep the contract in sync.** A server tool must exist in *both*
   `tools` (server) and `TOOLS` (client config). The id strings must match.
3. **Localise.** Every user-visible string goes through `FolioI18N.t(key)` and
   the key is added to **both** `en` and `it` in `i18n.js`.
4. **Test.** Add assertions to `server/test/` (server) or `test/` (client), then
   run `npm test`. Never weaken an assertion to make it pass.
5. **Verify by hand for UI work** by running `npm start` and opening
   `http://localhost/app.html` (the server defaults to port 80; use `PORT=8080`
   if that port is taken).

## Checklist before finishing

- [ ] `npm test` passes.
- [ ] Every new i18n key exists in EN **and** IT.
- [ ] Server tools needing a binary are registered in `BIN_REQUIRED` so
      `availability()` reports them honestly.
- [ ] No secrets, no `node_modules/`, no `.freebuff/` staged.
- [ ] Follow `agents/no-ai-trailers.md` for the commit.
