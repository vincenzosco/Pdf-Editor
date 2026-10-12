# Folio — Precision PDF Tools

A free, in-browser PDF toolkit: annotate, edit, rotate, split, merge, watermark,
sign and convert documents. The front end is plain static HTML/JS; a small
Node/Express server hosts it and runs the tools that cannot work in the browser.

## Quick start

```bash
npm install
npm start        # http://localhost:8080/app.html
npm test         # server tests + client tests
```

The client-side tools (merge, split, rotate, watermark, JPG to PDF, …) work
even without the server. The tools marked *server* need it and call `/api`.

## Tools

**In the browser** — merge, split, remove/extract/reorder pages, rotate, page
numbers, watermark, crop, edit text, JPG to PDF, HTML to PDF.

**On the server (pure JS)** — PDF to JPG, PDF to PowerPoint, OCR, scan,
PDF to Word, PDF to Excel, compare, compress, repair, sign, redact, forms.

**On the server (need a native binary)** — Word/PowerPoint/Excel to PDF
(LibreOffice), PDF to PDF/A and stronger compression (Ghostscript),
protect/unlock (qpdf). `GET /api/tools` reports which are available; the UI
shows the reason when one is not.

## API

- `GET  /api/health`
- `GET  /api/tools` — availability per tool
- `POST /api/tools/:id` — multipart (`files` + a JSON `options` field) → the
  resulting file.

## Deploy

```bash
docker build -t folio .
docker run -p 8080:8080 folio
```

The image installs the optional binaries so every tool works. On a plain Node
host, run `npm ci --omit=dev && npm start` (set `PORT`); tools without their
binary report as unavailable. Use `GET /api/health` as the health check.

## Privacy

The browser-only tools keep files on the device. The **server tools upload the
file to the server to process it**, so the landing page wording should be read
as applying to the browser-only tools. If you need to keep that promise
everywhere, leave the server tools disabled.

## Documentation

- `agents/maintenance.md` — project map, how to maintain and extend it.
- `agents/no-ai-trailers.md` — mandatory commit rule.
- `skills/` — reusable procedures.
