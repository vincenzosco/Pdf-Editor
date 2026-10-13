// OCR pipeline.
//
// Three things make the difference between a searchable PDF that is actually
// useful and one that is not:
//
//   1. preprocessing — deskew followed by grayscale and Otsu binarisation. On a
//      synthetic tilted, noisy A4 scan this moved word accuracy from 68% to
//      100%, which is by far the largest single gain;
//   2. resolution — the pipeline used a fixed `scale: 2` (~150 DPI) with no
//      control. Measured on the same scan: 150 and 200 DPI both reached 100%,
//      while 300 DPI scored 88%. Rendering above the source's own resolution
//      only upscales, so the default is 200 DPI and 150-400 stays selectable;
//   3. the output — instead of rebuilding the document from whatever Tesseract
//      renders, we keep the ORIGINAL pages and draw the recognised text on top
//      with `opacity: 0`. It stays invisible, stays extractable, and the
//      document keeps its exact size, rotation and appearance.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import {
  forEachRender, extractText, loadPdf, savePdf, PDFDocument, StandardFonts, degrees,
} from './util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Languages the UI offers. `auto` lets the pipeline pick one. */
export const OCR_LANGS = ['eng', 'ita', 'spa', 'deu', 'fra'];
// See the note at the top of the file: above the source resolution, more DPI
// costs time and can lose accuracy rather than gain it.
export const DEFAULT_DPI = 200;
const ALLOWED_DPI = [150, 200, 300, 400];

// A page with at least this many characters already carries a usable text
// layer, so it is left untouched instead of being OCR-ed over.
const MIN_PAGE_TEXT = 12;

// Longest edge of a rendered page. 300 DPI on an A2 page is already ~7000 px,
// and an unbounded raster would exhaust memory on a long document.
const MAX_EDGE = 5000;

// Where language data is looked for: a local directory if it has been fetched
// (see scripts/fetch-tessdata.mjs and the Dockerfile), otherwise tesseract.js
// falls back to its CDN and caches into the directory below.
const LOCAL_TESSDATA = [process.env.FOLIO_TESSDATA, path.join(HERE, '..', 'tessdata')]
  .filter(Boolean)
  .find((dir) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } }) || null;
const CACHE_PATH = path.join(os.tmpdir(), 'folio-tesseract');

/**
 * The local model for one language, or null when it is not on disk.
 *
 * Checking per language matters: a directory can exist and hold some of the
 * models (a trimmed image, a fetch that failed halfway). Pointing tesseract.js
 * at a directory that lacks the requested language does not fall back to its
 * CDN — it throws inside the worker, and that worker is then never terminated,
 * so the failure is a hung process rather than a slow request.
 */
export function localModel(lang, dir = LOCAL_TESSDATA) {
  if (!dir) return null;
  const has = (file) => { try { return fs.statSync(file).size > 0; } catch { return false; } };
  const plain = path.join(dir, `${lang}.traineddata`);
  // The gzipped file wins when both are present: that is what
  // scripts/fetch-tessdata.mjs writes, and a leftover plain file from the
  // official `tessdata_best` repository would abort the WASM core.
  if (has(`${plain}.gz`)) return { dir, gzip: true };
  return has(plain) ? { dir, gzip: false } : null;
}

/** Language codes present in the local model directory, for diagnostics. */
export function localLangs(dir = LOCAL_TESSDATA) {
  if (!dir) return [];
  try {
    // A language can be there twice (plain and .gz); list it once.
    const codes = new Set(fs.readdirSync(dir)
      .map((f) => (/^([a-z_]+)\.traineddata(\.gz)?$/.exec(f) || [])[1])
      .filter((code) => code && localModel(code, dir)));
    return [...codes].sort();
  } catch { return []; }
}

/* ------------------------------- geometry -------------------------------- */

