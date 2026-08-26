/* ============================================================
   NuMotorindo Backend — REST API
   /api/health          status server
   /api/stats           ringkasan angka untuk dashboard admin
   /api/bikes           CRUD katalog motor
   /api/sell-requests   permintaan jual/konsinyasi dari form website
============================================================ */
'use strict';

const db = require('./db');

const TYPES = { matic: 'Skutik', sport: 'Sport', bebek: 'Bebek Sport', retro: 'Retro Klasik' };
const CONDS = ['like-new', 'bagus', 'muluz'];
const STATUSES = ['baru', 'dihubungi', 'nego', 'deal', 'batal'];
const IMG_BY_TYPE = {
  matic: 'assets/img/moto-matic.svg',
  sport: 'assets/img/moto-sport.svg',
  bebek: 'assets/img/moto-bebek.svg',
  retro: 'assets/img/moto-retro.svg'
};

/* ---------- Helper respons & CORS ---------- */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, obj) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (ch) => {
      size += ch.length;
      if (size > 200 * 1024) {
        reject(new Error('Payload terlalu besar (maks 200KB)'));
        req.destroy();
        return;
      }
      parts.push(ch);
    });
    req.on('end', () => {
      if (!parts.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); }
      catch (e) { reject(new Error('Body bukan JSON yang valid')); }
    });
    req.on('error', reject);
  });
}

/* ---------- Validator: motor ---------- */
function validateBike(raw, partial) {
  const errors = {};
  const out = {};
  const s = (k) => (typeof raw[k] === 'string' ? raw[k].trim() : raw[k] == null ? '' : String(raw[k]).trim());
  const maxY = new Date().getFullYear() + 1;

  const name = s('name');
  if (name) { if (name.length < 3) errors.name = 'Nama minimal 3 karakter'; else out.name = name; }
  else if (!partial) errors.name = 'Nama motor wajib diisi';

  const brand = s('brand');
  if (brand) out.brand = brand; else if (!partial) errors.brand = 'Merek wajib diisi';

  const type = s('type');
  if (type) {
    if (!TYPES[type]) errors.type = 'Tipe harus salah satu dari: ' + Object.keys(TYPES).join(', ');
    else out.type = type;
  } else if (!partial) errors.type = 'Tipe wajib dipilih';

  if (raw.year != null && raw.year !== '') {
    const year = parseInt(raw.year, 10);
    if (isNaN(year) || year < 1990 || year > maxY) errors.year = 'Tahun harus 1990–' + maxY;
    else out.year = year;
  } else if (!partial) errors.year = 'Tahun wajib diisi';

  if (raw.km != null && raw.km !== '') {
    const km = parseInt(raw.km, 10);
    if (isNaN(km) || km < 0) errors.km = 'Kilometer harus angka ≥ 0';
    else out.km = km;
  } else if (!partial) errors.km = 'Kilometer wajib diisi';

  if (raw.cc != null && raw.cc !== '') {
    const cc = parseInt(raw.cc, 10);
    if (isNaN(cc) || cc <= 0) errors.cc = 'CC harus angka > 0';
    else out.cc = cc;
  } else if (!partial) errors.cc = 'CC wajib diisi';

  const trans = s('trans');
  if (trans) out.trans = trans; else if (!partial) errors.trans = 'Transmisi wajib diisi';

  if (raw.price != null && raw.price !== '') {
    const price = parseInt(raw.price, 10);
    if (isNaN(price) || price < 1000000) errors.price = 'Harga minimal Rp 1.000.000';
    else out.price = price;
  } else if (!partial) errors.price = 'Harga wajib diisi';

  const oldPrice = parseInt(raw.oldPrice, 10);
  if (raw.oldPrice != null && raw.oldPrice !== '') {
    if (isNaN(oldPrice) || oldPrice < 0) errors.oldPrice = 'Harga lama harus angka ≥ 0';
    else out.oldPrice = oldPrice;
  }

  const cond = s('cond');
  if (cond) {
    if (CONDS.indexOf(cond) === -1) errors.cond = 'Kondisi harus: ' + CONDS.join(', ');
    else out.cond = cond;
  } else if (!partial) errors.cond = 'Kondisi wajib dipilih';

  const color = s('color');
  if (color) out.color = color; else if (!partial) errors.color = 'Warna wajib diisi';

  const desc = s('desc');
  if (desc) out.desc = desc.slice(0, 600);

  const img = s('img');
  if (img) out.img = img;
  else if (!partial) out.img = IMG_BY_TYPE[out.type] || IMG_BY_TYPE.sport;

  return { ok: Object.keys(errors).length === 0, errors: errors, value: out };
}

