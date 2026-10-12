# Folio upgrade — design spec

Date: 2026-10-12
Status: approved (design reviewed with the project owner before implementation)

## 1. Context

Folio is a free PDF toolkit. The front end is plain static HTML/JS
(`index.html` landing, `app.html` workspace, `i18n.js` EN/IT strings) served by
a small Node/Express app (`server/index.js`). Tools are of two kinds: pure
browser tools (pdf-lib) and server tools (`server/tools/index.js`, called over
`POST /api/tools/:id`).

Measured problems this spec addresses:

1. **OCR quality is capped by the raster resolution.** `ocr`/`scan` call
   `rasterizePdf(pdf, { scale: 2 })`, i.e. ~150 DPI for a Letter page, and feed
   the raw render to Tesseract with default page segmentation. There is no
   preprocessing, no deskew and no way to keep the original pages.
2. **The output is a reconstruction, not the original.** The searchable PDF is
   rebuilt page by page from the PDF Tesseract emits, so page boxes, rotation
   and the visual design of the source are not guaranteed to survive.
3. **The interface is inconsistent.** Every tool builds its own markup, and the
   icon vocabulary is emoji (`📄 ⊞ 🔍 📷 …`) in the sidebar, section headings and
   buttons. Emoji are font-dependent, cannot be themed with tokens and render
   differently per platform.
4. **One colour token fails WCAG AA.** `--text-secondary` `#787C82` on
   `--bg` `#F4F3EF` measures **3.78:1**, below the 4.5:1 required for normal text.
5. **Finding a tool is hard.** Thirty tools sit in seven collapsible categories,
   with no search, no favourites and no sense of what was used recently.
6. **Slow server tools look frozen.** OCR and compression run with a static
   "working…" label and cannot be cancelled.
7. **There is no deployment story.** `Dockerfile` exists, but nothing describes
   or automates running the app on the project's Google Cloud VM.

## 2. Goals

- Make OCR materially more accurate and make its output visually identical to
  the input.
- Give every tool one coherent design system and a real icon set.
- Make the workspace easier to navigate and add the six tools listed in §5.
- Ship bilingual READMEs (EN default, IT second).
- Automate deployment to the existing Google Cloud VM of the pdf-editor
  project, including firewall ports.

## 3. Non-goals

- No redesign of the brand. The existing identity (Fraunces + Inter, cream
  `#F4F3EF` / ink `#1F4C82` / red `#D13433`) is kept.
- No framework. The front end stays dependency-free static HTML/JS.
- No N-up/booklet imposition and no flatten tool (considered, not selected).
- No change to the privacy model beyond what is already documented: server
  tools upload the file, browser tools do not.

## 4. Workstream 1 — OCR

### 4.1 New module `server/lib/ocr.js`

Single responsibility: turn page images (or a PDF) into an accurate searchable
PDF. Exports:

- `renderPagesForOcr(bytes, { targetDpi })` → `[{ page, width, height, gray, angle }]`
  Rasterises at a **real 300 DPI** by computing `scale = targetDpi / 72` from
  each page's own viewport instead of a fixed `scale: 2`, capped so that the
  longest edge stays under 5000 px (memory guard for A0 posters).
- `preprocess(canvas)` → deskew + grayscale + Otsu binarisation, done in the
  existing `@napi-rs/canvas` pipeline (no new native dependency).
- `detectSkew(canvas)` → rotation angle in degrees, by scoring the variance of
  the horizontal projection profile over a small angle search (−5…+5, 0.25 step).
- `detectLanguage(sampleText, candidates)` → best supported code, by counting
  stop-word/character hits on a first-page sample.
- `ocrPage(worker, image, { psm, dpi })` → `{ text, words }` with Tesseract
  parameters set per page.
