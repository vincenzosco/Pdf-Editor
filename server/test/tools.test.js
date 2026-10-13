import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { tools, availability } from '../tools/index.js';
import { createApp } from '../index.js';
import {
  detectLanguage, makeSearchable, closeWorkers, localModel, localLangs,
} from '../lib/ocr.js';
import { extractText } from '../lib/util.js';

// The OCR worker threads keep the event loop alive, so the runner would hang
// after the last test without this.
after(closeWorkers);

/* ------------------------------ fixtures ---------------------------------- */
async function samplePdf(pages = 2) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Invoice line ${i + 1}`, { x: 60, y: 720, size: 18, font, color: rgb(0, 0, 0) });
    page.drawText('Total 100 EUR', { x: 60, y: 690, size: 12, font, color: rgb(0, 0, 0) });
  }
  return Buffer.from(await doc.save());
}
function samplePng() {
  const canvas = createCanvas(160, 60);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 160, 60);
  ctx.fillStyle = '#1f4c82';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Signature', 8, 40);
  return canvas.toBuffer('image/png');
}
const pdfFile = (buffer, name = 'sample.pdf') => ({ field: 'files', name, mimetype: 'application/pdf', buffer });
const pngFile = (buffer, name = 'sig.png') => ({ field: 'files', name, mimetype: 'image/png', buffer });

// A synthetic "scan": the text is baked into an image, so the PDF has no text
// layer and OCR is the only way to read it. Optionally tilted, like a page fed
// into a flatbed scanner by hand.
const SCAN_WORDS = 'Relazione tecnica riconoscimento del testo quarantadue pagine';
async function scannedPdf({ tilt = 0 } = {}) {
  const W = 1240;
  const H = 1754;
  const paper = createCanvas(W, H);
  const pctx = paper.getContext('2d');
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, W, H);
  pctx.fillStyle = '#1b1c20';
  pctx.font = '34px serif';
  pctx.fillText('Relazione tecnica sul riconoscimento', 110, 300);
  pctx.fillText('del testo di quarantadue pagine', 110, 360);

  const tilted = createCanvas(W, H);
  const tctx = tilted.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, W, H);
  tctx.translate(W / 2, H / 2);
  tctx.rotate((tilt * Math.PI) / 180);
  tctx.drawImage(paper, -W / 2, -H / 2);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const png = await doc.embedPng(tilted.toBuffer('image/png'));
  page.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return Buffer.from(await doc.save());
}

/* ------------------------------- registry --------------------------------- */
test('registry exposes all 22 tools', () => {
  assert.equal(Object.keys(tools).length, 22);
});

test('availability marks pure-JS tools available and binary tools unavailable', () => {
  const av = availability();
  assert.equal(av['pdf-to-word'].available, true);
  assert.equal(av['pdf-to-jpg'].available, true);
  // This CI/dev box has no Ghostscript, so PDF/A must report a precise reason.
  assert.equal(av['pdf-to-pdfa'].available, false);
  assert.match(av['pdf-to-pdfa'].reason, /Ghostscript/);
});

/* -------------------------------- tools ----------------------------------- */
test('pdf-to-jpg returns a JPEG for a single page', async () => {
  const out = await tools['pdf-to-jpg'].run({ files: [pdfFile(await samplePdf(1))], options: {} });
  assert.equal(out.mime, 'image/jpeg');
  assert.equal(out.buffer.subarray(0, 2).toString('hex'), 'ffd8'); // JPEG SOI
});

test('pdf-to-jpg returns a zip for multiple pages', async () => {
  const out = await tools['pdf-to-jpg'].run({ files: [pdfFile(await samplePdf(3))], options: {} });
  assert.equal(out.mime, 'application/zip');
  assert.equal(out.buffer.subarray(0, 2).toString(), 'PK');
});

test('pdf-to-word produces a DOCX (zip) file', async () => {
  const out = await tools['pdf-to-word'].run({ files: [pdfFile(await samplePdf())], options: {} });
  assert.match(out.mime, /wordprocessingml/);
  assert.equal(out.buffer.subarray(0, 2).toString(), 'PK');
  assert.match(out.filename, /\.docx$/);
});

test('pdf-to-excel produces an XLSX (zip) file', async () => {
  const out = await tools['pdf-to-excel'].run({ files: [pdfFile(await samplePdf())], options: {} });
  assert.match(out.mime, /spreadsheetml/);
  assert.equal(out.buffer.subarray(0, 2).toString(), 'PK');
});

test('pdf-to-ppt produces a PPTX (zip) file', async () => {
  const out = await tools['pdf-to-ppt'].run({ files: [pdfFile(await samplePdf(2))], options: {} });
  assert.match(out.mime, /presentationml/);
  assert.equal(out.buffer.subarray(0, 2).toString(), 'PK');
});

test('repair returns a valid PDF', async () => {
  const out = await tools.repair.run({ files: [pdfFile(await samplePdf())], options: {} });
  assert.equal(out.mime, 'application/pdf');
  const loaded = await PDFDocument.load(out.buffer);
  assert.equal(loaded.getPageCount(), 2);
});

test('sign stamps a signature image and keeps the page count', async () => {
  const out = await tools.sign.run({
    files: [pdfFile(await samplePdf()), pngFile(samplePng())],
    options: { page: 1, widthMm: 40 },
  });
  assert.equal(out.mime, 'application/pdf');
  const loaded = await PDFDocument.load(out.buffer);
  assert.equal(loaded.getPageCount(), 2);
});

test('sign errors without a signature image', async () => {
  const pdf = await samplePdf();
  await assert.rejects(
    () => tools.sign.run({ files: [pdfFile(pdf)], options: {} }),
    /signature image is required/,
  );
});

test('forms lists fields when no values are provided', async () => {
  const out = await tools.forms.run({ files: [pdfFile(await samplePdf())], options: {} });
  assert.equal(out.mime, 'application/json');
  const parsed = JSON.parse(out.buffer.toString('utf8'));
  assert.ok(Array.isArray(parsed.fields));
});

test('redact draws rectangles and returns a PDF', async () => {
  const out = await tools.redact.run({
    files: [pdfFile(await samplePdf())],
    options: { rects: JSON.stringify([{ page: 1, x: 50, y: 60, w: 200, h: 40 }]) },
  });
  assert.equal(out.mime, 'application/pdf');
});

test('compare returns an HTML report', async () => {
  const a = await samplePdf(1);
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  const b = Buffer.from(await doc.save());
  const out = await tools.compare.run({ files: [pdfFile(a, 'a.pdf'), pdfFile(b, 'b.pdf')], options: {} });
  assert.match(out.mime, /text\/html/);
  assert.match(out.buffer.toString('utf8'), /Comparison/);
});

test('ocr / scan reject empty input', async () => {
  await assert.rejects(() => tools.scan.run({ files: [], options: {} }), /at least one/i);
});

/* ------------------------- new tools (this change) ------------------------ */
test('language detection picks Italian from Italian prose, English from English', () => {
  assert.equal(detectLanguage('Il presente documento descrive il funzionamento del sistema e delle sue parti'), 'ita');
  assert.equal(detectLanguage('The present document describes how the system works and what it does'), 'eng');
  assert.equal(detectLanguage('Der vorliegende Text beschreibt die Funktion und das Verhalten des Systems'), 'deu');
  assert.equal(detectLanguage(''), null);
});

test('extract-text returns a txt with a page banner', async () => {
  const out = await tools['extract-text'].run({ files: [pdfFile(await samplePdf(2))], options: {} });
  assert.match(out.mime, /text\/plain/);
  assert.match(out.filename, /\.txt$/);
  const text = out.buffer.toString('utf8');
  assert.match(text, /--- Page 1\/2 ---/);
  assert.match(text, /Invoice line 1/);
  assert.match(text, /Invoice line 2/);
});

test('extract-text in pages mode returns a zip of one txt per page', async () => {
  const out = await tools['extract-text'].run({
    files: [pdfFile(await samplePdf(2))], options: { mode: 'pages' },
  });
  assert.equal(out.mime, 'application/zip');
  assert.equal(out.buffer.subarray(0, 2).toString(), 'PK');
});

test('pdf-to-html returns positioned HTML containing the page text', async () => {
  const out = await tools['pdf-to-html'].run({ files: [pdfFile(await samplePdf(1))], options: {} });
  assert.match(out.mime, /text\/html/);
  const html = out.buffer.toString('utf8');
  assert.match(html, /Invoice line 1/);
  assert.match(html, /class="page"/);
  assert.match(html, /<!doctype html>/i);
});

test('pdf-to-markdown returns a .md file containing the page text', async () => {
  const out = await tools['pdf-to-markdown'].run({ files: [pdfFile(await samplePdf(1))], options: {} });
  assert.match(out.mime, /text\/markdown/);
  assert.match(out.filename, /\.md$/);
  assert.match(out.buffer.toString('utf8'), /Invoice line 1/);
});

test('deskew refuses a PDF whose pages are already level', async () => {
  const pdf = await samplePdf(1);
  await assert.rejects(
    () => tools.deskew.run({ files: [pdfFile(pdf)], options: {} }),
    /already level/i,
  );
});

test('deskew straightens a tilted scan and keeps the page size', async () => {
  const out = await tools.deskew.run({ files: [pdfFile(await scannedPdf({ tilt: -3 }))], options: { dpi: 150 } });
  assert.equal(out.mime, 'application/pdf');
  assert.ok(Math.abs(out.report.angles['1']) > 1, `expected a detected tilt, got ${out.report.angles['1']}`);
  const loaded = await PDFDocument.load(out.buffer);
  assert.equal(loaded.getPageCount(), 1);
  const { width, height } = loaded.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, `page resized to ${width}x${height}`);
});

test('a language missing from the local model directory is not taken from it', () => {
  // A directory that exists but holds only some languages must not be handed to
  // tesseract.js as `langPath` for the others: it does not fall back, it throws
  // inside the worker — and that worker stays alive, hanging the process.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-tessdata-'));
  try {
    fs.writeFileSync(path.join(dir, 'ita.traineddata'), 'not really a model');
    fs.writeFileSync(path.join(dir, 'fra.traineddata.gz'), 'nor this');
    fs.writeFileSync(path.join(dir, 'eng.traineddata'), '');
    // Both present: the gzipped file wins, because that is what the fetch
    // script writes and the plain one may be an unloadable float model.
    fs.writeFileSync(path.join(dir, 'deu.traineddata'), 'plain');
    fs.writeFileSync(path.join(dir, 'deu.traineddata.gz'), 'zipped');

    assert.deepEqual(localModel('ita', dir), { dir, gzip: false });
    assert.deepEqual(localModel('fra', dir), { dir, gzip: true });
    assert.deepEqual(localModel('deu', dir), { dir, gzip: true });
    assert.equal(localModel('eng', dir), null, 'an empty file is not a model');
    assert.equal(localModel('spa', dir), null);
    assert.equal(localModel('ita', null), null, 'no directory means no local model');
    assert.deepEqual(localLangs(dir), ['deu', 'fra', 'ita'], 'only usable models are listed');
    assert.deepEqual(localLangs(path.join(dir, 'nope')), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('OCR reads a scan, detects the language and keeps the original page', async () => {
  const scan = await scannedPdf();
  const raw = await extractText(scan);
  assert.equal(raw[0].trim(), '', 'the fixture must have no text layer to be a real OCR test');

  const out = await tools.ocr.run({
    files: [pdfFile(scan)], options: { lang: 'auto', dpi: 150 },
  });
  assert.equal(out.mime, 'application/pdf');
  assert.equal(out.report.language, 'ita', 'auto-detection should find Italian');

  const loaded = await PDFDocument.load(out.buffer);
  const { width, height } = loaded.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, 'page size must be preserved');

  const text = (await extractText(out.buffer))[0];
  const found = SCAN_WORDS.split(' ').filter((w) => text.includes(w));
  assert.ok(found.length >= 5, `only found ${found.length} words in: ${text.slice(0, 120)}`);
});

test('makeSearchable leaves a page that already has text untouched', async () => {
  const before = await samplePdf(1);
  const { buffer, report } = await makeSearchable(before, { lang: 'eng', dpi: 150 });
  assert.deepEqual(report.ocrPages, [], 'nothing should have been OCR-ed');
  assert.equal((await extractText(buffer))[0].includes('Invoice line 1'), true);
});

/* --------------------------------- HTTP ----------------------------------- */
test('HTTP: a corrupt PDF is rejected with a friendly 422', async () => {
  const server = createApp().listen(0);
  const { port } = server.address();
  try {
    const form = new FormData();
    form.append('files', new Blob([Buffer.from('%PDF-1.4 not really a pdf')], { type: 'application/pdf' }), 'bad.pdf');
    const res = await fetch(`http://127.0.0.1:${port}/api/tools/pdf-to-word`, { method: 'POST', body: form });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.match(body.error, /valid PDF|corrupt/i);
  } finally {
    server.close();
  }
});

