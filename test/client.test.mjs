// Client-side tests: load the real pages in jsdom and exercise the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { extractText } from '../server/lib/util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = (rel) => path.join(ROOT, rel).replace(/\\/g, '/');

/* jsdom refuses localStorage on a file:// page ("opaque origin"), which is
   also what a browser does in some contexts, so the page must work without it.
   Give the harness a working shim: the persistence paths get exercised for
   real, and the fallback stays a fallback. */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

function makeDom(rel, extra, query) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (e) => errors.push((e.detail && e.detail.message) || e.message));
  const dom = new JSDOM(fs.readFileSync(pagePath(rel), 'utf8'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'file:///' + pagePath(rel) + (query || ''),
    virtualConsole,
    beforeParse(window) {
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.URL.createObjectURL = () => 'blob:mock';
      window.URL.revokeObjectURL = () => {};
      Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
      if (!window.TextEncoder) window.TextEncoder = TextEncoder;
      if (!window.TextDecoder) window.TextDecoder = TextDecoder;
      if (extra) extra(window);
    },
  });
  return { dom, errors };
}

function waitLoad(dom) {
  return new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') return resolve();
    dom.window.addEventListener('load', () => resolve());
    setTimeout(resolve, 4000);
  });
}

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

// Collect every download the page starts, in order.
function captureDownloads(window) {
  const files = [];
  window.URL.createObjectURL = (blob) => {
    files.push(blob);
    return 'blob:' + files.length;
  };
  return files;
}

async function blobBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

/* pdf-lib's bundle checks types with `instanceof` against the classes of the
   realm it was loaded in, so anything handed to it has to be built inside the
   page's realm — a Node-realm Uint8Array or array literal is rejected. */
function winUint8(w, buffer) {
  const out = new w.Uint8Array(buffer.byteLength);
  out.set(new Uint8Array(buffer));
  return out;
}
function winArray(w, values) {
  const out = new w.Array(values.length);
  values.forEach((v, i) => { out[i] = v; });
  return out;
}

// Build a PDF inside the page's own realm (pdf-lib checks the realm of the
// objects it is handed) and wrap it in a File the harness writes to the input.
async function pdfFile(window, name, { pages = 1, title = null, blank = [], js = false } = {}) {
  const L = window.PDFLib;
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage(winArray(window, [300, 400]));
    if (blank.indexOf(i) < 0) page.drawText('Page ' + (i + 1), { x: 20, y: 200, font, size: 14 });
  }
  if (title) doc.setTitle(title);
  if (js) {
    doc.catalog.set(L.PDFName.of('OpenAction'), L.PDFName.of('JavaScript'));
    doc.catalog.set(L.PDFName.of('Names'), doc.context.register(doc.context.obj({
      JavaScript: doc.context.obj({ Names: doc.context.obj(winArray(window, [])) }),
    })));
  }
  return new window.File([await doc.save()], name, { type: 'application/pdf' });
}

function putFiles(dom, inputId, files) {
  const input = dom.window.document.getElementById(inputId);
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  return input;
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
}

function selectTool(dom, id) {
  click(dom, dom.window.document.querySelector('.sidebar-item[data-tool="' + id + '"]'));
}

