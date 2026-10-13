# Maintaining Folio (Pdf-Editor)

Folio is a browser PDF toolkit. The front end is plain static files (no build
step); the server side is a small Node/Express service that hosts those files
and runs the tools that cannot work in the browser.

## Project map

```
index.html          Landing page
app.html            The PDF editor (all client-side tool logic lives inline)
i18n.js             EN/IT dictionaries + language API (window.FolioI18N)
icons.js            The icon set: FOLIO_ICONS + folioIcon()/folioPaintIcons()
server-tools.js     UI for the server-side tools (calls /api)
vendor/pdf-lib.min.js  Client-side PDF library (vendored, do not edit)
favicon.svg, icon-512.png, og-image.png   Assets
README.md, README.it.md   The same README in the two languages

server/index.js     Express app: static hosting + /api
server/lib/util.js  Shared helpers (pdf.js raster/text, binary detection, zip)
server/lib/ocr.js   Rasterising, deskew, Tesseract workers, searchable PDF
server/tools/index.js  The 22 server-side tools + availability()
server/test/        node:test suite for the API and the tools
test/               Client-side (jsdom) tests
scripts/fetch-tessdata.mjs   Downloads the OCR models (build step, npm run tessdata)
Dockerfile          Production image with the optional native tools
deploy/             docker-compose + Caddy + the gcloud scripts (see docs/DEPLOY-GCP.md)
docs/DEPLOY-GCP.md  Deployment runbook for the project's VM
```

## Run it

```bash
npm install          # installs server dependencies
npm start            # http://localhost:8080/app.html
npm test             # server tests + client tests
```

The page works without the server for the 15 client-side tools. The tools
marked `type: 'server'` in `app.html` need the server and call `/api`.
Note that in jsdom `localStorage` on a `file://` page is unavailable by design,
so the tests install a shim; the page itself must keep working without it
(`store` in `app.html` falls back to memory).

## Which tools need what

Client-side (no server): merge, split, remove pages, extract pages, reorder,
advanced pages (duplicate/reverse/insert blank/remove blank), rotate, page
numbers, header and footer, watermark, crop, edit text, JPG to PDF, HTML to
PDF, sanitise.

Server-side (pure JS, always available): pdf-to-jpg, pdf-to-ppt, OCR, scan,
extract text, deskew, pdf-to-html, pdf-to-markdown, pdf-to-word, pdf-to-excel,
compare, compress, repair, sign, redact, forms.

Server-side (need an optional binary; reported as unavailable without it):
- `word-to-pdf`, `ppt-to-pdf`, `excel-to-pdf` -> LibreOffice (`soffice`)
- `pdf-to-pdfa` (and stronger compression) -> Ghostscript (`gs`)
- `protect`, `unlock` -> qpdf

`server/tools/index.js` -> `availability()` reports this per tool; the client
shows the reason instead of a broken button.

## Adding or changing a tool

1. **Client-side:** add an entry to `CATEGORIES()` in `app.html`, a UI function
   in `TOOL_UI` that returns `{ controls, actions, statusId }`, and an `init*`
   function in `TOOL_INIT`. `toolPanel()` wraps both kinds of tool in the same
   `.tool-panel` skeleton, so a tool only supplies its own controls. Follow the
   existing pdf-lib pattern, and localise every string via `FolioI18N.t` (add
   the key to **both** `en` and `it` in `i18n.js`).
2. **Server-side:** add an entry to `tools` in `server/tools/index.js`
   (`{ label, run(ctx) }`), and — if it needs a binary — add it to
   `BIN_REQUIRED`. Then register it in `TOOLS` in `server-tools.js`.
3. Add a test in `server/test/` and run `npm test`.

## Design-system invariants

- Colours, spacing, radii, type sizes and durations come from the tokens in
  `:root`. `test/client.test.mjs` fails on any `#hex` outside `:root`.
- No emoji in the UI: icons come from `folioIcon(name)` in `icons.js`, and the
  client test walks the rendered DOM (in both languages) looking for them.
- Every tool renders through `toolPanel()`; per-tool code returns only its
  controls and its primary action.
- Long runs go through `FolioProgress.create(statusId, label)`, which gives the
  elapsed time and the Cancel button; loops call `checkpoint(task)` between
  pages so cancelling is immediate. Server runs get the same UI through
  `window.FolioProgress`.
- Text contrast: `--text-secondary` and `--text-muted` must stay ≥ 4.5:1 on
  `--bg`; the client test computes the WCAG ratio from the tokens themselves.

## i18n invariants

- Every key used in `index.html`, `app.html`, `server-tools.js` must exist in
  both dictionaries.
- Keep the two dictionaries at the same key count. `node -e` one-liner used to
  check parity while adding keys:

```bash
node -e "const s=require('fs').readFileSync('i18n.js','utf8');const d=new (require('jsdom').JSDOM)('<script>'+s+'</script>',{runScripts:'dangerously'});const F=d.window.FolioI18N;const en=Object.keys(F.dict('en')),it=Object.keys(F.dict('it'));console.log(en.length,it.length,en.filter(k=>!F.dict('it')[k]),it.filter(k=>!F.dict('en')[k]))"
```

## Deployment

The app is no longer tied to GitHub Pages: `server/index.js` serves the static
files and the API, so any Node host or container works. The project's own VM is
deployed with the scripts in `deploy/` — the full runbook is
`docs/DEPLOY-GCP.md`.

- **VM:** `PROJECT=… ZONE=… VM=… deploy/deploy.sh` (idempotent; rebuilds the
  image, brings the compose stack up and checks the public address).
- **Container:** `docker build -t folio . && docker run -p 8080:8080 folio`.
  The Dockerfile installs LibreOffice/Ghostscript/qpdf and bakes in the OCR
  models, so every tool is available.
- **Node host:** `npm ci --omit=dev && npm start` (set `PORT`). Without the
  native binaries the corresponding tools report as unavailable.
- **Health check:** `deploy/healthcheck.sh --url http://34.61.56.12`;
  `GET /api/health` answers, `GET /api/tools` is the tool map.

### After moving domains

`index.html`/`app.html` hold absolute `og:url` / `og:image` meta tags pointing
at the deployed address (`http://34.61.56.12/`). Update both files, and the
`README`s that mention it, when the site moves. Keep the `?lang=` behaviour and
the `?tool=` deep link intact.

## Housekeeping

- Never commit `node_modules/` (ignored), `.freebuff/`, or `.bug-hunter/`.
- Keep `vendor/` pinned; it is loaded directly by the browser.
- The rule in `no-ai-trailers.md` is mandatory for every commit.
