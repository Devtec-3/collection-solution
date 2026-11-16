'use strict';
/**
 * HTTP server: static files for the app, JSON API under /api.
 * No framework, no build step — deployable to Render as-is.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const api = require('./api');
const { seed } = require('./seed');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Resolve a URL path to a real file inside the app, or null. */
function resolveStatic(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const candidates = [path.resolve(ROOT, rel)];
  if (fs.existsSync(PUBLIC_DIR)) candidates.push(path.resolve(PUBLIC_DIR, rel));
  for (const file of candidates) {
    if (!file.startsWith(ROOT)) continue; // path traversal
    const inner = file.slice(ROOT.length);
    if (/(^|[\\/])(\.data|\.git|node_modules)([\\/]|$)/.test(inner)) continue;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function serveFile(res, file, req) {
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    ETag: etag,
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Security headers. The app uses no inline scripts of its own beyond the
  // build-time icons, so a strict policy is safe.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await api.handle(req, res, url);
      if (handled) return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    const file = resolveStatic(url.pathname);
    if (!file) {
      // A request that looks like a real file (has an extension) is a 404.
      // Extensionless paths fall back to the shell so deep links still work.
      const looksLikeFile = /\.[a-z0-9]{1,6}$/i.test(url.pathname);
      const shell = path.join(ROOT, 'index.html');
      if (!looksLikeFile && fs.existsSync(shell)) return serveFile(res, shell, req);
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    serveFile(res, file, req);
  } catch (err) {
    console.error('[server]', err);
    if (!res.writableEnded) res.writeHead(500).end('Server error');
  }
});

async function start() {
  const mode = await db.init();
  const result = await seed();
  server.listen(PORT, () => {
    console.log(`Store system running on http://localhost:${PORT}  (database: ${mode})`);
    if (result.seeded) console.log(`First-run seed created. Owner sign-in: ${result.ownerEmail}`);
  });
}

if (require.main === module) start();

module.exports = { server, start };