/* ---------- Validator: permintaan jual ---------- */
function validateRequest(raw) {
  const errors = {};
  const out = {};

  const nama = String(raw.nama || '').trim();
  if (nama.length < 3) errors.nama = 'Nama minimal 3 karakter'; else out.nama = nama;

  const wa = String(raw.wa || '').replace(/[\s-]/g, '');
  if (!/^(\+?62|0)8\d{7,12}$/.test(wa)) errors.wa = 'Format nomor WhatsApp tidak valid';
  else out.wa = wa;

  const merk = String(raw.merk || '').trim();
  if (!merk) errors.merk = 'Merek wajib diisi'; else out.merk = merk;

  const model = String(raw.model || '').trim();
  if (model.length < 2) errors.model = 'Model minimal 2 karakter'; else out.model = model;

  const maxY = new Date().getFullYear() + 1;
  const tahun = parseInt(raw.tahun, 10);
  if (isNaN(tahun) || tahun < 1990 || tahun > maxY) errors.tahun = 'Tahun harus 1990–' + maxY;
  else out.tahun = tahun;

  const harga = parseInt(raw.harga, 10);
  if (isNaN(harga) || harga < 1000000) errors.harga = 'Harga minimal Rp 1.000.000';
  else out.harga = harga;

  out.kelengkapan = Array.isArray(raw.kelengkapan)
    ? raw.kelengkapan.filter((k) => typeof k === 'string').slice(0, 10)
    : [];

  out.catatan = String(raw.catatan || '').trim().slice(0, 500);

  return { ok: Object.keys(errors).length === 0, errors: errors, value: out };
}

