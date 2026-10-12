# Maintaining Folio (Pdf-Editor)

Folio is a browser PDF toolkit. The front end is plain static files (no build
step); the server side is a small Node/Express service that hosts those files
and runs the tools that cannot work in the browser.

## Project map

```
index.html          Landing page
app.html            The PDF editor (all client-side tool logic lives inline)
i18n.js             EN/IT dictionaries + language API (window.FolioI18N)
server-tools.js     UI for the server-side tools (calls /api)
vendor/pdf-lib.min.js  Client-side PDF library (vendored, do not edit)
favicon.svg, icon-512.png, og-image.png   Assets

server/index.js     Express app: static hosting + /api
server/lib/util.js  Shared helpers (pdf.js raster/text, binary detection, zip)
server/tools/index.js  The 18 server-side tools + availability()
server/test/        node:test suite for the API and the tools
test/               Client-side (jsdom) tests
Dockerfile          Production image with the optional native tools
```

## Run it

```bash
npm install          # installs server dependencies
npm start            # http://localhost:8080/app.html
npm test             # server tests + client tests
```

The page works without the server for the ~12 client-side tools. The tools
marked `type: 'server'` in `app.html` need the server and call `/api`.

## Which tools need what

Client-side (no server): merge, split, remove pages, extract pages, reorder,
rotate, page numbers, watermark, crop, edit text, JPG to PDF, HTML to PDF.

Server-side (pure JS, always available): pdf-to-jpg, pdf-to-ppt, OCR, scan,
pdf-to-word, pdf-to-excel, compare, compress, repair, sign, redact, forms.

Server-side (need an optional binary; reported as unavailable without it):
- `word-to-pdf`, `ppt-to-pdf`, `excel-to-pdf` -> LibreOffice (`soffice`)
- `pdf-to-pdfa` (and stronger compression) -> Ghostscript (`gs`)
- `protect`, `unlock` -> qpdf

`server/tools/index.js` -> `availability()` reports this per tool; the client
shows the reason instead of a broken button.

## Adding or changing a tool

1. **Client-side:** add the UI in `app.html` (`buildToolContent` + an `init*`
   function wired into `init()`). Follow the existing pdf-lib pattern and
   localise every string via `FolioI18N.t` (add the key to **both** `en` and
   `it` in `i18n.js`).
2. **Server-side:** add an entry to `tools` in `server/tools/index.js`
   (`{ label, run(ctx) }`), and — if it needs a binary — add it to
   `BIN_REQUIRED`. Then register it in `TOOLS` in `server-tools.js`.
3. Add a test in `server/test/` and run `npm test`.

## i18n invariants

- Every key used in `index.html`, `app.html`, `server-tools.js` must exist in
  both dictionaries.
- Keep the two dictionaries at the same key count.

## Deployment

The app is no longer tied to GitHub Pages: `server/index.js` serves the static
files and the API, so any Node host or container works.

- **Container:** `docker build -t folio . && docker run -p 8080:8080 folio`.
  The Dockerfile installs LibreOffice/Ghostscript/qpdf/Tesseract so every tool
  is available.
- **Node host:** `npm ci --omit=dev && npm start` (set `PORT`). Without the
  native binaries the corresponding tools report as unavailable.
- **Health check:** `GET /api/health`; the tool map is `GET /api/tools`.

### After moving domains

`index.html`/`app.html` contain absolute `og:url` / `og:image` meta tags that
still point at the old GitHub Pages address. Update them to the new public URL
so link previews resolve. Keep the `?lang=` behaviour intact.

## Housekeeping

- Never commit `node_modules/` (ignored), `.freebuff/`, or `.bug-hunter/`.
- Keep `vendor/` pinned; it is loaded directly by the browser.
- The rule in `no-ai-trailers.md` is mandatory for every commit.
