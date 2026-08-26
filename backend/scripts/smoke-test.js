/* ============================================================
   Smoke test E2E untuk NuMotorindo Backend
   Pakai:  node scripts/smoke-test.js [port]     (default 3000)
   Pastikan server sudah berjalan dulu.
============================================================ */
'use strict';

const http = require('http');

const BASE = 'http://localhost:' + (process.argv[2] || 3000);

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {};
    const r = http.request(BASE + path, { method: method, headers: headers }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch (e) { /* bukan JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, text: buf, json: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async () => {
  console.log('Mengetes ' + BASE + '\n');

  /* ---- health ---- */
  const h = await req('GET', '/api/health');
  ok('GET /api/health', h.status === 200 && h.json && h.json.ok === true);

  /* ---- katalog: seed awal ---- */
  let list = await req('GET', '/api/bikes');
  const beforeCount = Array.isArray(list.json) ? list.json.length : -1;
  ok('seed berisi >= 12 motor', list.status === 200 && beforeCount >= 12, 'count=' + beforeCount);

  const honda = await req('GET', '/api/bikes?brand=Honda');
  ok('filter ?brand=Honda', honda.json && honda.json.length > 0 && honda.json.every((b) => b.brand === 'Honda'));

  const sorted = await req('GET', '/api/bikes?sort=price-asc');
  const prices = (sorted.json || []).map((b) => b.price);
  ok('sort ?sort=price-asc', prices.length > 1 && prices[0] <= prices[prices.length - 1], 'termurah=' + prices[0]);

  /* ---- katalog: validasi & CRUD ---- */
  const bad = await req('POST', '/api/bikes', {
    name: 'ab', brand: '', type: 'ufo', year: '1800', km: '-5',
    cc: '0', trans: '', price: '500', cond: 'xxx', color: ''
  });
  ok('tolak motor invalid (400)', bad.status === 400 && bad.json.errors,
    Object.keys(bad.json.errors || {}).length + ' error field');

  const created = await req('POST', '/api/bikes', {
    name: 'Motor Uji Coba API', brand: 'Honda', type: 'sport', year: '2024',
    km: '100', cc: '150', trans: 'Manual (6)', price: '25000000',
    cond: 'bagus', color: 'Merah'
  });
  ok('POST motor baru (201)', created.status === 201 && /^bike-/.test(created.json.id), 'id=' + created.json.id);
  ok('typeName & img terisi otomatis', created.json.typeName === 'Sport' && /moto-sport\.svg$/.test(created.json.img || ''));

  const id = created.json.id;
  const one = await req('GET', '/api/bikes/' + id);
  ok('GET detail motor', one.status === 200 && one.json.name === 'Motor Uji Coba API');

  const patched = await req('PATCH', '/api/bikes/' + id, { price: '26500000' });
  ok('PATCH ubah harga', patched.status === 200 && patched.json.price === 26500000);

  let afterPost = await req('GET', '/api/bikes');
  ok('jumlah bertambah +1', afterPost.json.length === beforeCount + 1);

  const del = await req('DELETE', '/api/bikes/' + id);
  ok('DELETE motor', del.status === 200);
  afterPost = await req('GET', '/api/bikes');
  ok('jumlah kembali normal', afterPost.json.length === beforeCount);

  const nf = await req('GET', '/api/bikes/tidak-ada-999');
  ok('404 untuk id tidak dikenal', nf.status === 404);

  /* ---- permintaan jual ---- */
  const badReq = await req('POST', '/api/sell-requests', {
    nama: 'A', wa: '123', merk: '', model: '', tahun: '1800', harga: '5'
  });
  ok('tolak permintaan invalid (400)', badReq.status === 400 && badReq.json.errors && !!badReq.json.errors.wa,
    'errors=' + Object.keys(badReq.json.errors || {}).join(','));

  const sr = await req('POST', '/api/sell-requests', {
    nama: 'Uji Pemilik', wa: '0812-3456-7890', merk: 'Yamaha', model: 'NMAX 155',
    tahun: '2020', harga: '21500000', kelengkapan: ['STNK aktif', 'BPKB'], catatan: 'unit test'
  });
  ok('POST permintaan (201)', sr.status === 201 && /^req-/.test(sr.json.id) && sr.json.status === 'baru', 'id=' + sr.json.id);
  ok('nomor WA dinormalisasi', sr.json.wa === '081234567890');

  /* cek stats SELAGI status masih 'baru' */
  const st = await req('GET', '/api/stats');
  ok('GET /api/stats', st.status === 200 && st.json.totalBikes >= 12 && st.json.newRequests >= 1,
    'bikes=' + st.json.totalBikes + ' new=' + st.json.newRequests);

  const pt = await req('PATCH', '/api/sell-requests/' + sr.json.id, { status: 'nego' });
  ok('PATCH status → nego', pt.status === 200 && pt.json.status === 'nego');

  const fl = await req('GET', '/api/sell-requests?status=nego');
  ok('filter ?status=nego', fl.json.some((r) => r.id === sr.json.id));

  const dr = await req('DELETE', '/api/sell-requests/' + sr.json.id);
  ok('DELETE permintaan', dr.status === 200);

  /* ---- statis: frontend & admin disajikan backend ---- */
  const root = await req('GET', '/');
  ok('GET / menyajikan frontend', root.status === 200 && /id="bikeGrid"/.test(root.text));

  const adm = await req('GET', '/admin');
  ok('GET /admin halaman dashboard', adm.status === 200 && /NuMotorindo/.test(adm.text));

  const feCss = await req('GET', '/css/base.css');
  ok('static CSS frontend', feCss.status === 200);

  const feSvg = await req('GET', '/assets/img/moto-sport.svg');
  ok('static SVG ilustrasi', feSvg.status === 200);

  const adCss = await req('GET', '/admin/css/admin.css');
  ok('static CSS admin', adCss.status === 200);

  /* ---- CORS preflight ---- */
  const pf = await req('OPTIONS', '/api/bikes');
  ok('CORS preflight (OPTIONS)', pf.status === 204 && pf.headers['access-control-allow-origin'] === '*');

  console.log('\n==============================================');
  console.log('  Hasil: ' + pass + ' PASS, ' + fail + ' FAIL' + (fail === 0 ? '  OK' : '  ADA YANG GAGAL'));
  console.log('==============================================');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('Gagal menjalankan test — pastikan server sudah jalan:', e.message);
  process.exit(1);
});