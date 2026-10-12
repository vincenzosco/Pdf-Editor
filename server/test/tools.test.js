import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { tools, availability } from '../tools/index.js';
import { createApp } from '../index.js';

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

/* ------------------------------- registry --------------------------------- */
test('registry exposes all 18 tools', () => {
  assert.equal(Object.keys(tools).length, 18);
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
    assert.equal(listJson.count, 18);

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
  } finally {
    server.close();
  }
});
