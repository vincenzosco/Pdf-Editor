// Server-side tool registry. Each tool exposes availability() and run(ctx).
// Heavy converters (Office/PDF-A/encryption) use optional native binaries and
// report a precise reason when those binaries are not installed.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  PDFDocument, rgb, StandardFonts,
  rasterizePdf, extractText, loadPdf, savePdf, zip, BIN, runBin,
  mmToPt, clampInt,
} from '../lib/util.js';

const require = createRequire(import.meta.url);
const docxMod = require('docx');
const ExcelJS = require('exceljs');
const pptxMod = require('pptxgenjs');
const PptxGenJS = pptxMod.default || pptxMod;

export const MIME = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const err = (message, status = 400) => Object.assign(new Error(message), { status });
const file = (filename, mime, buffer) => ({ filename, mime, buffer: Buffer.from(buffer) });
const baseName = (name) =>
  String(name || 'document').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'document';

const firstPdf = (ctx) => {
  const f = ctx.files.find((x) => x.mimetype === 'application/pdf' || /\.pdf$/i.test(x.name));
  if (!f) throw err('A PDF file is required.');
  return f;
};
const imageFiles = (files) => files.filter((x) => /^image\/(png|jpe?g)$/i.test(x.mimetype));
const pdfIfAny = (files) => files.find((x) => x.mimetype === 'application/pdf' || /\.pdf$/i.test(x.name));
const scaleOf = (ctx) => {
  const n = parseFloat(ctx.options.scale);
  return Number.isFinite(n) ? Math.min(4, Math.max(0.5, n)) : 2;
};

async function inTempDir(fn) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'folio-'));
  try { return await fn(dir); } finally { await fsp.rm(dir, { recursive: true, force: true }); }
}
const writeTemp = async (dir, name, buffer) => {
  const p = path.join(dir, name);
  await fsp.writeFile(p, buffer);
  return p;
};

/* --------------------------------- OCR ------------------------------------ */
async function imagesToSearchablePdf(buffers, lang) {
  const { createWorker } = await import('tesseract.js');
  // Keep the downloaded language data out of the project directory.
  const worker = await createWorker(lang || 'eng', 1, {
    cachePath: path.join(os.tmpdir(), 'folio-tesseract'),
  });
  const pages = [];
  try {
    for (const b of buffers) {
      const { data } = await worker.recognize(b, {}, { pdf: true });
      if (data && data.pdf) pages.push(Buffer.from(data.pdf));
    }
  } finally {
    await worker.terminate();
  }
  if (!pages.length) throw err('No text could be recognised.', 422);
  const out = await PDFDocument.create();
  for (const p of pages) {
    const src = await PDFDocument.load(p);
    for (const pg of await out.copyPages(src, src.getPageIndices())) out.addPage(pg);
  }
  return Buffer.from(await out.save());
}

/* ------------------------------ Office / PDF-A ----------------------------- */
async function sofficeConvert(ctx, inExt) {
  const bin = BIN.soffice();
  if (!bin) throw err('Converting Office documents needs LibreOffice (soffice) on the server.', 501);
  const src = ctx.files[0];
  if (!src) throw err('A document is required.');
  return inTempDir(async (dir) => {
    const inPath = await writeTemp(dir, 'input' + inExt, src.buffer);
    await runBin(bin, ['--headless', '--convert-to', 'pdf', '--outdir', dir, inPath]);
    const outPath = path.join(dir, 'input.pdf');
    if (!fs.existsSync(outPath)) throw err('The document could not be converted.', 422);
    return file(baseName(src.name) + '.pdf', MIME.pdf, await fsp.readFile(outPath));
  });
}