/* ---------- Router utama API ---------- */
function handleApi(req, res, url) {
  const method = req.method;

  if (method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  if (url.pathname === '/api/health' && method === 'GET') {
    return json(res, 200, { ok: true, service: 'numotorindo-backend', time: new Date().toISOString() });
  }

  const data = db.load();
  const seg = url.pathname.split('/').filter(Boolean); // ['api','bikes','id?']

  /* ---- /api/stats ---- */
  if (url.pathname === '/api/stats' && method === 'GET') {
    const byBrand = {};
    data.bikes.forEach((b) => { byBrand[b.brand] = (byBrand[b.brand] || 0) + 1; });
    return json(res, 200, {
      totalBikes: data.bikes.length,
      byBrand: byBrand,
      totalRequests: data.sellRequests.length,
      newRequests: data.sellRequests.filter((r) => r.status === 'baru').length
    });
  }

  /* ---- /api/bikes ---- */
  if (seg[0] === 'api' && seg[1] === 'bikes') {
    const id = seg[2];

    /* GET daftar + filter/sort ala frontend */
    if (!id && method === 'GET') {
      let list = data.bikes.slice();
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      const brand = url.searchParams.get('brand') || '';
      const sort = url.searchParams.get('sort') || 'new';
      if (q) list = list.filter((b) => ((b.name || '') + ' ' + (b.brand || '') + ' ' + (b.typeName || '')).toLowerCase().indexOf(q) !== -1);
      if (brand && brand !== 'Semua') list = list.filter((b) => String(b.brand).toLowerCase() === brand.toLowerCase());
      const cmp = {
        'price-asc': function (a, b) { return a.price - b.price; },
        'price-desc': function (a, b) { return b.price - a.price; },
        'km-asc': function (a, b) { return a.km - b.km; },
        'year-desc': function (a, b) { return b.year - a.year; }
      };
      list.sort(cmp[sort] || function (a, b) { return b.year - a.year || a.price - b.price; });
      return json(res, 200, list);
    }

    /* POST buat motor baru */
    if (!id && method === 'POST') {
      return readBody(req).then((body) => {
        const v = validateBike(body, false);
        if (!v.ok) return json(res, 400, { message: 'Data tidak valid', errors: v.errors });
        const bike = Object.assign(
          { id: db.nextId('bike'), typeName: TYPES[v.value.type], oldPrice: null, desc: '' },
          v.value
        );
        data.bikes.unshift(bike);
        db.save();
        return json(res, 201, bike);
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    if (id) {
      const idx = data.bikes.findIndex((b) => b.id === id);
      if (idx === -1) return json(res, 404, { message: 'Motor dengan id "' + id + '" tidak ditemukan' });

      if (method === 'GET') return json(res, 200, data.bikes[idx]);

      /* PUT = ganti penuh, PATCH = perbarui sebagian */
      if (method === 'PUT' || method === 'PATCH') {
        const partial = method === 'PATCH';
        return readBody(req).then((body) => {
          const v = validateBike(body, partial);
          if (!v.ok) return json(res, 400, { message: 'Data tidak valid', errors: v.errors });
          const bike = data.bikes[idx];
          Object.assign(bike, v.value);
          if (v.value.type) bike.typeName = TYPES[v.value.type];
          if (body.oldPrice == null || body.oldPrice === '') bike.oldPrice = null;
          db.save();
          return json(res, 200, bike);
        }).catch((err) => json(res, 400, { message: err.message }));
      }

      if (method === 'DELETE') {
        const removed = data.bikes.splice(idx, 1)[0];
        db.save();
        return json(res, 200, { message: 'Motor "' + removed.name + '" dihapus', id: removed.id });
      }
    }
  }

  /* ---- /api/sell-requests ---- */
  if (seg[0] === 'api' && seg[1] === 'sell-requests') {
    const id = seg[2];

    if (!id && method === 'GET') {
      let list = data.sellRequests.slice();
      const status = url.searchParams.get('status');
      if (status) list = list.filter((r) => r.status === status);
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return json(res, 200, list);
    }

    if (!id && method === 'POST') {
      return readBody(req).then((body) => {
        const v = validateRequest(body);
        if (!v.ok) return json(res, 400, { message: 'Data tidak valid', errors: v.errors });
        const item = Object.assign({
          id: db.nextId('sr'),
          status: 'baru',
          createdAt: new Date().toISOString(),
          source: 'website'
        }, v.value);
        data.sellRequests.push(item);
        db.save();
        return json(res, 201, item);
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    if (id) {
      const idx = data.sellRequests.findIndex((r) => r.id === id);
      if (idx === -1) return json(res, 404, { message: 'Permintaan "' + id + '" tidak ditemukan' });

      if (method === 'PATCH') {
        return readBody(req).then((body) => {
          const item = data.sellRequests[idx];
          if (body.status) {
            if (STATUSES.indexOf(body.status) === -1) {
              return json(res, 400, { message: 'Status harus salah satu dari: ' + STATUSES.join(', ') });
            }
            item.status = body.status;
          }
          if (typeof body.note === 'string') item.note = body.note.trim().slice(0, 500);
          item.updatedAt = new Date().toISOString();
          db.save();
          return json(res, 200, item);
        }).catch((err) => json(res, 400, { message: err.message }));
      }

      if (method === 'DELETE') {
        data.sellRequests.splice(idx, 1);
        db.save();
        return json(res, 200, { message: 'Permintaan dihapus', id: id });
      }
    }
  }

  return json(res, 404, { message: 'Endpoint API tidak ditemukan', hint: 'Lihat backend/README.md untuk daftar endpoint' });
}

module.exports = { handleApi };