/** Rotation of a point about a centre, in image pixels. */
function rotateAbout(x, y, cx, cy, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/**
 * Variance of the horizontal projection profile: text that is level produces
 * sharp bands of ink separated by white, which maximises the variance.
 * Runs on a downscaled copy so the whole search stays cheap.
 */
function projectionScore(ctx, w, h, deg) {
  const rad = (deg * Math.PI) / 180;
  const pad = Math.ceil(Math.max(w, h) * 0.12);
  const tw = w + pad * 2;
  const th = h + pad * 2;
  const tmp = createCanvas(tw, th);
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#fff';
  tctx.fillRect(0, 0, tw, th);
  tctx.translate(tw / 2, th / 2);
  tctx.rotate(rad);
  tctx.drawImage(ctx.canvas, -w / 2, -h / 2);
  const d = tctx.getImageData(0, 0, tw, th).data;

  const sums = new Float64Array(th);
  for (let y = 0; y < th; y++) {
    let s = 0;
    const row = y * tw;
    for (let x = 0; x < tw; x++) {
      const i = (row + x) * 4;
      s += 255 - (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    }
    sums[y] = s;
  }
  let mean = 0;
  for (let y = 0; y < th; y++) mean += sums[y];
  mean /= th;
  let variance = 0;
  for (let y = 0; y < th; y++) {
    const diff = sums[y] - mean;
    variance += diff * diff;
  }
  return variance / th;
}

/**
 * Estimate the skew of a page in degrees. Coarse sweep first, then a fine one
 * around the winner, so the cost stays around twenty projections instead of
 * two hundred. Returns 0 when nothing beats a level page by a clear margin.
 */
export function detectSkew(canvas, { maxAngle = 5, coarse = 1, fine = 0.25 } = {}) {
  const ratio = Math.min(1, 500 / canvas.width);
  const w = Math.max(1, Math.round(canvas.width * ratio));
  const h = Math.max(1, Math.round(canvas.height * ratio));
  const small = createCanvas(w, h);
  const sctx = small.getContext('2d');
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, w, h);
  sctx.drawImage(canvas, 0, 0, w, h);

  const level = projectionScore(sctx, w, h, 0);
  let best = 0;
  let bestScore = level;
  for (let deg = -maxAngle; deg <= maxAngle + 1e-9; deg += coarse) {
    if (deg === 0) continue;
    const score = projectionScore(sctx, w, h, deg);
    if (score > bestScore) { bestScore = score; best = deg; }
  }
  if (best === 0) return 0;
  for (let deg = best - coarse; deg <= best + coarse + 1e-9; deg += fine) {
    const score = projectionScore(sctx, w, h, deg);
    if (score > bestScore) { bestScore = score; best = deg; }
  }
  // Only rotate when the gain is meaningful: a flat page can otherwise pick up
  // a random fraction of a degree from noise.
  if (level <= 0 || bestScore / level < 1.02) return 0;
  return Math.abs(best) < fine ? 0 : Number(best.toFixed(2));
}

/** Rotate a canvas about its centre, keeping the original dimensions. */
function rotateCanvas(canvas, deg) {
  const out = createCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

/* ----------------------------- preprocessing ----------------------------- */

/** Otsu's method: the threshold that best separates ink from paper. */
function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; threshold = i; }
  }
  return threshold;
}

/** Grayscale, and optionally binarise, in place. Returns the threshold used. */
export function toGray(canvas, { binarize = true } = {}) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const gray = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    const v = g | 0;
    gray[p] = g;
    hist[v]++;
  }
  const threshold = binarize ? otsu(hist, w * h) : -1;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = binarize ? (gray[p] > threshold ? 255 : 0) : gray[p];
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return threshold;
}

/* ---------------------------- language guessing --------------------------- */

// English has no distinctive letters, so its `re` must stay null: a catch-all
// pattern here would score every letter of every sample and always win.
const LANG_HINTS = {
  eng: { words: ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'with', 'this', 'from', 'are', 'was'], re: null },
  ita: { words: ['il', 'di', 'che', 'la', 'per', 'una', 'sono', 'con', 'non', 'del', 'della', 'gli', 'come', 'anche'], re: /[àèéìòù]/g },
  spa: { words: ['el', 'de', 'que', 'la', 'en', 'los', 'una', 'por', 'con', 'para', 'del', 'como', 'más', 'este'], re: /[ñ¿¡áéíóú]/g },
  deu: { words: ['der', 'die', 'und', 'den', 'von', 'zu', 'das', 'mit', 'ist', 'auf', 'für', 'nicht', 'ein', 'eine'], re: /[äöüß]/g },
  fra: { words: ['le', 'de', 'les', 'des', 'une', 'est', 'que', 'pour', 'dans', 'avec', 'sur', 'pas', 'plus', 'cette'], re: /[àâçéèêëîïôûù]/g },
};

