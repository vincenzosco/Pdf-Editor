// Client-side tests: load the real pages in jsdom and exercise the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = (rel) => path.join(ROOT, rel).replace(/\\/g, '/');

function makeDom(rel, extra) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (e) => errors.push((e.detail && e.detail.message) || e.message));
  const dom = new JSDOM(fs.readFileSync(pagePath(rel), 'utf8'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'file:///' + pagePath(rel),
    virtualConsole,
    beforeParse(window) {
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.URL.createObjectURL = () => 'blob:mock';
      window.URL.revokeObjectURL = () => {};
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

test('app.html builds the whole UI and the file list stays in sync', async () => {
  const { dom, errors } = makeDom('app.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;

  assert.deepEqual(errors, [], 'no load errors');
  assert.equal(d.querySelectorAll('.sidebar-item').length, 30, '30 tools in the sidebar');
  assert.equal(d.querySelectorAll('.tool-section').length, 30, '30 tool sections');

  const active = d.querySelectorAll('.tool-section.active');
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'tool-merge', 'first tool is active on load');

  // The tools that cannot be done in the browser render the server UI.
  assert.match(d.getElementById('tool-protect').innerHTML, /st-btn-protect/);
  assert.match(d.getElementById('tool-unlock').innerHTML, /st-btn-unlock/);
  assert.equal(typeof w.FolioServerTools, 'object', 'server-tools.js loaded');
  assert.doesNotMatch(w.FolioI18N.t('ap.server.run'), /^ap\./, 'server i18n key resolves');

  // Uploading then removing a file must update the operation (BUG-3 regression).
  const input = d.getElementById('merge-input');
  Object.defineProperty(input, 'files', {
    value: [{ name: 'a.pdf', size: 102400 }, { name: 'b.pdf', size: 204800 }],
    configurable: true,
  });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  const mergeBtn = d.getElementById('merge-btn');
  assert.equal(d.querySelectorAll('#file-list-merge-input .file-item').length, 2);
  assert.equal(mergeBtn.disabled, false);
  d.querySelector('#file-list-merge-input .file-remove').dispatchEvent(new w.Event('click', { bubbles: true }));
  assert.equal(mergeBtn.disabled, true, 'merge disabled after a file is removed');

  // Switching language must not duplicate or lose the UI.
  d.querySelector('.lang-btn[data-lang="it"]').dispatchEvent(new w.Event('click', { bubbles: true }));
  assert.equal(d.documentElement.lang, 'it');
  assert.equal(d.querySelectorAll('.sidebar-item').length, 30);
  assert.equal(d.querySelectorAll('.tool-section').length, 30);
  assert.equal(d.querySelectorAll('.tool-section.active').length, 1);

  w.close();
});

test('a server tool posts a multipart request to /api', async () => {
  const calls = [];
  const { dom } = makeDom('app.html', (window) => {
    window.fetch = (url, opts) => {
      calls.push({ url, opts });
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        headers: { get: (h) => (String(h).toLowerCase() === 'x-folio-filename' ? 'result.docx' : null) },
        blob: () => Promise.resolve(new window.Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' })),
      });
    };
  });
  await waitLoad(dom);
  const w = dom.window, d = w.document;

  d.querySelector('.sidebar-item[data-tool="pdf-to-word"]').dispatchEvent(new w.Event('click', { bubbles: true }));
  const input = d.getElementById('st-input-pdf-to-word');
  const realFile = new w.File([new Uint8Array([37, 80, 68, 70])], 'a.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [realFile], configurable: true });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));

  const btn = d.getElementById('st-btn-pdf-to-word');
  assert.equal(btn.disabled, false, 'run button enables after upload');
  btn.dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  const last = calls[calls.length - 1];
  assert.ok(last, 'a request was made');
  assert.match(last.url, /api\/tools\/pdf-to-word$/);
  assert.equal(last.opts.method, 'POST');
  assert.ok(last.opts.body instanceof w.FormData, 'body is multipart FormData');
  assert.ok(last.opts.body.has('files') && last.opts.body.has('options'));
  assert.match(d.getElementById('st-status-pdf-to-word').textContent, /Done|Fatto/);

  w.close();
});

test('index.html hero CTA keeps the selected language', async () => {
  const { dom, errors } = makeDom('index.html');
  await waitLoad(dom);
  const w = dom.window, d = w.document;
  assert.deepEqual(errors, [], 'no load errors');

  const cta = d.querySelector('.hero-cta');
  assert.equal(cta.tagName, 'A');
  assert.equal(cta.getAttribute('href'), 'app.html');
  d.querySelector('.lang-btn[data-lang="it"]').dispatchEvent(new w.Event('click', { bubbles: true }));
  assert.match(d.querySelector('.hero-cta').getAttribute('href'), /app\.html\?lang=it/);
  w.close();
});