test('HTTP: static site + tool API end to end', async () => {
  const server = createApp().listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);

    const list = await fetch(`${base}/api/tools`);
    assert.equal(list.status, 200);
    const listJson = await list.json();
    assert.equal(listJson.count, 22);
    assert.ok(listJson.tools['extract-text'].available);
    assert.ok(listJson.tools.deskew.available);
    assert.ok(listJson.tools['pdf-to-markdown'].available);

    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Folio/);

    const app = await fetch(`${base}/app.html`);
    assert.equal(app.status, 200);

    const vendor = await fetch(`${base}/vendor/pdf-lib.min.js`);
    assert.equal(vendor.status, 200);

    const priv = await fetch(`${base}/package.json`);
    assert.equal(priv.status, 404, 'package.json must not be exposed');

    const form = new FormData();
    form.append('files', new Blob([await samplePdf()], { type: 'application/pdf' }), 'sample.pdf');
    form.append('options', '{}');
    const conv = await fetch(`${base}/api/tools/pdf-to-word`, { method: 'POST', body: form });
    assert.equal(conv.status, 200);
    assert.match(conv.headers.get('content-type'), /wordprocessingml/);
    assert.ok((await conv.arrayBuffer()).byteLength > 0);

    const gated = new FormData();
    gated.append('files', new Blob([await samplePdf()], { type: 'application/pdf' }), 'sample.pdf');
    const gatedRes = await fetch(`${base}/api/tools/pdf-to-pdfa`, { method: 'POST', body: gated });
    assert.equal(gatedRes.status, 503);

    const unknown = await fetch(`${base}/api/tools/nope`, { method: 'POST', body: new FormData() });
    assert.equal(unknown.status, 404);

    // Tools that have something to say report it in a header, so the body
    // stays the raw file.
    const reportForm = new FormData();
    reportForm.append('files', new Blob([await samplePdf(1)], { type: 'application/pdf' }), 'sample.pdf');
    reportForm.append('options', '{}');
    const reported = await fetch(`${base}/api/tools/extract-text`, { method: 'POST', body: reportForm });
    assert.equal(reported.status, 200);
    const report = JSON.parse(reported.headers.get('x-folio-report'));
    assert.equal(report.pages, 1);
    assert.equal(report.ocrPages.length, 0);
  } finally {
    server.close();
  }
});
