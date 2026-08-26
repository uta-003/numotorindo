/* ============================================================
   NuMo Showroom — entry point
   Menyajikan: • REST API /api/*
               • SPA dashboard (login, unit, invoice, laporan) di /
   Jalankan:  node server.js [port]    (default: 3100)
============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { handleApi } = require('./api');
require('./db').load(); // siapkan db.json (auto-seed saat pertama kali)

const PORT = Number(process.argv[2] || process.env.PORT || 3100);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_PHOTOS = path.join(__dirname, 'data', 'photos');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function safeJoin(root, urlPath) {
  const target = path.normalize(path.join(root, urlPath));
  return target.startsWith(root) ? target : null;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - File tidak ditemukan');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

function fileExists(f) {
  try { return fs.statSync(f).isFile(); } catch (e) { return false; }
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch (e) { res.writeHead(400); return res.end('Bad request'); }

  /* ---------- REST API ---------- */
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const t0 = Date.now();
    res.on('finish', () => {
      console.log('[' + new Date().toLocaleTimeString() + '] ' + req.method + ' ' + url.pathname +
        ' → ' + res.statusCode + ' (' + (Date.now() - t0) + 'ms)');
    });
    try {
      return handleApi(req, res, url);
    } catch (err) {
      console.error('[api] error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ message: 'Internal server error' }));
      }
      return;
    }
  }

  /* ---------- Foto unit (showroom-motor/data/photos) ---------- */
  if (url.pathname.startsWith('/photos/')) {
    const photoFile = safeJoin(path.join(DATA_PHOTOS, decodeURIComponent(url.pathname.replace(/^\/photos/, ''))));
    if (photoFile && fileExists(photoFile)) return sendFile(res, photoFile);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Foto tidak ditemukan');
  }

  /* ---------- SPA statis di root ---------- */
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  const pubFile = safeJoin(PUBLIC_DIR, p);
  if (pubFile && fileExists(pubFile)) return sendFile(res, pubFile);

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404</h1><p>NuMo Showroom — halaman tidak ditemukan. Kembali ke <a href="/">dashboard</a>.</p>');
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  🏍️  NuMo Showroom aktif');
  console.log('  ➜  Aplikasi : http://localhost:' + PORT + '/');
  console.log('  ➜  API      : http://localhost:' + PORT + '/api/health');
  console.log('  ➜  Akun demo: admin/admin123 · owner/owner123 · sales/sales123 · mekanik/mekanik123');
  console.log('==============================================');
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));