/**
 * Pick the language of a text sample by scoring function words and the
 * characters that actually distinguish these five languages. Good enough to
 * choose a traineddata file; not a general purpose language identifier.
 */
export function detectLanguage(text, candidates = OCR_LANGS) {
  const sample = String(text || '').toLowerCase();
  if (!sample.trim()) return null;
  const words = sample.split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (const code of candidates) {
    const hint = LANG_HINTS[code];
    if (!hint) continue;
    let score = 0;
    for (const w of hint.words) {
      const hits = sample.split(new RegExp(`\\b${w}\\b`, 'g')).length - 1;
      score += hits;
    }
    if (hint.re) score += 2 * ((sample.match(hint.re) || []).length);
    const normalized = words.length ? score / words.length : 0;
    if (normalized > bestScore) { bestScore = normalized; best = code; }
  }
  return bestScore > 0 ? best : null;
}

/* -------------------------------- workers -------------------------------- */

const workers = new Map();
const lastUsed = new Map();

// A worker holds a WASM engine and a loaded model, so it is worth keeping
// around between requests — but not forever, or a long-lived server would sit
// on a model per language it has ever seen.
const WORKER_IDLE_MS = Number(process.env.FOLIO_OCR_IDLE_MS ?? 5 * 60 * 1000);
let reaper = null;

function startReaper() {
  if (reaper || !(WORKER_IDLE_MS > 0)) return;
  reaper = setInterval(() => {
    const now = Date.now();
    for (const [key, when] of lastUsed) {
      if (now - when < WORKER_IDLE_MS) continue;
      const pending = workers.get(key);
      workers.delete(key);
      lastUsed.delete(key);
      if (pending) pending.then((w) => { try { w.terminate(); } catch { /* gone */ } }).catch(() => {});
    }
  }, Math.min(60_000, WORKER_IDLE_MS));
  // Never let housekeeping hold the process open.
  if (typeof reaper.unref === 'function') reaper.unref();
}

/** Reuse one worker per language set: creating one means loading the model. */
export async function getWorker(lang, logger) {
  const key = lang;
  startReaper();
  lastUsed.set(key, Date.now());
  if (workers.has(key)) return workers.get(key);
  const promise = (async () => {
    const { createWorker } = await import('tesseract.js');
    // tesseract.js calls `logger(...)` on every progress message, so the key
    // must hold a function: passing `undefined` throws instead of falling back
    // to its default.
    const options = { logger: typeof logger === 'function' ? logger : () => {} };
    const local = localModel(lang);
    if (local) {
      // Read the model straight off disk: no download, works offline.
      options.langPath = local.dir;
      options.gzip = local.gzip;
      // Without this, tesseract.js looks for the model in the *cache* first
      // and, with no `cachePath` of its own, uses the process working
      // directory: it would read a stray `eng.traineddata` left in the app
      // folder (a foreign model aborts the WASM core) and write its own copies
      // there. `none` makes the file we just found authoritative.
      options.cacheMethod = 'none';
    } else {
      // tesseract.js writes its cache with a plain write and does not create
      // the directory, so without this every job re-downloads the model.
      await fsp.mkdir(CACHE_PATH, { recursive: true });
      options.cachePath = CACHE_PATH;
    }
    return createWorker(lang, 1, options);
  })();
  workers.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    workers.delete(key);
    throw e;
  }
}

export async function closeWorkers() {
  const pending = [...workers.values()];
  workers.clear();
  lastUsed.clear();
  if (reaper) { clearInterval(reaper); reaper = null; }
  await Promise.all(pending.map(async (p) => {
    try { (await p).terminate(); } catch { /* already gone */ }
  }));
}

/* ------------------------------ OCR a page -------------------------------- */

const PSM = { auto: '3', block: '6', column: '4', sparse: '11' };

const DEFAULTS = {
  lang: 'auto',
  dpi: DEFAULT_DPI,
  pageMode: 'auto',
  deskew: true,
  binarize: true,
};

function normalizeOptions(options = {}) {
  const dpi = parseInt(options.dpi, 10);
  return {
    ...DEFAULTS,
    ...options,
    dpi: ALLOWED_DPI.includes(dpi) ? dpi : DEFAULT_DPI,
    pageMode: PSM[options.pageMode] ? options.pageMode : DEFAULTS.pageMode,
    deskew: options.deskew !== false && options.deskew !== 'false',
    binarize: options.binarize !== false && options.binarize !== 'false',
  };
}