test('app.html builds the whole UI and the file list stays in sync', async () => {
  const { dom, errors } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;

  assert.deepEqual(errors, [], 'no load errors');
  assert.equal(d.querySelectorAll('.sidebar-item').length, 37, '37 tools in the sidebar');
  assert.equal(d.querySelectorAll('.tool-panel').length, 37, '37 tool panels');

  const active = d.querySelectorAll('.tool-panel.active');
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'tool-merge', 'first tool is active on load');

  // Every tool shares one skeleton: head, body, foot and a status region.
  assert.equal(d.querySelectorAll('.tool-panel__head').length, 37);
  assert.equal(d.querySelectorAll('.tool-panel__body').length, 37);
  assert.equal(d.querySelectorAll('.tool-panel__foot').length, 37);
  assert.equal(d.querySelectorAll('.tool-panel .tool-status').length, 37);
  assert.equal(d.querySelectorAll('.tool-panel__head h2').length, 37, 'each head names its tool');
  assert.equal(d.querySelectorAll('.tool-panel .badge').length, 37, 'a browser/server badge on every panel');

  // The tools the browser cannot do render the server UI.
  assert.match(d.getElementById('tool-protect').innerHTML, /st-btn-protect/);
  assert.match(d.getElementById('tool-extract-text').innerHTML, /st-btn-extract-text/);
  assert.equal(typeof w.FolioServerTools, 'object', 'server-tools.js loaded');
  assert.doesNotMatch(w.FolioI18N.t('ap.server.run'), /^ap\./, 'server i18n key resolves');

  // Uploading then removing a file must update the operation (BUG-3 regression).
  putFiles(dom, 'merge-input', [{ name: 'a.pdf', size: 102400 }, { name: 'b.pdf', size: 204800 }]);
  const mergeBtn = d.getElementById('merge-btn');
  assert.equal(d.querySelectorAll('#file-list-merge-input .file-item').length, 2);
  assert.equal(mergeBtn.disabled, false);
  click(dom, d.querySelector('#file-list-merge-input .file-remove'));
  assert.equal(mergeBtn.disabled, true, 'merge disabled after a file is removed');

  // Switching language must not duplicate or lose the UI.
  click(dom, d.querySelector('.lang-btn[data-lang="it"]'));
  assert.equal(d.documentElement.lang, 'it');
  assert.equal(d.querySelectorAll('.sidebar-item').length, 37);
  assert.equal(d.querySelectorAll('.tool-panel').length, 37);
  assert.equal(d.querySelectorAll('.tool-panel.active').length, 1);
  assert.equal(d.getElementById('tool-merge').classList.contains('active'), true, 'the open tool survives the switch');

  w.close();
});