/* -------------------------------- registry -------------------------------- */
export const tools = {
  /* ---- raster / image ---- */
  'pdf-to-jpg': {
    label: 'PDF to JPG',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const base = baseName(pdf.name);
      const imgs = await rasterizePdf(pdf.buffer, { scale: scaleOf(ctx), format: 'jpg' });
      const entries = imgs.map((i) => ({
        name: `${base}-page-${String(i.page).padStart(3, '0')}.jpg`, data: i.data,
      }));
      if (entries.length === 1) return file(entries[0].name, 'image/jpeg', entries[0].data);
      return file(`${base}-jpg.zip`, MIME.zip, await zip(entries));
    },
  },

  'pdf-to-ppt': {
    label: 'PDF to PowerPoint',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const imgs = await rasterizePdf(pdf.buffer, { scale: scaleOf(ctx), format: 'png' });
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'FOLIO_A4', width: 8.27, height: 11.69 });
      pptx.layout = 'FOLIO_A4';
      for (const img of imgs) {
        const slide = pptx.addSlide();
        slide.addImage({
          data: `data:image/png;base64,${img.data.toString('base64')}`,
          x: 0, y: 0, w: 8.27, h: 11.69,
        });
      }
      const buf = await pptx.write({ outputType: 'nodebuffer' });
      return file(baseName(pdf.name) + '.pptx', MIME.pptx, buf);
    },
  },

  ocr: {
    label: 'OCR PDF',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const imgs = await rasterizePdf(pdf.buffer, { scale: scaleOf(ctx), format: 'png' });
      const pdfBytes = await imagesToSearchablePdf(imgs.map((i) => i.data), ctx.options.lang);
      return file(baseName(pdf.name) + '-ocr.pdf', MIME.pdf, pdfBytes);
    },
  },

  scan: {
    label: 'Scan to PDF',
    async run(ctx) {
      const imgs = imageFiles(ctx.files);
      const pdf = pdfIfAny(ctx.files);
      let buffers = imgs.map((i) => i.buffer);
      if (!buffers.length && pdf) {
        buffers = (await rasterizePdf(pdf.buffer, { scale: scaleOf(ctx), format: 'png' })).map((i) => i.data);
      }
      if (!buffers.length) throw err('Upload at least one PNG/JPG image or a PDF.');
      const name = pdf ? baseName(pdf.name) : baseName(ctx.files[0].name);
      const pdfBytes = await imagesToSearchablePdf(buffers, ctx.options.lang);
      return file(name + '-scan.pdf', MIME.pdf, pdfBytes);
    },
  },

  /* ---- text extraction ---- */
  'pdf-to-word': {
    label: 'PDF to Word',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const pages = await extractText(pdf.buffer);
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docxMod;
      const children = [];
      pages.forEach((text, i) => {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`Page ${i + 1}`)] }));
        const lines = text.split('\n');
        if (!lines.length) children.push(new Paragraph(''));
        for (const line of lines) children.push(new Paragraph({ children: [new TextRun(line)] }));
      });
      const doc = new Document({ sections: [{ children }] });
      const buf = await Packer.toBuffer(doc);
      return file(baseName(pdf.name) + '.docx', MIME.docx, buf);
    },
  },

  'pdf-to-excel': {
    label: 'PDF to Excel',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const pages = await extractText(pdf.buffer);
      const wb = new ExcelJS.Workbook();
      pages.forEach((text, i) => {
        const ws = wb.addWorksheet((`Page ${i + 1}`).slice(0, 31));
        for (const line of text.split('\n')) {
          const cells = line.split(/\t| {2,}/).map((s) => s.trim()).filter((s) => s.length);
          ws.addRow(cells.length ? cells : [line]);
        }
      });
      const buf = await wb.xlsx.writeBuffer();
      return file(baseName(pdf.name) + '.xlsx', MIME.xlsx, buf);
    },
  },

  compare: {
    label: 'Compare PDF',
    async run(ctx) {
      const pdfs = ctx.files.filter((f) => f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.name));
      if (pdfs.length < 2) throw err('Two PDF files are required.');
      const [aText, bText] = await Promise.all([extractText(pdfs[0].buffer), extractText(pdfs[1].buffer)]);
      const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      let added = 0, removed = 0;
      const rows = [];
      const pageCount = Math.max(aText.length, bText.length);
      for (let p = 0; p < pageCount; p++) {
        const a = (aText[p] ?? '').split('\n');
        const b = (bText[p] ?? '').split('\n');
        rows.push(`<h2>Page ${p + 1}</h2><table>`);
        const max = Math.max(a.length, b.length);
        for (let i = 0; i < max; i++) {
          const x = a[i] ?? null, y = b[i] ?? null;
          if (x === y) rows.push(`<tr class="same"><td>${esc(x)}</td></tr>`);
          else {
            if (x !== null) { rows.push(`<tr class="del"><td>- ${esc(x)}</td></tr>`); removed++; }
            if (y !== null) { rows.push(`<tr class="add"><td>+ ${esc(y)}</td></tr>`); added++; }
          }
        }
        rows.push('</table>');
      }
      const html = `<!doctype html><meta charset="utf-8"><title>Folio — comparison</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}
td{padding:2px 6px;font-family:ui-monospace,monospace;white-space:pre-wrap}.same{color:#555}
.del{background:#fde8e6;color:#a12a22}.add{background:#e7f6ec;color:#196c3d}
h2{font-size:15px;margin:18px 0 6px}</style>
<h1>Comparison</h1><p>${added} added, ${removed} removed/changed lines.</p>${rows.join('\n')}`;
      return file('comparison.html', MIME.html, Buffer.from(html, 'utf8'));
    },
  },

  /* ---- pdf-lib operations ---- */
  compress: {
    label: 'Compress PDF',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const before = pdf.buffer.length;
      let bytes = await savePdf(await loadPdf(pdf.buffer));
      const gs = BIN.gs();
      if (gs && ctx.options.useGhostscript !== false) {
        bytes = await inTempDir(async (dir) => {
          const inPath = await writeTemp(dir, 'in.pdf', pdf.buffer);
          const outPath = path.join(dir, 'out.pdf');
          await runBin(gs, ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook',
            '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${outPath}`, inPath]);
          if (fs.existsSync(outPath)) {
            const b = await fsp.readFile(outPath);
            return b.length < bytes.length ? b : bytes;
          }
          return bytes;
        });
      }
      if (bytes.length >= before && gs === null) {
        throw err(`Could not reduce the file (${before} bytes). Install Ghostscript on the server for stronger compression.`, 422);
      }
      return file(baseName(pdf.name) + '-compressed.pdf', MIME.pdf, bytes);
    },
  },

  repair: {
    label: 'Repair PDF',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      try {
        const bytes = await savePdf(await loadPdf(pdf.buffer));
        return file(baseName(pdf.name) + '-repaired.pdf', MIME.pdf, bytes);
      } catch (e) {
        throw err('The file could not be repaired: ' + e.message, 422);
      }
    },
  },

  sign: {
    label: 'Sign PDF',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const sig = ctx.files.find((f) => /^image\/(png|jpe?g)$/i.test(f.mimetype) && f !== pdf);
      if (!sig) throw err('A PNG or JPG signature image is required.');
      const doc = await loadPdf(pdf.buffer);
      const embed = sig.mimetype === 'image/png' || /\.png$/i.test(sig.name)
        ? await doc.embedPng(sig.buffer)
        : await doc.embedJpg(sig.buffer);
      const pageIndex = clampInt(ctx.options.page, 1, doc.getPageCount(), 1) - 1;
      const page = doc.getPage(pageIndex);
      const { width, height } = page.getSize();
      const w = mmToPt(parseFloat(ctx.options.widthMm) || 50);
      const h = (embed.height / embed.width) * w;
      const x = parseFloat(ctx.options.xMm) != null && Number.isFinite(parseFloat(ctx.options.xMm))
        ? mmToPt(parseFloat(ctx.options.xMm)) : width - w - mmToPt(20);
      const y = parseFloat(ctx.options.yMm) != null && Number.isFinite(parseFloat(ctx.options.yMm))
        ? mmToPt(parseFloat(ctx.options.yMm)) : mmToPt(20);
      page.drawImage(embed, { x, y: Math.max(y, 0), width: w, height: h });
      return file(baseName(pdf.name) + '-signed.pdf', MIME.pdf, await savePdf(doc));
    },
  },

  redact: {
    label: 'Redact PDF',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      let rects = [];
      try { rects = JSON.parse(ctx.options.rects || '[]'); } catch { throw err('"rects" must be valid JSON.'); }
      if (!Array.isArray(rects) || !rects.length) throw err('Provide at least one rectangle to redact.');
      const doc = await loadPdf(pdf.buffer);
      for (const r of rects) {
        const idx = clampInt(r.page, 1, doc.getPageCount(), 1) - 1;
        const page = doc.getPage(idx);
        const { width, height } = page.getSize();
        const x = Number(r.x) || 0, y = Number(r.y) || 0;
        const w = Number(r.w) || 0, h = Number(r.h) || 0;
        page.drawRectangle({
          x: Math.max(0, x), y: Math.max(0, height - y - h),
          width: Math.min(w, width), height: Math.min(h, height), color: rgb(0, 0, 0),
        });
      }
      return file(baseName(pdf.name) + '-redacted.pdf', MIME.pdf, await savePdf(doc));
    },
  },

  forms: {
    label: 'PDF forms',
    async run(ctx) {
      const pdf = firstPdf(ctx);
      const doc = await loadPdf(pdf.buffer);
      let form = null;
      try { form = doc.getForm(); } catch { /* no AcroForm */ }
      const list = () => {
        if (!form) return [];
        return form.getFields().map((f) => ({ name: f.getName(), type: f.constructor.name.replace(/Field$/, '') }));
      };
      let values = null;
      try { values = ctx.options.fields ? JSON.parse(ctx.options.fields) : null; } catch { throw err('"fields" must be valid JSON.'); }
      if (!values) {
        return file(baseName(pdf.name) + '-fields.json', MIME.json, Buffer.from(JSON.stringify({ fields: list() }, null, 2)));
      }
      if (!form) throw err('This PDF has no fillable form fields.', 422);
      for (const [name, value] of Object.entries(values)) {
        let f = null;
        try { f = form.getField(name); } catch { /* missing */ }
        if (!f) continue;
        if (typeof f.setText === 'function') { f.setText(String(value)); continue; }
        if (typeof f.check === 'function' && (value === true || value === 'true')) f.check();
      }
      return file(baseName(pdf.name) + '-filled.pdf', MIME.pdf, await savePdf(doc));
    },
  },

  /* ---- optional native binaries ---- */
  'word-to-pdf': { label: 'Word to PDF', run: (ctx) => sofficeConvert(ctx, '.docx') },
  'ppt-to-pdf': { label: 'PowerPoint to PDF', run: (ctx) => sofficeConvert(ctx, '.pptx') },
  'excel-to-pdf': { label: 'Excel to PDF', run: (ctx) => sofficeConvert(ctx, '.xlsx') },

  'pdf-to-pdfa': {
    label: 'PDF to PDF/A',
    async run(ctx) {
      const gs = BIN.gs();
      if (!gs) throw err('PDF/A conversion needs Ghostscript (gs) on the server.', 501);
      const pdf = firstPdf(ctx);
      return inTempDir(async (dir) => {
        const inPath = await writeTemp(dir, 'in.pdf', pdf.buffer);
        const outPath = path.join(dir, 'out.pdf');
        await runBin(gs, ['-dPDFA', '-dBATCH', '-dNOPAUSE', '-dQUIET', '-sProcessColorModel=DeviceRGB',
          '-sDEVICE=pdfwrite', '-dPDFACompatibilityPolicy=1', `-sOutputFile=${outPath}`, inPath]);
        if (!fs.existsSync(outPath)) throw err('PDF/A conversion failed.', 422);
        return file(baseName(pdf.name) + '-pdfa.pdf', MIME.pdf, await fsp.readFile(outPath));
      });
    },
  },

  protect: {
    label: 'Protect PDF',
    async run(ctx) {
      const qpdf = BIN.qpdf();
      if (!qpdf) throw err('Password protection needs qpdf on the server.', 501);
      const pdf = firstPdf(ctx);
      const user = ctx.options.userPassword || '';
      const owner = ctx.options.ownerPassword || '';
      if (!user && !owner) throw err('Enter at least one password.');
      return inTempDir(async (dir) => {
        const inPath = await writeTemp(dir, 'in.pdf', pdf.buffer);
        const outPath = path.join(dir, 'out.pdf');
        await runBin(qpdf, ['--encrypt', user, owner, '256', '--', inPath, outPath]);
        return file(baseName(pdf.name) + '-protected.pdf', MIME.pdf, await fsp.readFile(outPath));
      });
    },
  },

  unlock: {
    label: 'Unlock PDF',
    async run(ctx) {
      const qpdf = BIN.qpdf();
      if (!qpdf) throw err('Removing a password needs qpdf on the server.', 501);
      const pdf = firstPdf(ctx);
      const password = ctx.options.password || '';
      return inTempDir(async (dir) => {
        const inPath = await writeTemp(dir, 'in.pdf', pdf.buffer);
        const outPath = path.join(dir, 'out.pdf');
        try {
          await runBin(qpdf, [`--password=${password}`, '--decrypt', inPath, outPath]);
        } catch {
          throw err('Wrong password, or the PDF is not protected.');
        }
        return file(baseName(pdf.name) + '-unlocked.pdf', MIME.pdf, await fsp.readFile(outPath));
      });
    },
  },
};

// Tools that always work (pure JS) vs tools gated on an optional binary.
const BIN_REQUIRED = {
  'word-to-pdf': { label: 'LibreOffice (soffice)', ok: () => !!BIN.soffice() },
  'ppt-to-pdf': { label: 'LibreOffice (soffice)', ok: () => !!BIN.soffice() },
  'excel-to-pdf': { label: 'LibreOffice (soffice)', ok: () => !!BIN.soffice() },
  'pdf-to-pdfa': { label: 'Ghostscript (gs)', ok: () => !!BIN.gs() },
  protect: { label: 'qpdf', ok: () => !!BIN.qpdf() },
  unlock: { label: 'qpdf', ok: () => !!BIN.qpdf() },
};

export function availability() {
  const out = {};
  for (const id of Object.keys(tools)) {
    const req = BIN_REQUIRED[id];
    if (!req) { out[id] = { available: true }; continue; }
    out[id] = req.ok()
      ? { available: true }
      : { available: false, reason: `Not available on this server: install ${req.label}.` };
  }
  return out;
}