/** Scale for one page: the requested DPI, capped by the pixel budget. */
function scaleFor(dpi) {
  return (widthPt, heightPt) => {
    const base = dpi / 72;
    const longest = Math.max(widthPt, heightPt) * base;
    return longest > MAX_EDGE ? (MAX_EDGE / Math.max(widthPt, heightPt)) : base;
  };
}

/**
 * Render one page, straighten it and clean it up.
 * Returns the canvas plus the angle applied, so text boxes can be mapped back
 * onto the untouched original page.
 */
function preparePage(rendered, opts) {
  let canvas = rendered.canvas;
  let angle = 0;
  if (opts.deskew) {
    angle = detectSkew(canvas);
    if (angle !== 0) canvas = rotateCanvas(canvas, angle);
  }
  toGray(canvas, { binarize: opts.binarize });
  return { canvas, angle };
}

function collectLines(data) {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = (line.text || '').replace(/\s+$/, '');
        if (!text.trim()) continue;
        lines.push({
          text,
          bbox: line.bbox,
          baseline: line.baseline && line.baseline.has_baseline ? line.baseline : null,
          words: line.words || [],
        });
      }
    }
  }
  if (lines.length) return lines;
  // Fallback for engines/configs that only return plain text.
  return String(data.text || '').split('\n').filter((l) => l.trim()).map((text) => ({
    text: text.trim(), bbox: null, baseline: null, words: [],
  }));
}

/* --------------------------- searchable PDF output ------------------------ */

