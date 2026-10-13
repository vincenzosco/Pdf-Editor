// Fetch the Tesseract language models into server/tessdata.
//
// Without this, the OCR pipeline downloads a model the first time a language is
// used — on the request that needs it, so the first page is slow and an
// air-gapped host simply fails. With the models on disk, `ocr.js` finds
// `server/tessdata` and points tesseract.js' `langPath` at it.
//
// The models come from the `@tesseract.js-data` packages: the official
// `tessdata_best`/`tessdata_fast` repositories ship the full float models, which
// the tesseract.js WASM core cannot load (it aborts with "missing function
// ...DotProductSSE"). These packages are the integer-quantized builds the
// library itself downloads, and they are gzipped — hence `.traineddata.gz`.
//
//   node scripts/fetch-tessdata.mjs                  # eng ita spa deu fra, "best"
//   node scripts/fetch-tessdata.mjs eng ita          # only these
//   FOLIO_TESSDATA_QUALITY=standard node scripts/fetch-tessdata.mjs
//
// "best" (default) is the most accurate model; "standard" is the one the legacy
// engine also understands. Files already present are kept, so running this
// twice downloads nothing.

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Overridable so a download can be tried somewhere harmless before it lands in
// the repository, and so a deploy can keep the models out of the image.
const OUT_DIR = process.env.FOLIO_TESSDATA_DIR || path.join(HERE, '..', 'server', 'tessdata');

const VARIANTS = { best: '4.0.0_best_int', standard: '4.0.0' };
const QUALITY = process.env.FOLIO_TESSDATA_QUALITY || 'best';
const VERSION = VARIANTS[QUALITY];
const CDN = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data';
const DEFAULT_LANGS = 'eng ita spa deu fra';

const langs = process.argv.slice(2).join(' ').split(/[\s,]+/).filter(Boolean);
const wanted = langs.length ? langs : DEFAULT_LANGS.split(' ');

if (!VERSION) {
  console.error(`Unknown FOLIO_TESSDATA_QUALITY="${QUALITY}" (use best or standard).`);
  process.exit(2);
}

await fsp.mkdir(OUT_DIR, { recursive: true });

let downloaded = 0;
let skipped = 0;
for (const lang of wanted) {
  if (!/^[a-z_]+$/.test(lang)) {
    console.error(`Skipping "${lang}": a language code looks like "eng" or "ita".`);
    process.exitCode = 1;
    continue;
  }
  const name = `${lang}.traineddata.gz`;
  const dest = path.join(OUT_DIR, name);
  try {
    const { size } = await fsp.stat(dest);
    if (size > 0) {
      console.log(`have ${name} (${(size / 1e6).toFixed(1)} MB)`);
      skipped += 1;
      continue;
    }
  } catch { /* not there yet */ }

  const url = `${CDN}/${lang}/${VERSION}/${name}`;
  process.stdout.write(`fetching ${name} … `);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`failed: HTTP ${res.status} (${url})`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(dest, buf);
  downloaded += 1;
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
}

console.log(`\n${OUT_DIR}\n  ${downloaded} downloaded, ${skipped} already present, ${wanted.length} requested (quality: ${QUALITY} -> ${VERSION})`);
if (downloaded === 0 && skipped === 0) {
  console.error('No language model is available: OCR would fall back to a runtime download.');
  process.exitCode = 1;
}