test('the built UI uses the icon set and the stylesheet keeps its colours in :root', async () => {
  const { dom } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;

  // Emoji (and the arrows/dingbats that replaced them) in the rendered UI
  // would mean a glyph the icon set does not cover.
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/u;
  const areas = [d.getElementById('sidebar'), d.getElementById('main'), d.querySelector('.topbar')];
  const check = (when) => areas.forEach((area) => {
    assert.doesNotMatch(area.textContent, EMOJI, 'no emoji in '.concat(area.className, ' ', when));
  });
  check('on load');
  assert.equal(d.querySelectorAll('.tool-panel__icon svg').length, 37, 'every panel head has an SVG icon');
  assert.equal(d.querySelectorAll('.sidebar-item .icon svg').length, 37, 'every sidebar row has an SVG icon');

  click(dom, d.querySelector('.lang-btn[data-lang="it"]'));
  check('after switching to IT');

  const html = fs.readFileSync(pagePath('app.html'), 'utf8');
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const rootEnd = style.indexOf('}', style.indexOf(':root'));
  const rootBlock = style.slice(style.indexOf(':root'), rootEnd);
  const outside = style.slice(0, style.indexOf(':root')) + style.slice(rootEnd);
  assert.deepEqual(outside.match(/#[0-9A-Fa-f]{3,8}\b/g) || [], [], 'no raw hex colour outside :root');
  assert.match(rootBlock, /--text-secondary:\s*#[0-9A-Fa-f]{6}/, 'the tokens are hex in :root');

  w.close();
});

test('the text tokens meet WCAG AA on the page background', async () => {
  const html = fs.readFileSync(pagePath('app.html'), 'utf8');
  const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const rootBlock = style.slice(style.indexOf(':root'), style.indexOf('}', style.indexOf(':root')));
  const token = (name) => {
    const m = rootBlock.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})'));
    assert.ok(m, '--' + name + ' is a hex token in :root');
    return m[1];
  };
  const lum = (hex) => {
    const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = parts.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const contrast = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const bg = token('bg');
  const secondary = contrast(token('text-secondary'), bg);
  const muted = contrast(token('text-muted'), bg);
  assert.ok(secondary >= 4.5, '--text-secondary on --bg is ' + secondary.toFixed(2) + ':1 (needs 4.5:1)');
  assert.ok(muted >= 4.5, '--text-muted on --bg is ' + muted.toFixed(2) + ':1 (needs 4.5:1)');
});

test('the sidebar searches, remembers favourites and lists the recent tools', async () => {
  const { dom } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;
  const search = d.getElementById('tool-search');

  assert.equal(d.querySelectorAll('#sidebar-pinned .sidebar-item').length, 0, 'nothing pinned on a fresh page');

  // Search is debounced, then filters.
  search.value = 'watermark';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  await settle(200);
  const hits = Array.from(d.querySelectorAll('#sidebar-categories .sidebar-item')).map((i) => i.getAttribute('data-tool'));
  assert.deepEqual(hits, ['watermark']);

  // An empty result offers the closest matches instead of a blank sidebar.
  search.value = 'watermarq';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  await settle(200);
  assert.equal(d.querySelectorAll('#sidebar-categories .sidebar-item').length, 0);
  assert.equal(d.getElementById('sidebar-empty').hidden, false, 'the empty state is shown');
  const closest = Array.from(d.querySelectorAll('#sidebar-empty [data-closest]')).map((b) => b.getAttribute('data-closest'));
  assert.ok(closest.includes('watermark'), 'watermark is offered as a close match, got: ' + closest.join(','));
  click(dom, d.querySelector('#sidebar-empty [data-closest="watermark"]'));
  assert.equal(d.getElementById('tool-watermark').classList.contains('active'), true, 'the suggestion opens the tool');

  // Clearing brings the categories back.
  click(dom, d.getElementById('tool-search-clear'));
  await settle(200);
  assert.equal(d.getElementById('sidebar-empty').hidden, true);
  assert.equal(d.querySelectorAll('#sidebar-categories .sidebar-item').length, 37);

  // Favourites persist and come back as a pinned group.
  click(dom, d.querySelector('.sidebar-star[data-fav="sanitize"]'));
  assert.equal(d.querySelector('.sidebar-star[data-fav="sanitize"]').getAttribute('aria-pressed'), 'true');
  assert.ok(JSON.parse(w.localStorage.getItem('folio-favourites')).includes('sanitize'), 'the favourite is stored');
  const pinned = d.querySelector('#sidebar-pinned .sidebar-group');
  assert.match(pinned.textContent, /Favourites|Preferiti/, 'the pinned group is labelled');
  assert.ok(pinned.querySelector('.sidebar-item[data-tool="sanitize"]'), 'the favourite is pinned');
  // A fresh page built from the stored state keeps it pinned.
  assert.ok(w.localStorage.getItem('folio-favourites').includes('sanitize'));

  // Opening a tool by hand is remembered, and its category opens with it.
  selectTool(dom, 'ocr');
  assert.equal(JSON.parse(w.localStorage.getItem('folio-recents'))[0], 'ocr', 'the recent list is stored');
  assert.equal(d.getElementById('tool-ocr').classList.contains('active'), true);
  assert.equal(d.querySelector('.sidebar-category-header[data-cat="optimize"]').classList.contains('collapsed'), false,
    'the category of the open tool is expanded');

  w.close();
});

test('a server tool posts a multipart request, shows progress and can be cancelled', async () => {
  const calls = [];
  let aborted = false;
  const { dom } = makeDom('app.html', (window) => {
    window.fetch = (url, opts) => {
      if (String(url).indexOf('api/tools') === 0 && (!opts || opts.method !== 'POST')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tools: {} }) });
      }
      calls.push({ url, opts });
      if (String(url).indexOf('pdf-to-word') >= 0) {
        return Promise.resolve({
          ok: true, status: 200, statusText: 'OK',
          headers: { get: (h) => (String(h).toLowerCase() === 'x-folio-filename' ? 'result.docx' : null) },
          blob: () => Promise.resolve(new window.Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' })),
        });
      }
      // A slow tool: settles only if the page aborts it.
      return new Promise((resolve, reject) => {
        if (opts && opts.signal) {
          opts.signal.addEventListener('abort', () => {
            aborted = true;
            const e = new window.Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }
      });
    };
  });
  await waitLoad(dom);
  const w = dom.window, d = w.document;

  selectTool(dom, 'pdf-to-word');
  const file = new w.File([new Uint8Array([37, 80, 68, 70])], 'a.pdf', { type: 'application/pdf' });
  putFiles(dom, 'st-input-pdf-to-word', [file]);

  const btn = d.getElementById('st-btn-pdf-to-word');
  assert.equal(btn.disabled, false, 'the run button enables after an upload');
  click(dom, btn);
  await settle(60);

  const last = calls[calls.length - 1];
  assert.ok(last, 'a request was made');
  assert.match(last.url, /api\/tools\/pdf-to-word$/);
  assert.equal(last.opts.method, 'POST');
  assert.ok(last.opts.body instanceof w.FormData, 'the body is multipart FormData');
  assert.ok(last.opts.body.has('files') && last.opts.body.has('options'));
  assert.match(d.getElementById('st-status-pdf-to-word').textContent, /Done|Fatto/);
  await settle(20);

  // A slow tool: progress with elapsed time, and Cancel aborts the request.
  selectTool(dom, 'ocr');
  putFiles(dom, 'st-input-ocr', [file]);
  click(dom, d.getElementById('st-btn-ocr'));
  await settle(30);
  const status = d.getElementById('st-status-ocr');
  assert.match(status.innerHTML, /progress/, 'a progress bar is shown while the request is in flight');
  assert.match(status.textContent, /Elapsed|Trascorso/, 'the elapsed time is shown');
  const cancel = status.querySelector('.progress-cancel');
  assert.ok(cancel, 'Cancel is offered');
  click(dom, cancel);
  await settle(40);
  assert.equal(aborted, true, 'cancelling aborts the request');
  assert.match(status.textContent, /Cancelled|annullata/i);

  w.close();
});

test('the new browser tools produce real PDFs', async () => {
  const { dom } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;
  const downloads = captureDownloads(w);

  // --- Header & footer: placeholders are filled on every page.
  selectTool(dom, 'header-footer');
  putFiles(dom, 'hf-input', [await pdfFile(w, 'doc.pdf', { pages: 2, title: 'Relazione' })]);
  assert.equal(d.getElementById('hf-btn').disabled, false);
  click(dom, d.getElementById('hf-btn'));
  await settle(250);
  assert.match(d.getElementById('hf-status').className, /success/, 'header/footer: ' + d.getElementById('hf-status').textContent);
  const hfBytes = await blobBytes(downloads[downloads.length - 1]);
  const hfText = (await extractText(Buffer.from(hfBytes))).join('\n');
  assert.match(hfText, /Relazione/, 'the {title} placeholder was filled');
  assert.match(hfText, /1\s*\/\s*2/, 'the footer shows page 1 of 2');

  // --- Advanced pages: reverse the order, then drop the blank page.
  selectTool(dom, 'advanced-pages');
  putFiles(dom, 'adv-input', [await pdfFile(w, 'two.pdf', { pages: 3, blank: [1] })]);
  const action = d.getElementById('adv-action');
  action.value = 'reverse';
  action.dispatchEvent(new w.Event('change', { bubbles: true }));
  click(dom, d.getElementById('adv-btn'));
  await settle(200);
  assert.match(d.getElementById('adv-status').className, /success/, 'reverse: ' + d.getElementById('adv-status').textContent);
  let latest = downloads[downloads.length - 1];
  let loaded = await w.PDFLib.PDFDocument.load(winUint8(w, await latest.arrayBuffer()));
  assert.equal(loaded.getPageCount(), 3, 'reverse keeps every page');
  const reversed = (await extractText(Buffer.from(await blobBytes(latest)))).join('\n');
  assert.ok(reversed.indexOf('Page 3') < reversed.indexOf('Page 1'), 'the last page now comes first');

  action.value = 'remove-blank';
  action.dispatchEvent(new w.Event('change', { bubbles: true }));
  click(dom, d.getElementById('adv-btn'));
  await settle(200);
  const removeStatus = d.getElementById('adv-status');
  assert.match(removeStatus.className, /success/, 'remove-blank: ' + removeStatus.textContent);
  assert.match(removeStatus.textContent, /1 blank|1 pagina/i, 'it reports the page it removed');
  latest = downloads[downloads.length - 1];
  loaded = await w.PDFLib.PDFDocument.load(winUint8(w, await latest.arrayBuffer()));
  assert.equal(loaded.getPageCount(), 2, 'the blank page is gone');

  // --- Sanitise: metadata and embedded JavaScript are gone, pages stay.
  selectTool(dom, 'sanitize');
  putFiles(dom, 'san-input', [await pdfFile(w, 'dirty.pdf', { pages: 1, title: 'Segreto', js: true })]);
  click(dom, d.getElementById('san-btn'));
  await settle(250);
  assert.match(d.getElementById('san-status').className, /success/, 'sanitise: ' + d.getElementById('san-status').textContent);
  const clean = await w.PDFLib.PDFDocument.load(winUint8(w, await downloads[downloads.length - 1].arrayBuffer()));
  assert.equal(clean.getPageCount(), 1, 'the pages are untouched');
  assert.equal(clean.getTitle(), undefined, 'the title metadata is gone');
  const catalog = clean.catalog;
  assert.equal(catalog.has(w.PDFLib.PDFName.of('OpenAction')), false, 'the automatic action is gone');
  const names = catalog.lookupMaybe(w.PDFLib.PDFName.of('Names'), w.PDFLib.PDFDict);
  assert.ok(!names || !names.has(w.PDFLib.PDFName.of('JavaScript')), 'the embedded JavaScript is gone');

  w.close();
});

test('the sidebar toggle is wired and a deep link opens its tool', async () => {
  const { dom } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;
  click(dom, d.getElementById('sidebar-toggle'));
  assert.equal(d.getElementById('sidebar').classList.contains('open'), true, 'the toggle opens the sidebar');
  assert.equal(d.getElementById('sidebar-backdrop').hidden, false);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.getElementById('sidebar').classList.contains('open'), false, 'Escape closes it');
  w.close();

  const deep = makeDom('app.html', null, '?tool=pdf-to-markdown');
  await waitLoad(deep.dom);
  const w2 = deep.dom.window, d2 = w2.document;
  assert.equal(d2.getElementById('tool-pdf-to-markdown').classList.contains('active'), true, 'the deep link opened its tool');
  assert.equal(d2.querySelectorAll('.tool-panel.active').length, 1, 'exactly one panel is open');
  w2.close();
});