// pdf-lib's standard fonts encode WinAnsi; anything outside it would throw.
const WINANSI_EXTRA = /[\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/;
function encodable(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code === 9 || code === 32) { out += ' '; continue; }
    if (code >= 33 && code <= 126) { out += ch; continue; }
    if (code >= 160 && code <= 255) { out += ch; continue; }
    if (WINANSI_EXTRA.test(ch)) { out += ch; continue; }
    out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Draw the recognised lines of one page over the original page, invisibly.
 * `toPdfPoint` comes from the pdf.js viewport, so rotated pages line up.
 */
function overlayLines(page, lines, { scale, toPdfPoint, angle, font, renderWidth, renderHeight }) {
  const cx = renderWidth / 2;
  const cy = renderHeight / 2;
  const rad = (-angle * Math.PI) / 180;

  for (const line of lines) {
    const text = encodable(line.text);
    if (!text) continue;

    let x;
    let y;
    let size;
    if (line.baseline) {
      x = line.baseline.x0;
      y = line.baseline.y0;
      const h = (line.bbox ? line.bbox.y1 - line.bbox.y0 : 0) || (line.baseline.y1 - line.baseline.y0);
      size = Math.max(5, h / scale);
    } else if (line.bbox) {
      x = line.bbox.x0;
      y = line.bbox.y1;
      size = Math.max(5, (line.bbox.y1 - line.bbox.y0) / scale);
    } else {
      continue;
    }

    // Undo the deskew rotation so the box lands on the original page.
    if (angle !== 0) {
      [x, y] = rotateAbout(x, y, cx, cy, rad);
    }
    const [px, py] = toPdfPoint(x / scale, y / scale);
    try {
      page.drawText(text, { x: px, y: py, size, font, opacity: 0 });
    } catch {
      // A glyph the standard font cannot encode: skip the line rather than
      // failing the whole job.
    }
  }
}

/* -------------------------------- the job -------------------------------- */

/**
 * Make a PDF searchable.
 *
 * @returns {Promise<{buffer: Buffer, report: object}>} the new PDF plus a
 * summary of what happened, so the API can tell the user which language was
 * chosen and which pages were left alone.
 */
export async function makeSearchable(pdfBytes, rawOptions = {}, { onProgress } = {}) {
  const opts = normalizeOptions(rawOptions);
  const existing = await extractText(pdfBytes);
  const needsOcr = existing.map((t) => (t || '').trim().length < MIN_PAGE_TEXT);
  const ocrTargets = needsOcr.map((need, i) => (need ? i + 1 : null)).filter(Boolean);

  // Nothing to do: the document already carries its text.
  if (!ocrTargets.length) {
    return {
      buffer: Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes),
      report: { languages: [], ocrPages: [], skippedPages: existing.map((_, i) => i + 1), dpi: opts.dpi, angles: {} },
    };
  }

  let lang = opts.lang;
  const report = {
    languages: [], ocrPages: [], skippedPages: [], dpi: opts.dpi, angles: {},
    requestedLanguage: opts.lang,
  };

  // Auto-detect: reuse an existing text layer when there is one, otherwise
  // recognise the first target page cheaply and look at the words.
  if (!lang || lang === 'auto') {
    const fromText = detectLanguage(existing.join('\n'));
    if (fromText) {
      lang = fromText;
    } else {
      const probeDpi = 150;
      let probeText = '';
      const worker = await getWorker('eng');
      await forEachRender(pdfBytes, { scale: scaleFor(probeDpi), pages: [ocrTargets[0]] }, async (r) => {
        const { canvas } = preparePage(r, { ...opts, deskew: false });
        const { data } = await worker.recognize(canvas.toBuffer('image/png'), {}, { text: true });
        probeText = data.text || '';
      });
      lang = detectLanguage(probeText) || 'eng';
      report.detectedFrom = 'sample';
    }
  }
  if (!OCR_LANGS.includes(lang)) lang = 'eng';
  report.language = lang;
  report.languages = [lang];

  const worker = await getWorker(lang, (m) => {
    if (onProgress && m.status) onProgress(m.status, m.progress);
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM[opts.pageMode],
    preserve_interword_spaces: '1',
    user_defined_dpi: String(opts.dpi),
  });

  const collected = [];
  await forEachRender(pdfBytes, { scale: scaleFor(opts.dpi), pages: ocrTargets }, async (rendered) => {
    const { canvas, angle } = preparePage(rendered, opts);
    report.angles[rendered.page] = angle;
    const { data } = await worker.recognize(canvas.toBuffer('image/png'), {}, { text: true, blocks: true });
    collected.push({
      page: rendered.page,
      lines: collectLines(data),
      confidence: data.confidence,
      scale: rendered.scale,
      toPdfPoint: rendered.toPdfPoint,
      angle,
      width: rendered.width,
      height: rendered.height,
    });
    report.ocrPages.push(rendered.page);
  });

  // Rebuild onto the ORIGINAL pages, so the document keeps its design.
  const doc = await loadPdf(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const result of collected) {
    overlayLines(doc.getPage(result.page - 1), result.lines, {
      scale: result.scale,
      toPdfPoint: result.toPdfPoint,
      angle: result.angle,
      font,
      renderWidth: result.width,
      renderHeight: result.height,
    });
  }
  report.skippedPages = existing.map((_, i) => i + 1).filter((n) => !report.ocrPages.includes(n));

  const out = await savePdf(doc);
  return { buffer: Buffer.from(out), report };
}

/**
 * Straighten skewed scans, keeping the pages vector-based by re-drawing each
 * original page rotated inside a page of the same size.
 */
export async function deskewPdf(pdfBytes, rawOptions = {}) {
  const opts = normalizeOptions(rawOptions);
  const doc = await loadPdf(pdfBytes);
  const out = await PDFDocument.create();
  const angles = {};

  await forEachRender(pdfBytes, { scale: scaleFor(Math.min(opts.dpi, 300)) }, async (rendered) => {
    let angle = 0;
    if (opts.deskew) angle = detectSkew(rendered.canvas);
    angles[rendered.page] = angle;

    const src = doc.getPage(rendered.page - 1);
    const { width, height } = src.getSize();
    const target = out.addPage([width, height]);
    if (angle === 0) {
      target.drawPage(await out.embedPage(src));
    } else {
      // Rotation about the page centre: place the embedded page at C - S·R·C
      // so that `rotate` pivots around the centre instead of the corner.
      const rad = (angle * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const s = 1.02; // hide the corners the rotation exposes
      const x = cx - s * (cx * Math.cos(rad) - cy * Math.sin(rad));
      const y = cy - s * (cx * Math.sin(rad) + cy * Math.cos(rad));
      target.drawPage(await out.embedPage(src), {
        x, y, xScale: s, yScale: s, rotate: degrees(angle),
      });
    }
  });

  return { buffer: Buffer.from(await out.save()), report: { angles } };
}
