/* ============================================================
   NuMotorindo Backend — entry point
   Menyajikan:  • REST API   /api/*
                • Dashboard  /admin
                • File frontend statis di /
   Jalankan:  node server.js [port]    (default: 3000)
============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { handleApi } = require('./api');
require('./db').load(); // siapkan db.json (auto-seed saat pertama kali)

const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const PUBLIC_DIR = path.join(__dirname, 'public');

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
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ message: 'Internal server error' }));
    }
  }

  /* ---------- Halaman admin (/admin) ---------- */
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    let sub = url.pathname.replace(/^\/admin/, '');
    if (sub === '' || sub === '/') sub = '/admin.html';
    const file = safeJoin(PUBLIC_DIR, sub);
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    return sendFile(res, file);
  }

  /* ---------- Frontend statis di root ---------- */
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  const feFile = safeJoin(FRONTEND_DIR, p);
  if (feFile && fileExists(feFile)) return sendFile(res, feFile);

  const pubFile = safeJoin(PUBLIC_DIR, p);
  if (pubFile && fileExists(pubFile)) return sendFile(res, pubFile);

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404</h1><p>NuMotorindo — halaman tidak ditemukan. Coba <a href="/">beranda</a> atau <a href="/admin">dashboard admin</a>.</p>');
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  🔧 NuMotorindo Backend aktif');
  console.log('  ➜  Website : http://localhost:' + PORT + '/');
  console.log('  ➜  Admin   : http://localhost:' + PORT + '/admin');
  console.log('  ➜  API     : http://localhost:' + PORT + '/api/bikes');
  console.log('==============================================');
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));