- `buildSearchablePdf(originalBytes, pageResults)` → PDF where the **original
  pages are kept as-is** and the recognised text is drawn on top with
  `opacity: 0` (pdf-lib's `drawText` emits an `ExtGState` with `CA`/`ca` 0) so
  it is invisible but still present in the content stream. Positions come from
  Tesseract's word boxes, scaled from the render DPI back to PDF points and
  mapped through the page's `/Rotate` value so rotated pages line up. A test
  asserts that `extractText(output)` returns the recognised words, which proves
  the overlay is genuinely extractable and not just visually hidden.

Pages that already contain a text layer are detected with the existing
`extractText()` and skipped, so a mixed document keeps its original text and
only the scans get OCR. This is the "hybrid" mode and it is the default.

### 4.2 Tesseract tuning

- `tessedit_pageseg_mode`: 3 (auto, default), 6 (single uniform block),
  4 (single column), 11 (sparse text) — exposed in the UI.
- `preserve_interword_spaces=1` so table spacing survives extraction.
- `user_defined_dpi` set to the actual render DPI.
- Worker cached and reused across the pages of one job instead of one worker
  per request; the language data cache stays in `os.tmpdir()`.

### 4.3 Options exposed in the UI

`lang` (Auto + eng/ita/spa/deu/fra), `quality` (150/200/300/400 DPI, default
300), `pageMode` (Auto / single block / single column / sparse), `deskew` (on
by default). There is no option to go back to the old Tesseract-rebuilt output:
keeping one code path is simpler and the new one is strictly better.

### 4.4 Acceptance criteria

- A 300 DPI scan of Italian text is recognised with the correct accents, and
  `Auto` selects `ita` without being told.
- Output page count, page size and rotation match the input exactly.
- A PDF that already has a text layer comes back with that page unchanged and
  no duplicate invisible text.

## 5. Workstream 2 — one design system

### 5.1 Tokens

Extend `:root` in `app.html` with a full scale and semantic aliases, then
rewrite component styles against the tokens only (no ad-hoc hex outside
`:root`):

- spacing `--space-1…8` (4/8/12/16/24/32/48/64), radius `--radius-sm/md/lg/pill`,
  type `--type-xs…--type-2xl` with line heights.
- semantic colours `--surface`, `--surface-2`, `--text-primary`,
  `--text-secondary`, `--text-muted`, `--border`, `--border-strong`,
  `--accent`, `--accent-ink`, `--success`, `--danger`, `--warning`.
- **`--text-secondary` moves to `#5C6067` (≈5.7:1 on `--bg`)** and a new
  `--text-muted` `#656A70` (≈4.9:1) covers the smallest labels, fixing the
  measured 3.78:1 failure. Both are checked with the WCAG formula in the
  client test, not by eye.
- motion `--dur-fast: 150ms`, `--dur: 200ms`, `--ease`; everything wrapped in
  `@media (prefers-reduced-motion: reduce)`.

### 5.2 Icon set

Replace every emoji with inline SVG from **one** family: 24×24 viewBox,
`stroke-width: 1.5`, `currentColor`,  `aria-hidden="true"` when a visible label
  sits next to it, `role="img"` + `<title>` when standalone. Delivered as a
  `FOLIO_ICONS` map in a new `icons.js`, with a `folioIcon(name, opts)` helper,
  so the workspace markup stays about structure instead of glyph paths. The
  landing page switches to the same set wherever it currently relies on emoji.

### 5.3 Component: `.tool-panel`

One skeleton renders all 30 tools, so a tool can no longer drift:

```
<section class="tool-panel" id="tool-<id>">
  <header class="tool-panel__head">   icon · h2 label · blurb · badge (Browser|Server)
  <div class="tool-panel__body">      controls (upload / fields)
  <footer class="tool-panel__foot">   primary action · secondary actions
  <div class="tool-panel__status">    aria-live="polite" region
```

Every tool goes through `renderTool(tool)` → `toolPanel({...})`; the per-tool
functions return only their controls. Shared components built on top: button
(`primary|secondary|ghost`, plus `busy` and `disabled`), field, select,
textarea, upload zone, status message, progress bar, file row.

### 5.4 Acceptance criteria

- `grep` for emoji in `app.html` returns nothing in UI/building code.
- No `#hex` outside `:root` in `app.html`'s stylesheet.
- Computed contrast of `--text-secondary` on `--bg` ≥ 4.5:1 (asserted in the
  client test with the WCAG formula).
- Every tool section shares the same DOM skeleton.

## 6. Workstream 3 — usability and new tools

### 6.1 Navigation

- **Sidebar search** (debounced 120 ms) filtering across label + description in
  both languages; an empty result shows a "no results" state with the closest
  three matches instead of a blank panel.
- **Favourites** (star toggle) and **Recents** (last 6 tools) as pinned
  sidebar groups, persisted in `localStorage` through the existing safe
  accessor and degrading to in-memory when storage is blocked.
- The category of the active tool opens automatically; deep links
  (`app.html?tool=ocr&lang=it`) select it on load.
- Off-canvas sidebar under 900 px with a visible toggle and focus handling.

### 6.2 Feedback

- Server tools show a **progress bar with elapsed time**; every run is
  cancellable through `AbortController`.
- Failures render an inline **Retry** button that re-runs the last request with
  the same files and options.
- Status regions use `role="status"`/`aria-live="polite"`, errors use
  `role="alert"`.

### 6.3 New tools

| Tool | Side | Behaviour |
|---|---|---|
| **Extract text** | server | PDF → `.txt`. Uses the real text layer; falls back to OCR per page when a page has none. Options: one file per page / single file, keep layout. |
| **Header & footer** | browser | Draws header/footer text on every selected page with placeholders `{n}`, `{total}`, `{date}`, `{title}`; font size, margin, alignment, page range. |
| **Advanced pages** | browser | Duplicate pages, reverse order, insert blank page at position, remove blank pages (detected from the content stream). One panel, one action at a time. |
| **Sanitise PDF** | browser | Removes metadata (title/author/subject/keywords/producer/dates), strips embedded JavaScript and attachments, and can be combined with the existing protect step. |
| **PDF → HTML** | server | One HTML file with a page per `div`, text positioned from the PDF text items. |
| **PDF → Markdown** | server | Heading detection from font size, list and paragraph inference, page separators. |
| **Deskew** | server | Standalone straightening of rotated scans; also available as OCR preprocessing. |

### 6.4 Acceptance criteria

- Each new tool appears in the sidebar and in search, has EN+IT copy, and is
  covered by a test (server tools by `node --test`, browser tools by the jsdom
  client test).
- The OCR panel offers the `Auto` language and reports which language it chose.

## 7. Workstream 4 — README

- `README.md` — English, the default. Opens with a language switch line
  linking to `README.it.md`.
- `README.it.md` — Italian, same structure, links back.
- Both cover: what Folio is, quick start, the full tool catalogue (browser vs
  server vs native-binary), API reference, deployment on Google Cloud, the
  privacy model, and links to `agents/` and `skills/`.
- Existing `og:url`/`og:image` placeholders are updated to the deployed address
  once the VM host is known, and the README says how to change it.

## 8. Workstream 5 — deployment on Google Cloud

Choice made for the owner (they asked me to decide): **Docker Compose on the
VM**, with the app container built from the existing `Dockerfile` (so
LibreOffice, Ghostscript and qpdf are present and every tool works) and
**Caddy** in front for ports 80/443. With `DOMAIN` set, Caddy issues the
certificate automatically; without it, Caddy serves plain HTTP on 80 (a
certificate cannot be issued for a bare IP), so the stack is usable before the
DNS record exists.

Deliverables:

```
deploy/
  docker-compose.yml     app + caddy, restart: unless-stopped
  Caddyfile              reverse proxy, optional domain
  .env.example           PORT, DOMAIN, FOLIO_TAG
  deploy.sh              gcloud compute scp → ssh → compose up, idempotent
  open-firewall.sh       creates/updates the allow rules for 80,443,8080
  healthcheck.sh         curls /api/health and every tool's availability
docs/DEPLOY-GCP.md       step-by-step, with the exact gcloud commands
```

`deploy.sh` takes `PROJECT`, `ZONE`, `VM` (env or flags), refuses to run
without them, and is safe to re-run. Firewall rules are named
`folio-allow-http`, `folio-allow-https`, `folio-allow-app`.

### 8.1 Acceptance criteria

- `deploy.sh` is idempotent and fails loudly with a clear message when
  `PROJECT`/`ZONE`/`VM` are missing.
- Ports 80, 443 and 8080 are opened by `open-firewall.sh`, and the script is
  safe to run twice.
- `GET /api/health` returns 200 on the VM and `GET /api/tools` reports the
  native-binary tools as available.

## 9. Testing

- `server/test/tools.test.js` — extended for the new server tools: extract
  text (with and without a text layer), PDF → HTML, PDF → Markdown, deskew,
  and the OCR options. Assertions on real generated PDFs, not mocks.
- `test/client.test.mjs` — jsdom: page builds, one active panel, search
  filters, favourites persist, no emoji left in the rendered DOM, contrast of
  `--text-secondary`, and the new browser tools produce a PDF through a real
  pdf-lib round trip.
- `npm test` must stay green, run with its exit status preserved.

## 10. Risks

| Risk | Mitigation |
|---|---|
| 300 DPI on large pages exhausts memory | cap the longest edge at 5000 px and process one page at a time |
| OCR slows down noticeably | hybrid mode skips pages that already have text; the worker is reused |
| Deskew mis-detects on sparse pages | only rotate when the score gain over 0° exceeds a threshold |
| Rewriting `app.html` breaks working tools | the jsdom client test covers every tool before and after |
| No VM coordinates available locally | everything is parameterised in `deploy.sh`; the owner supplies project/zone/VM |

## 11. Rollout

1. Server changes + tests.
2. Client design system, then new tools, then UX features.
3. README pair.
4. `deploy/` and the GCP runbook.
5. Full verification, then a single commit with the owner's rule applied (no AI
   trailer).
