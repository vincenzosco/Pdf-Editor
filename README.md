# Folio — Precision PDF Tools

**English** · [Italiano](README.it.md)

A free PDF toolkit: annotate, edit, rotate, split, merge, watermark, sign and
convert documents. The front end is plain static HTML/JS; a small Node/Express
server hosts it and runs the tools that cannot work in the browser.

## Quick start

```bash
npm install
npm start        # http://localhost/app.html (default port 80; PORT=8080 to change)
npm test         # server tests + client tests
```

`npm start` serves the workspace at `/app.html` and the landing page at `/`.
The browser-only tools (merge, split, rotate, watermark, JPG to PDF, …) work
even with no server at all. The tools marked *server* need it and call `/api`:
if you open `app.html` as a file, those panels explain that they are offline
instead of failing silently.

Other scripts:

| Script | What it does |
|---|---|
| `npm run dev` | same as `start`, restarting on file changes |
| `npm run test:server` | server tests only |
| `npm run test:client` | jsdom client tests only |
| `npm run test:ci` | everything, single-threaded (OCR is CPU-bound) |
| `npm run tessdata eng ita` | downloads the Tesseract models into `server/tessdata` |

## Tools

**In the browser** (files never leave the device) — merge, split,
remove/extract/reorder pages, rotate, page numbers, watermark, crop, edit text,
JPG to PDF, HTML to PDF.

**On the server (pure JS)** — PDF to JPG, PDF to PowerPoint, OCR, scan, extract
text, deskew, PDF to Word, PDF to Excel, PDF to HTML, PDF to Markdown, compare,
compress, repair, sign, redact, forms.

**On the server (need a native binary)** — Word/PowerPoint/Excel to PDF
(LibreOffice), PDF to PDF/A (Ghostscript), protect/unlock (qpdf).

`GET /api/tools` reports which of them are available on the running host, and
the UI shows the reason when one is not; nothing fails silently.

## API

- `GET  /api/health` — `{ ok, uptime }`; use it as the health check.
- `GET  /api/tools` — availability per tool (`available`, `reason`).
- `POST /api/tools/:id` — `multipart/form-data` with one or more `files` parts
  and a JSON `options` field; the response body is the resulting file, with its
  name in the `X-Folio-Filename` header. Errors come back as
  `{ "error": "…" }` with a 4xx/5xx status.

## Privacy

The browser-only tools keep files on the device. **The server tools upload the
file to the server to process it**, so the landing page wording should be read
as applying to the browser-only tools. If you need that promise everywhere,
leave the server tools disabled.

## Deploy

Locally, with Docker:

```bash
docker build -t folio .
docker run -p 8080:80 folio
```

The image installs LibreOffice, Ghostscript and qpdf and bakes in the OCR
language models, so every tool works. The compose stack in `deploy/` adds Caddy
in front for ports 80 and 443.

On the project's Google Cloud VM:

```bash
deploy/open-firewall.sh --project pdf-editor-511418 --zone us-central1-a \
                        --vm pdf-editor-server     # once
PROJECT=pdf-editor-511418 ZONE=us-central1-a VM=pdf-editor-server \
  deploy/deploy.sh                                 # every release
```

`deploy.sh` packages the sources, copies them to the VM, prepares it (2 GB swap
file, Docker + compose) and brings the stack up. It is safe to re-run. The app
listens on port 80 by default and Caddy sits in front of it: on its own Caddy
asks Let's Encrypt for a certificate for `<public-ip>.nip.io`, a name that
resolves to the VM with no DNS of your own, so the site is on HTTPS immediately.
Pass `--domain your.domain` once you own one, or `--no-tls` to stay on plain
HTTP. The full runbook, including how to read the logs and roll back, is in
[docs/DEPLOY-GCP.md](docs/DEPLOY-GCP.md).

The deployed instance is reachable at <https://34.61.56.12.nip.io/>. Use that
name rather than the bare IP: the certificate covers the name only. `og:url` and
`og:image` in `index.html` point at it; change both if the site moves.

## Documentation

- [docs/DEPLOY-GCP.md](docs/DEPLOY-GCP.md) — deployment runbook.
- [agents/maintenance.md](agents/maintenance.md) — project map, how to maintain
  and extend it.
- [agents/no-ai-trailers.md](agents/no-ai-trailers.md) — mandatory commit rule.
- [skills/](skills/) — reusable procedures.
