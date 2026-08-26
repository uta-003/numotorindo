/* ============================================================
   NuMotorindo — Mini static server (tanpa dependensi)
   Jalankan:  node server.js [port]     (default port: 8080)
   Stop    :  tutup jendela proses / Stop-Process -Id <PID>
============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 - Permintaan tidak valid');
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  const file = path.normalize(path.join(ROOT, pathname));

  /* cegah path traversal keluar folder proyek */
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 - Akses ditolak');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - File tidak ditemukan :(');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  🏍️  NuMotorindo Showroom');
  console.log('  ➜  http://localhost:' + PORT);
  console.log('  ➜  Folder: ' + ROOT);
  console.log('==============================================');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('❌ Port ' + PORT + ' sudah dipakai. Coba: node server.js ' + (PORT + 1));
  } else {
    console.error('❌ Error:', err.message);
  }
  process.exit(1);
});