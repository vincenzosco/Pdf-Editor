// Shared helpers for the Folio server-side tools.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

const require = createRequire(import.meta.url);
// CommonJS packages with export maps that break ESM default-import interop
// are loaded through createRequire.
const AdmZip = require('adm-zip');

const execFileAsync = promisify(execFile);

// pdf.js needs the StandardFonts directory to render/extract text reliably.
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));
const STANDARD_FONTS = path.join(PDFJS_ROOT, 'standard_fonts') + path.sep;
const TASKS = new WeakMap();
export { PDFDocument, rgb, degrees, StandardFonts };

/* ------------------------- optional system binaries ------------------------ */
// Heavy conversions (Office documents, PDF/A, encryption) need native tools.
// We detect them so those tools can report a precise reason instead of failing.
export function hasBin(name) {
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      try { if (fs.existsSync(path.join(dir, name + ext))) return true; } catch { /* ignore */ }
    }
  }
  return false;
}

export async function runBin(cmd, args, opts = {}) {
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 128 * 1024 * 1024, ...opts });
  return stdout;
}

export const BIN = {
  soffice: () => (hasBin('soffice') ? 'soffice' : hasBin('libreoffice') ? 'libreoffice' : null),
  gs: () => (hasBin('gs') ? 'gs' : null),
  qpdf: () => (hasBin('qpdf') ? 'qpdf' : null),
};

/* ------------------------------ pdf.js helpers ---------------------------- */
// pdf.js needs a canvas implementation when running on the server.
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(cc, width, height) {
    cc.canvas.width = Math.max(1, Math.ceil(width));
    cc.canvas.height = Math.max(1, Math.ceil(height));
  }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; }
}

export async function openPdf(bytes) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: pathToFileURL(STANDARD_FONTS).href,
    verbosity: 0, // pdf.js is noisy about optional standard-font fallbacks
    canvasFactory: new NodeCanvasFactory(),
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    try { await task.destroy(); } catch { /* ignore */ }
    const message = e && e.name === 'PasswordException'
      ? 'This PDF is password-protected. Use "Unlock PDF" first.'
      : 'The file is not a valid PDF (or it is corrupt).';
    throw Object.assign(new Error(message), { status: 422, cause: e });
  }
  TASKS.set(doc, task);
  return doc;
}

export async function closePdf(doc) {
  const task = TASKS.get(doc);
  TASKS.delete(doc);
  if (task && typeof task.destroy === 'function') {
    try { await task.destroy(); } catch { /* ignore */ }
  }
}

/**
 * Render pages one at a time and hand each canvas to `fn`. Yielding per page
 * keeps peak memory at one raster instead of the whole document, which is what
 * makes the 300 DPI OCR path viable on A0-class pages.
 *
 * `scale` may be a number or a function `(widthPt, heightPt) => number` so the
 * caller can pick a scale per page (e.g. a fixed DPI with a pixel budget).
 *
 * `fn` receives: page (1-based), canvas, width, height (pixels), scale,
 * rotation (the page's /Rotate value), viewport, and `toPdfPoint(x, y)` which
 * maps a viewport pixel coordinate back to PDF user space (bottom-left origin,
 * unrotated page) — that is what makes the invisible text layer line up on
 * rotated pages.
 */
export async function forEachRender(bytes, { scale = 2, pages = null } = {}, fn) {
  const doc = await openPdf(bytes);
  try {
    const wanted = pages || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    for (const n of wanted) {
      if (n < 1 || n > doc.numPages) continue;
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const s = typeof scale === 'function' ? scale(base.width, base.height) : scale;
      const viewport = page.getViewport({ scale: s });
      const factory = new NodeCanvasFactory();
      const cc = factory.create(viewport.width, viewport.height);
      try {
        await page.render({ canvasContext: cc.context, viewport, canvasFactory: factory }).promise;
        await fn({
          page: n,
          canvas: cc.canvas,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          scale: s,
          rotation: ((page.rotate % 360) + 360) % 360,
          viewport,
          toPdfPoint: (x, y) => viewport.convertToPdfPoint(x, y),
        });
      } finally {
        factory.destroy(cc);
      }
    }
  } finally {
    await closePdf(doc);
  }
}

/** Render each page to a compressed image. Returns [{ page, width, height, data, format }]. */
export async function rasterizePdf(bytes, { scale = 2, format = 'png', pages = null } = {}) {
  const out = [];
  await forEachRender(bytes, { scale, pages }, ({ page, canvas, width, height }) => {
    const data = format === 'jpg'
      ? canvas.toBuffer('image/jpeg', 90)
      : canvas.toBuffer('image/png');
    out.push({ page, width, height, data, format });
  });
  return out;
}

/** Extract text per page as an array of strings. */
export async function extractText(bytes) {
  const doc = await openPdf(bytes);
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;
      text += item.str;
      if (item.hasEOL) text += '\n';
    }
    pages.push(text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trimEnd());
  }
  await closePdf(doc);
  return pages;
}

/**
 * Text with positions, for the HTML and Markdown converters.
 * Coordinates come from the page viewport, so they are already in reading
 * order space (top-left origin, rotation applied): `x` grows right, `y` grows
 * down, and both are in PDF points at scale 1.
 */
export async function extractLayout(bytes) {
  const doc = await openPdf(bytes);
  const out = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = [];
      for (const it of content.items) {
        if (typeof it.str !== 'string' || !it.str.trim()) continue;
        const t = it.transform;
        const [x, y] = viewport.convertToViewportPoint(t[4], t[5]);
        const size = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 10;
        items.push({ str: it.str, x, y, w: it.width || 0, size, eol: !!it.hasEOL });
      }
      out.push({ page: n, width: viewport.width, height: viewport.height, items });
    }
  } finally {
    await closePdf(doc);
  }
  return out;
}

/**
 * Group positioned items into lines, then lines into paragraphs.
 * Used by both converters so they agree on what a line is.
 */
export function groupLines(pageData) {
  const items = [...pageData.items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const lines = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    const tolerance = Math.max(2, it.size * 0.5);
    if (last && Math.abs(last.y - it.y) <= tolerance) {
      last.items.push(it);
      last.y = Math.min(last.y, it.y);
      last.size = Math.max(last.size, it.size);
    } else {
      lines.push({ y: it.y, size: it.size, items: [it] });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((i) => i.str).join('').replace(/\s+/g, ' ').trim();
    line.x = line.items.length ? line.items[0].x : 0;
  }
  return lines.filter((l) => l.text);
}

/* ------------------------------- pdf-lib glue ----------------------------- */
export async function loadPdf(bytes) {
  return PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
}
export async function savePdf(doc) {
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

/* --------------------------------- zip ------------------------------------ */
export function zip(entries) {
  const z = new AdmZip();
  for (const e of entries) {
    z.addFile(e.name, Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data));
  }
  return Promise.resolve(z.toBuffer());
}

export const mmToPt = (mm) => mm * 2.834645669;
export const clampInt = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
