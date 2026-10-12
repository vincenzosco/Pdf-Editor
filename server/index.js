// Folio server — hosts the static site (replacing GitHub Pages) and exposes the
// server-side PDF tools under /api. Run with: npm start
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tools, availability } from './tools/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Only these files from the project root are exposed publicly.
const PUBLIC_FILES = new Set([
  'index.html', 'app.html', 'i18n.js', 'server-tools.js', 'favicon.svg', 'icon-512.png', 'og-image.png',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 25 },
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  app.get('/api/tools', (_req, res) => {
    res.json({ tools: availability(), count: Object.keys(tools).length });
  });

  app.post('/api/tools/:id', upload.array('files'), async (req, res) => {
    const id = req.params.id;
    const tool = tools[id];
    if (!tool) return res.status(404).json({ error: `Unknown tool: ${id}` });

    const state = availability()[id];
    if (!state.available) return res.status(503).json({ error: state.reason });

    let options = {};
    if (req.body && req.body.options) {
      try { options = JSON.parse(req.body.options); }
      catch { return res.status(400).json({ error: 'The "options" field must be valid JSON.' }); }
    }
    const files = (req.files || []).map((f) => ({
      field: f.fieldname, name: f.originalname, mimetype: f.mimetype, buffer: f.buffer,
    }));

    try {
      const out = await tool.run({ files, options });
      res.setHeader('Content-Type', out.mime);
      res.setHeader('X-Folio-Filename', out.filename);
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename.replace(/"/g, '')}"`);
      res.send(out.buffer);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      if (status >= 500) console.error(`[tool ${id}]`, e);
      res.status(status).json({ error: (e && e.message) || 'The tool failed.' });
    }
  });

  // Static site (the files that used to be served by GitHub Pages).
  app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
  app.get('/:name', (req, res, next) => {
    if (!PUBLIC_FILES.has(req.params.name)) return next();
    res.sendFile(path.join(ROOT, req.params.name));
  });
  app.use('/vendor', express.static(path.join(ROOT, 'vendor'), { fallthrough: false }));

  app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'One of the files is too large (max 60 MB).'
        : `Upload error: ${err.message}`;
      return res.status(413).json({ error: msg });
    }
    console.error('[server]', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

// Compare *real* paths: the project can sit behind a junction or symlink
// (e.g. "Documenti" -> "Documents"), where a plain string compare fails.
const SELF_PATH = realpathSync(fileURLToPath(import.meta.url));
const isMain = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === SELF_PATH; } catch { return false; }
})();
if (isMain) {
  const port = process.env.PORT || 8080;
  createApp().listen(port, () => {
    console.log(`Folio server listening on http://localhost:${port}`);
  });
}