test('index.html hero CTA keeps the selected language', async () => {
  const { dom, errors } = makeDom('index.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;
  assert.deepEqual(errors, [], 'no load errors');

  const cta = d.querySelector('.hero-cta');
  assert.equal(cta.tagName, 'A');
  assert.equal(cta.getAttribute('href'), 'app.html');
  click(dom, d.querySelector('.lang-btn[data-lang="it"]'));
  assert.match(d.querySelector('.hero-cta').getAttribute('href'), /app\.html\?lang=it/);
  w.close();
});

test('the inline text editor maps fonts and rewrites a real PDF', async () => {
  const { dom } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window;
  const TE = w.FolioTextEdit;
  const L = w.PDFLib;
  assert.ok(TE, 'text-edit.js is loaded');
  assert.ok(L, 'pdf-lib is loaded');

  // --- font mapping: the three families, then the styles on top
  assert.equal(TE.stripSubset('ABCDEE+Helvetica-Bold'), 'Helvetica-Bold');
  assert.equal(TE.standardFontKey({ family: 'serif' }), 'Times-Roman');
  assert.equal(TE.standardFontKey({ family: 'monospace', bold: true }), 'Courier-Bold');
  assert.equal(TE.standardFontKey({ family: 'sans-serif', bold: true, italic: true }), 'Helvetica-BoldOblique');

  // a standard face is honoured as it is…
  assert.equal(TE.standardFontKey({ family: 'sans-serif', original: 'Helvetica-Oblique' }), 'Helvetica-Oblique');
  // …and a real-world producer name keeps its family and weight
  assert.equal(TE.standardFontKey({ family: 'sans-serif', original: 'TimesNewRomanPS-BoldMT' }), 'Times-Bold');
  // an embedded, non-standard face falls back to its closest equivalent
  assert.equal(TE.standardFontKey({ family: 'sans-serif', original: 'RobotoCondensed-Regular' }), 'Helvetica');

  // --- style inference only when the page is unambiguous
  assert.equal(TE.styleFromBaseFonts(['AAAAAA+Helvetica-Bold']).bold, true);
  assert.equal(TE.styleFromBaseFonts(['AAAAAA+Helvetica-Bold']).sole, 'Helvetica-Bold');
  assert.equal(TE.styleFromBaseFonts(['Helvetica-Bold', 'Helvetica']).bold, false, 'two faces cannot be attributed');

  // --- the patch and its colour
  const rect = TE.coverRect({ x: 10, y: 100, size: 10, width: 40, ascent: 0.8, descent: 0.2 });
  assert.equal(rect.y, 98, 'the patch starts below the baseline');
  assert.equal(rect.height, 10, 'one ascender plus one descender');
  // The values come from the jsdom realm, so compare fields (deepStrictEqual
  // would trip over the different Object prototype) without loosening anything.
  const white = TE.averageColor([[255, 255, 255], [255, 255, 255]]);
  assert.equal(white.r, 1);
  assert.equal(white.g, 1);
  assert.equal(white.b, 1);
  const grey = TE.averageColor([[0, 0, 0], [255, 255, 255]]);
  assert.ok(Math.abs(grey.r - 0.5) < 0.01, 'colours are averaged');
  assert.ok(Math.abs(grey.g - 0.5) < 0.01);
  assert.ok(Math.abs(grey.b - 0.5) < 0.01);

  // --- a real round trip: draw, overwrite, then read the bytes back
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica);
  const page = doc.addPage(winArray(w, [300, 200]));
  page.drawText('Original line', { x: 40, y: 120, font, size: 12 });

  const applied = await TE.applyEdits({
    PDFLib: L,
    StandardFonts: L.StandardFonts,
    rgb: L.rgb,
    doc,
    edits: [{
      page: 0, x: 40, y: 120, size: 12, width: 70, ascent: 0.78, descent: 0.22,
      font: 'Times-Bold', text: 'Rewritten text',
      background: { r: 1, g: 1, b: 1 }, color: { r: 0, g: 0, b: 0 },
    }],
  });
  assert.equal(applied, 1, 'the edit was applied');

  const text = (await extractText(Buffer.from(await doc.save()))).join('\n');
  assert.match(text, /Rewritten text/, 'the replacement text is in the document');

  // --- uploading opens the editor view, with nothing to apply yet
  const d = w.document;
  selectTool(dom, 'edit-text');
  putFiles(dom, 'edit-input', [await pdfFile(w, 'doc.pdf', { pages: 1 })]);
  await settle(80);
  assert.notEqual(d.getElementById('edit-controls').style.display, 'none', 'the view opens on upload');
  assert.equal(d.getElementById('edit-btn').disabled, true, 'apply is disabled until something changes');
  assert.equal(d.getElementById('edit-reset').disabled, true, 'there is nothing to discard yet');

  w.close();
});
