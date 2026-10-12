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

/** Render each page to an image. Returns [{ page, width, height, data, format }]. */
export async function rasterizePdf(bytes, { scale = 2, format = 'png', pages = null } = {}) {
  const doc = await openPdf(bytes);
  const out = [];
  const wanted = pages || Array.from({ length: doc.numPages }, (_, i) => i + 1);
  for (const n of wanted) {
    if (n < 1 || n > doc.numPages) continue;
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    const factory = new NodeCanvasFactory();
    const cc = factory.create(viewport.width, viewport.height);
    await page.render({ canvasContext: cc.context, viewport, canvasFactory: factory }).promise;
    const data = format === 'jpg'
      ? cc.canvas.toBuffer('image/jpeg', 90)
      : cc.canvas.toBuffer('image/png');
    out.push({ page: n, width: Math.round(viewport.width), height: Math.round(viewport.height), data, format });
    factory.destroy(cc);
  }
  await closePdf(doc);
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
