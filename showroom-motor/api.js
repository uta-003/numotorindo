/* ============================================================
   NuMo Showroom — REST API (tanpa dependensi eksternal)
   /api/auth/*      login, logout, profil
   /api/users       manajemen pengguna (admin)
   /api/units       CRUD unit motor + biaya perbaikan/dokumen
   /api/invoices    invoice penjualan (otomatis ubah status unit)
   /api/reports     ringkasan laba/rugi
   Role: admin | owner | sales | mekanik
============================================================ */
'use strict';

const crypto = require('crypto');
const db = require('./db');
const { hashPassword, verifyPassword } = require('./hash');

const ROLES = ['admin', 'owner', 'sales', 'mekanik'];
const UNIT_STATUS = ['tersedia', 'booking', 'terjual'];
const COST_TYPES = ['perbaikan', 'dokumen'];
const PAY_METHODS = ['tunai', 'transfer', 'kredit', 'dp'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* ---------- Respons & CORS ---------- */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, status, obj) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function fail(res, status, message, errors) {
  return json(res, status, errors ? { message, errors } : { message });
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

/* ---------- Autentikasi & Role ---------- */
const SESSION_TTL = db.SESSION_TTL;

function tokenOf(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

function currentUser(req) {
  const tok = tokenOf(req);
  if (!tok) return null;
  const data = db.load();
  const s = data.sessions[tok];
  if (!s) return null;
  if (Date.now() - new Date(s.createdAt).getTime() > SESSION_TTL) {
    delete data.sessions[tok];
    db.save();
    return null;
  }
  const u = data.users.find((x) => x.id === s.userId);
  return u && u.active ? u : null;
}

function perms(u) {
  const base = { manageUnits: false, editPurchase: false, editRepairs: false, editDocs: false,
    editSellPrice: false, sell: false, viewReports: false, manageUsers: false };
  if (u.role === 'admin') return Object.assign(base, { manageUnits: true, editPurchase: true, editRepairs: true,
    editDocs: true, editSellPrice: true, sell: true, viewReports: true, manageUsers: true });
  if (u.role === 'owner') return Object.assign(base, { editSellPrice: true, viewReports: true });
  if (u.role === 'sales') return Object.assign(base, { editSellPrice: true, sell: true });
  if (u.role === 'mekanik') return Object.assign(base, { editRepairs: true });
  return base;
}

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, active: !!u.active, createdAt: u.createdAt };
}

/* ---------- Kalkulasi modal & laba/rugi ---------- */
function calcTotals(u) {
  const repair = (u.repairCosts || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const doc = (u.docCosts || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const purchase = Number(u.purchaseCost) || 0;
  const modal = purchase + repair + doc;
  const sellPrice = Number(u.sellPrice) || 0;
  const profit = sellPrice - modal;
  const margin = sellPrice ? Math.round((profit / sellPrice) * 1000) / 10 : 0;
  return { purchase, repair, doc, modal, sellPrice, profit, margin };
}

function serializeUnit(u, viewer) {
  const t = calcTotals(u);
  const base = Object.assign({}, u, {
    repairCosts: u.repairCosts || [],
    docCosts: u.docCosts || []
  });
  /* mekanik tidak melihat angka pembelian/harga/laba */
  if (viewer && viewer.role === 'mekanik') {
    base.purchaseCost = null;
    base.sellPrice = null;
    base.totals = { purchase: null, repair: t.repair, doc: null, modal: null, sellPrice: null, profit: null, margin: null };
  } else {
    base.totals = t;
  }
  return base;
}

function isoMonth(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* ---------- Validator ---------- */
function validateUnit(raw, partial) {
  const errors = {}, out = {};
  const s = (k) => (typeof raw[k] === 'string' ? raw[k].trim() : raw[k] == null ? '' : String(raw[k]).trim());
  const num = (k) => {
    const v = raw[k];
    if (v === undefined || v === null || v === '') return null;
    const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? NaN : n;
  };
  const maxY = new Date().getFullYear() + 1;

  let v = s('name');
  if (v) { if (v.length < 3) errors.name = 'Nama motor minimal 3 karakter'; else out.name = v; }
  else if (!partial) errors.name = 'Nama motor wajib diisi';

  v = s('brand');
  if (v) { if (v.length < 2) errors.brand = 'Merek minimal 2 karakter'; else out.brand = v; }
  else if (!partial) errors.brand = 'Merek wajib diisi';

  let n = num('year');
  if (n === null) { if (!partial) errors.year = 'Tahun wajib diisi'; }
  else if (isNaN(n) || n < 1980 || n > maxY) errors.year = 'Tahun harus 1980–' + maxY;
  else out.year = n;

  n = num('km');
  if (n === null) { if (!partial) errors.km = 'Kilometer wajib diisi'; }
  else if (isNaN(n) || n < 0) errors.km = 'Kilometer harus angka ≥ 0';
  else out.km = n;

  n = num('cc');
  if (n === null) { if (!partial) errors.cc = 'CC wajib diisi'; }
  else if (isNaN(n) || n < 50 || n > 2000) errors.cc = 'CC harus 50–2000';
  else out.cc = n;

  n = num('purchaseCost');
  if (n === null) { if (!partial) errors.purchaseCost = 'Biaya pembelian unit wajib diisi'; }
  else if (isNaN(n)) errors.purchaseCost = 'Harus angka yang valid';
  else if (n < 100000) errors.purchaseCost = 'Minimal Rp 100.000';
  else out.purchaseCost = n;

  n = num('sellPrice');
  if (n === null) { if (!partial) out.sellPrice = 0; }
  else if (isNaN(n)) errors.sellPrice = 'Harus angka yang valid';
  else if (n < 0) errors.sellPrice = 'Harga jual tidak boleh negatif';
  else out.sellPrice = n;

  v = s('color'); if (v) { if (v.length > 30) errors.color = 'Maksimal 30 karakter'; else out.color = v; } else if (!partial) out.color = '';
  v = s('transmisi'); if (v) out.transmisi = v.slice(0, 30); else if (!partial) out.transmisi = '';
  v = s('nopol'); if (v) { if (v.length > 16) errors.nopol = 'Nomor polisi maksimal 16 karakter'; else out.nopol = v.toUpperCase(); } else if (!partial) out.nopol = '';
  v = s('type'); if (v) out.type = v.slice(0, 30); else if (!partial) out.type = '';

  v = s('purchaseDate');
  if (v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) errors.purchaseDate = 'Format tanggal tidak valid'; else out.purchaseDate = v; }

  v = s('notes'); if (v) out.notes = v.slice(0, 500); else if (!partial) out.notes = '';

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

function validateCost(raw) {
  const errors = {}, out = {};
  const type = String(raw.type || '').trim().toLowerCase();
  if (!COST_TYPES.includes(type)) errors.type = "Jenis biaya harus 'perbaikan' atau 'dokumen'";
  else out.type = type;

  const desc = typeof raw.desc === 'string' ? raw.desc.trim() : '';
  if (desc.length < 3) errors.desc = 'Keterangan minimal 3 karakter';
  else if (desc.length > 120) errors.desc = 'Keterangan maksimal 120 karakter';
  else out.desc = desc;

  const amt = parseInt(String(raw.amount == null ? '' : raw.amount).replace(/[^0-9]/g, ''), 10);
  if (isNaN(amt) || amt <= 0) errors.amount = 'Nominal harus angka lebih dari 0';
  else if (amt > 1e12) errors.amount = 'Nominal terlalu besar';
  else out.amount = amt;

  const date = String(raw.date || '').trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) errors.date = 'Format tanggal tidak valid';
    else out.date = date;
  } else {
    out.date = new Date().toISOString().slice(0, 10);
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

/* Validator satu item biaya tanpa field type (dipakai array biaya di form) */
function validateCostItem(raw) {
  const errors = {}, out = {};
  const desc = typeof raw.desc === 'string' ? raw.desc.trim() : '';
  if (desc.length < 3) errors.desc = 'Keterangan minimal 3 karakter';
  else if (desc.length > 120) errors.desc = 'Keterangan maksimal 120 karakter';
  else out.desc = desc;

  const amt = parseInt(String(raw.amount == null ? '' : raw.amount).replace(/[^0-9]/g, ''), 10);
  if (isNaN(amt) || amt <= 0) errors.amount = 'Nominal harus angka lebih dari 0';
  else if (amt > 1e12) errors.amount = 'Nominal terlalu besar';
  else out.amount = amt;

  const date = String(raw.date || '').trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) errors.date = 'Format tanggal tidak valid';
    else out.date = date;
  } else {
    out.date = new Date().toISOString().slice(0, 10);
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

function validateCostArray(arr, type) {
  const label = type === 'perbaikan' ? 'Biaya perbaikan' : 'Biaya dokumen';
  const out = [];
  if (arr === undefined || arr === null) return { ok: true, out };
  if (!Array.isArray(arr)) return { ok: false, errors: { costs: label + ' harus berupa daftar' } };
  for (let i = 0; i < arr.length; i++) {
    const r = validateCostItem(arr[i] || {});
    if (!r.ok) {
      const msg = Object.keys(r.errors).map((k) => r.errors[k]).join(', ');
      return { ok: false, errors: { costs: label + ' baris ke-' + (i + 1) + ': ' + msg } };
    }
    out.push({ id: db.nextId('cost', 'cost'), desc: r.out.desc, amount: r.out.amount, date: r.out.date });
  }
  return { ok: true, out };
}

function validateUser(raw, opts) {
  const partial = !!(opts && opts.partial);
  const creating = !!(opts && opts.creating);
  const errors = {}, out = {};

  const username = String(raw.username || '').trim().toLowerCase();
  if (username) {
    if (!/^[a-z0-9._]{3,20}$/.test(username)) errors.username = 'Username 3–20 karakter (huruf, angka, titik, underscore)';
    else out.username = username;
  } else if (!partial && creating) errors.username = 'Username wajib diisi';

  const name = String(raw.name || '').trim();
  if (name) { if (name.length < 3) errors.name = 'Nama minimal 3 karakter'; else out.name = name; }
  else if (!partial && creating) errors.name = 'Nama wajib diisi';

  const role = String(raw.role || '').trim().toLowerCase();
  if (role) {
    if (!ROLES.includes(role)) errors.role = 'Role harus salah satu dari: ' + ROLES.join(', ');
    else out.role = role;
  } else if (!partial && creating) errors.role = 'Role wajib dipilih';

  if (raw.password != null && raw.password !== '') {
    if (String(raw.password).length < 5) errors.password = 'Password minimal 5 karakter';
    else out.password = String(raw.password);
  } else if (creating) {
    errors.password = 'Password wajib diisi (min. 5 karakter)';
  }

  if (raw.active != null) out.active = !!raw.active;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

function validateInvoice(raw) {
  const errors = {}, out = {};
  const s = (k) => (typeof raw[k] === 'string' ? raw[k].trim() : raw[k] == null ? '' : String(raw[k]).trim());
  const num = (k) => {
    const v = raw[k];
    if (v === undefined || v === null || v === '') return null;
    const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? NaN : n;
  };

  const buyerName = s('buyerName');
  if (buyerName.length < 3) errors.buyerName = 'Nama pembeli minimal 3 karakter';
  else out.buyerName = buyerName;

  const phone = s('buyerPhone').replace(/\s+/g, ' ');
  if (phone) {
    if (!/^[\d+\-() ]{5,20}$/.test(phone)) errors.buyerPhone = 'Nomor telepon tidak valid';
    else out.buyerPhone = phone;
  }

  const addr = s('buyerAddress');
  if (addr.length > 200) errors.buyerAddress = 'Alamat maksimal 200 karakter';
  else out.buyerAddress = addr;

  const method = s('paymentMethod').toLowerCase();
  if (!PAY_METHODS.includes(method)) errors.paymentMethod = 'Metode pembayaran harus: ' + PAY_METHODS.join(', ');
  else out.paymentMethod = method;

  const sellPrice = num('sellPrice');
  if (sellPrice !== null) {
    if (isNaN(sellPrice)) errors.sellPrice = 'Harga jual harus angka';
    else if (sellPrice < 100000) errors.sellPrice = 'Minimal Rp 100.000';
    else out.sellPrice = sellPrice;
  }

  const discount = num('discount');
  if (discount !== null) {
    if (isNaN(discount)) errors.discount = 'Diskon harus angka';
    else if (discount < 0) errors.discount = 'Diskon tidak boleh negatif';
    else out.discount = discount;
  } else {
    out.discount = 0;
  }

  const date = s('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) errors.date = 'Format tanggal tidak valid';
    else out.date = date;
  } else {
    out.date = new Date().toISOString().slice(0, 10);
  }

  const note = s('note');
  if (note.length > 300) errors.note = 'Catatan maksimal 300 karakter';
  else out.note = note;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

/* ============================================================
   Dispatcher utama
============================================================ */
async function handleApi(req, res, url) {
  try {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const data = db.load();
    const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const m = req.method.toUpperCase();

    if (seg[0] === 'health' && m === 'GET') {
      return json(res, 200, { ok: true, service: 'numo-showroom', time: new Date().toISOString() });
    }

    /* ---------- /api/auth ---------- */
    if (seg[0] === 'auth') {
      if (seg[1] === 'login' && m === 'POST') {
        const b = await readBody(req);
        const uname = String(b.username || '').trim().toLowerCase();
        const pw = String(b.password || '');
        if (!uname || !pw) return fail(res, 400, 'Username dan password wajib diisi');
        const u = data.users.find((x) => x.username.toLowerCase() === uname);
        if (!u || !verifyPassword(pw, u.salt, u.passHash)) return fail(res, 401, 'Username atau password salah');
        if (!u.active) return fail(res, 403, 'Akun Anda dinonaktifkan. Hubungi admin.');
        const tok = crypto.randomBytes(24).toString('hex');
        data.sessions[tok] = { userId: u.id, createdAt: new Date().toISOString() };
        db.save();
        return json(res, 200, { token: tok, user: publicUser(u), permissions: perms(u) });
      }
      const me0 = currentUser(req);
      if (!me0) return fail(res, 401, 'Sesi berakhir. Silakan login kembali.');
      if (seg[1] === 'me' && m === 'GET') return json(res, 200, { user: publicUser(me0), permissions: perms(me0) });
      if (seg[1] === 'logout' && m === 'POST') {
        const tok = tokenOf(req);
        if (tok && data.sessions[tok]) { delete data.sessions[tok]; db.save(); }
        return json(res, 200, { ok: true });
      }
      return fail(res, 404, 'Endpoint tidak ditemukan');
    }

    const me = currentUser(req);
    if (!me) return fail(res, 401, 'Silakan login terlebih dahulu');
    const P = perms(me);

    /* ---------- /api/users (admin) ---------- */
    if (seg[0] === 'users') {
      if (!P.manageUsers) return fail(res, 403, 'Hanya admin yang dapat mengelola pengguna');
      if (m === 'GET' && !seg[1]) return json(res, 200, data.users.map(publicUser));

      if (m === 'POST' && !seg[1]) {
        const b = await readBody(req);
        const v = validateUser(b, { creating: true });
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        if (data.users.some((x) => x.username === v.out.username)) {
          return fail(res, 400, 'Username sudah dipakai', { username: 'Username sudah dipakai' });
        }
        const { salt, hash } = hashPassword(v.out.password);
        const u = { id: db.nextId('user', 'user'), username: v.out.username, name: v.out.name,
          role: v.out.role, salt, passHash: hash, active: v.out.active !== false, createdAt: new Date().toISOString() };
        data.users.push(u); db.save();
        return json(res, 201, publicUser(u));
      }

      const idx = data.users.findIndex((x) => x.id === seg[1]);
      if (idx < 0) return fail(res, 404, 'Pengguna tidak ditemukan');
      const target = data.users[idx];

      if (m === 'PUT') {
        const b = await readBody(req);
        const v = validateUser(b, { partial: true });
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        if (v.out.username && data.users.some((x) => x.username === v.out.username && x.id !== target.id)) {
          return fail(res, 400, 'Username sudah dipakai', { username: 'Username sudah dipakai' });
        }
        if (target.id === me.id) {
          if (v.out.role && v.out.role !== 'admin') return fail(res, 400, 'Tidak dapat mengubah role akun sendiri');
          if (v.out.active === false) return fail(res, 400, 'Tidak dapat menonaktifkan akun sendiri');
        }
        if (v.out.username) target.username = v.out.username;
        if (v.out.name) target.name = v.out.name;
        if (v.out.role) target.role = v.out.role;
        if (v.out.active != null) target.active = v.out.active;
        if (v.out.password) {
          const { salt, hash } = hashPassword(v.out.password);
          target.salt = salt; target.passHash = hash;
        }
        db.save();
        return json(res, 200, publicUser(target));
      }

      if (m === 'DELETE') {
        if (target.id === me.id) return fail(res, 400, 'Tidak dapat menghapus akun sendiri');
        data.users.splice(idx, 1); db.save();
        return json(res, 200, { ok: true });
      }
      return fail(res, 405, 'Metode tidak didukung');
    }

    /* ---------- /api/units ---------- */
    if (seg[0] === 'units') {
      if (m === 'GET' && !seg[1]) {
        let list = [...data.units].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const q = (url.searchParams.get('q') || '').toLowerCase().trim();
        const st = url.searchParams.get('status');
        if (st && UNIT_STATUS.includes(st)) list = list.filter((u2) => u2.status === st);
        if (q) list = list.filter((u2) =>
          [u2.code, u2.name, u2.brand, u2.nopol, String(u2.year || '')].join(' ').toLowerCase().includes(q));
        return json(res, 200, list.map((x) => serializeUnit(x, me)));
      }

      if (m === 'POST' && !seg[1]) {
        if (!P.manageUnits) return fail(res, 403, 'Anda tidak memiliki izin menambah unit');
        const b = await readBody(req);
        const v = validateUnit(b, false);
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        let status = 'tersedia';
        if (b.status != null && b.status !== '') {
          if (!UNIT_STATUS.includes(b.status)) return fail(res, 400, 'Status tidak valid', { status: 'Status harus salah satu dari: ' + UNIT_STATUS.join(', ') });
          status = b.status;
        }
        const rep = validateCostArray(b.repairCosts, 'perbaikan');
        if (!rep.ok) return fail(res, 400, rep.errors.costs, rep.errors);
        const doc = validateCostArray(b.docCosts, 'dokumen');
        if (!doc.ok) return fail(res, 400, doc.errors.costs, doc.errors);
        const id = db.nextId('unit', 'unit');
        const nu = Object.assign({}, v.out, {
          id: id, code: 'UM-' + String(parseInt(id.split('-')[1], 10)).padStart(4, '0'),
          repairCosts: rep.out, docCosts: doc.out, status: status,
          createdAt: new Date().toISOString()
        });
        data.units.push(nu); db.save();
        return json(res, 201, serializeUnit(nu, me));
      }

      const u = data.units.find((x) => x.id === seg[1]);
      if (!u) return fail(res, 404, 'Unit tidak ditemukan');

      if (!seg[2] && m === 'GET') return json(res, 200, serializeUnit(u, me));

      if (!seg[2] && m === 'PUT') {
        if (!P.manageUnits) return fail(res, 403, 'Anda tidak memiliki izin mengubah unit');
        const b = await readBody(req);
        const v = validateUnit(b, true);
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        ['name', 'brand', 'type', 'color', 'transmisi', 'nopol', 'notes'].forEach((k) => {
          if (v.out[k] !== undefined && v.out[k] !== null) u[k] = v.out[k];
        });
        ['year', 'km', 'cc', 'purchaseCost', 'sellPrice', 'purchaseDate'].forEach((k) => {
          if (v.out[k] !== undefined && v.out[k] !== null) u[k] = v.out[k];
        });
        if (b.status != null && b.status !== '') {
          if (!UNIT_STATUS.includes(b.status)) return fail(res, 400, 'Status tidak valid', { status: 'Status harus salah satu dari: ' + UNIT_STATUS.join(', ') });
          if ((u.status === 'terjual' || u.invoiceId) && b.status !== 'terjual') {
            return fail(res, 400, 'Unit sudah terjual — hapus invoice-nya terlebih dahulu untuk mengubah status');
          }
          u.status = b.status;
        }
        if (b.repairCosts !== undefined) {
          const rep = validateCostArray(b.repairCosts, 'perbaikan');
          if (!rep.ok) return fail(res, 400, rep.errors.costs, rep.errors);
          u.repairCosts = rep.out;
        }
        if (b.docCosts !== undefined) {
          const doc = validateCostArray(b.docCosts, 'dokumen');
          if (!doc.ok) return fail(res, 400, doc.errors.costs, doc.errors);
          u.docCosts = doc.out;
        }
        db.save();
        return json(res, 200, serializeUnit(u, me));
      }

      if (!seg[2] && m === 'PATCH') {
        const b = await readBody(req);
        if (b.status != null) {
          if (!(me.role === 'admin' || me.role === 'sales')) return fail(res, 403, 'Tidak diizinkan mengubah status');
          if (!UNIT_STATUS.includes(b.status)) return fail(res, 400, 'Status tidak valid');
          if (b.status === 'terjual' && me.role !== 'admin') return fail(res, 403, 'Penjualan hanya melalui pembuatan invoice');
          if (u.status === 'terjual' && b.status !== 'terjual') {
            return fail(res, 400, 'Unit sudah terjual — hapus invoice-nya lebih dahulu untuk membatalkan');
          }
          u.status = b.status;
        }
        if (b.sellPrice !== undefined && b.sellPrice !== null && b.sellPrice !== '') {
          if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
            return fail(res, 403, 'Tidak diizinkan mengubah harga jual');
          }
          if (u.status === 'terjual') return fail(res, 400, 'Unit sudah terjual — harga terkunci di invoice');
          const n = parseInt(String(b.sellPrice).replace(/[^0-9]/g, ''), 10);
          if (isNaN(n) || n < 0) return fail(res, 400, 'Harga jual tidak valid', { sellPrice: 'Harus angka ≥ 0' });
          u.sellPrice = n;
        }
        db.save();
        return json(res, 200, serializeUnit(u, me));
      }

      if (!seg[2] && m === 'DELETE') {
        if (!P.manageUnits) return fail(res, 403, 'Anda tidak memiliki izin menghapus unit');
        if (u.status === 'terjual' || u.invoiceId) return fail(res, 400, 'Unit sudah terjual. Hapus invoice terkait terlebih dahulu.');
        data.units.splice(data.units.indexOf(u), 1); db.save();
        return json(res, 200, { ok: true });
      }

      /* ---------- biaya per unit: /api/units/:id/costs ---------- */
      if (seg[2] === 'costs') {
        if (seg[3]) { /* hapus satu biaya */
          if (m !== 'DELETE') return fail(res, 405, 'Metode tidak didukung');
          const keys = ['repairCosts', 'docCosts'];
          let found = null;
          for (const k of keys) {
            const i = (u[k] || []).findIndex((c) => c.id === seg[3]);
            if (i >= 0) found = { k, i };
          }
          if (!found) return fail(res, 404, 'Biaya tidak ditemukan');
          const allowed = found.k === 'repairCosts' ? P.editRepairs : P.editDocs;
          if (!allowed) {
            return fail(res, 403, found.k === 'repairCosts'
              ? 'Hanya admin/mekanik yang dapat menghapus biaya perbaikan'
              : 'Hanya admin yang dapat menghapus biaya dokumen');
          }
          u[found.k].splice(found.i, 1); db.save();
          return json(res, 200, serializeUnit(u, me));
        }
        if (m === 'POST') { /* tambah biaya */
          const b = await readBody(req);
          const v = validateCost(b);
          if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
          const allowed = v.out.type === 'perbaikan' ? P.editRepairs : P.editDocs;
          if (!allowed) {
            return fail(res, 403, v.out.type === 'dokumen'
              ? 'Hanya admin yang dapat menambah biaya dokumen'
              : 'Hanya admin/mekanik yang dapat menambah biaya perbaikan');
          }
          const cost = { id: db.nextId('cost', 'cost'), desc: v.out.desc, amount: v.out.amount, date: v.out.date };
          (v.out.type === 'perbaikan' ? u.repairCosts : u.docCosts).push(cost);
          db.save();
          return json(res, 201, serializeUnit(u, me));
        }
        return fail(res, 405, 'Metode tidak didukung');
      }

      return fail(res, 404, 'Endpoint tidak ditemukan');
    }

    /* ---------- /api/invoices ---------- */
    if (seg[0] === 'invoices') {
      if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
        return fail(res, 403, 'Anda tidak memiliki izin mengakses invoice');
      }
      if (m === 'GET' && !seg[1]) {
        let list = [...data.invoices].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const q = (url.searchParams.get('q') || '').toLowerCase().trim();
        if (q) list = list.filter((i) => [i.number, i.buyer && i.buyer.name, i.snapshot && i.snapshot.name]
          .join(' ').toLowerCase().includes(q));
        return json(res, 200, list);
      }

      if (m === 'POST' && !seg[1]) {
        if (!P.sell) return fail(res, 403, 'Hanya admin/sales yang dapat membuat invoice');
        const b = await readBody(req);
        const unit = data.units.find((x) => x.id === b.unitId);
        if (!unit) return fail(res, 400, 'Pilih unit yang akan dijual', { unitId: 'Unit wajib dipilih' });
        if (unit.status === 'terjual' || unit.invoiceId) {
          return fail(res, 400, 'Unit ' + unit.code + ' sudah terjual');
        }
        const v = validateInvoice(b);
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        const sellPrice = v.out.sellPrice != null ? v.out.sellPrice : (Number(unit.sellPrice) || 0);
        const discount = v.out.discount || 0;
        if (discount > sellPrice) {
          return fail(res, 400, 'Diskon melebihi harga jual', { discount: 'Maksimal Rp ' + sellPrice.toLocaleString('id-ID') });
        }
        const id = db.nextId('inv', 'inv');
        const now = new Date();
        const inv = {
          id: id,
          number: 'INV/' + now.getFullYear() + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' +
            String(parseInt(id.split('-')[1], 10)).padStart(4, '0'),
          unitId: unit.id,
          snapshot: { name: unit.name, brand: unit.brand, year: unit.year, cc: unit.cc, color: unit.color, nopol: unit.nopol },
          buyer: { name: v.out.buyerName, phone: v.out.buyerPhone || '', address: v.out.buyerAddress || '' },
          sellPrice: sellPrice, discount: discount, total: sellPrice - discount,
          paymentMethod: v.out.paymentMethod, date: v.out.date, note: v.out.note,
          createdBy: me.name || me.username, createdAt: now.toISOString()
        };
        data.invoices.push(inv);
        unit.status = 'terjual'; unit.sellPrice = sellPrice;
        unit.invoiceId = inv.id; unit.soldAt = inv.date;
        db.save();
        return json(res, 201, { invoice: inv, unit: serializeUnit(unit, me) });
      }

      const invIdx = data.invoices.findIndex((x) => x.id === seg[1]);
      if (invIdx < 0) return fail(res, 404, 'Invoice tidak ditemukan');
      const inv = data.invoices[invIdx];

      if (m === 'GET') {
        const unit = data.units.find((x) => x.id === inv.unitId);
        return json(res, 200, { invoice: inv, unit: unit ? serializeUnit(unit, me) : null });
      }

      if (m === 'DELETE') {
        if (me.role !== 'admin') return fail(res, 403, 'Hanya admin yang dapat menghapus invoice');
        data.invoices.splice(invIdx, 1);
        const unit = data.units.find((x) => x.id === inv.unitId);
        if (unit && unit.invoiceId === inv.id) {
          unit.status = 'tersedia';
          delete unit.invoiceId;
          delete unit.soldAt;
        }
        db.save();
        return json(res, 200, { ok: true });
      }
      return fail(res, 405, 'Metode tidak didukung');
    }

    /* ---------- /api/reports ---------- */
    if (seg[0] === 'reports') {
      if (!P.viewReports) return fail(res, 403, 'Hanya admin/pemilik yang dapat melihat laporan laba-rugi');
      if (seg[1] === 'summary' && m === 'GET') {
        const modal = (x) => calcTotals(x).modal;
        const sold = data.units.filter((x) => x.status === 'terjual');
        const stock = data.units.filter((x) => x.status !== 'terjual');

        const revenue = data.invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const capitalSold = sold.reduce((s, x) => s + modal(x), 0);
        const profit = revenue - capitalSold;
        const stockValue = stock.reduce((s, x) => s + modal(x), 0);

        const ym = isoMonth(new Date());
        const invThis = data.invoices.filter((i) => (i.date || '').startsWith(ym));
        const unitByInv = {};
        data.units.forEach((x) => { if (x.invoiceId) unitByInv[x.invoiceId] = x; });
        const revThis = invThis.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const capThis = invThis.reduce((s, i) => s + (unitByInv[i.id] ? modal(unitByInv[i.id]) : 0), 0);

        /* tren 6 bulan terakhir */
        const months = [];
        for (let k = 5; k >= 0; k--) {
          const d = new Date();
          d.setDate(1); d.setMonth(d.getMonth() - k);
          const key = isoMonth(d);
          const invs = data.invoices.filter((i) => (i.date || '').startsWith(key));
          let rev = 0, cap = 0;
          invs.forEach((i) => {
            rev += Number(i.total) || 0;
            const uu = unitByInv[i.id];
            if (uu) cap += modal(uu);
          });
          months.push({
            key: key,
            label: BULAN[d.getMonth()] + ' ' + String(d.getFullYear()).slice(-2),
            sold: invs.length, revenue: rev, profit: rev - cap
          });
        }

        return json(res, 200, {
          counts: { total: data.units.length, tersedia: stock.filter((x) => x.status === 'tersedia').length,
            booking: stock.filter((x) => x.status === 'booking').length, terjual: sold.length },
          stockValue, revenue, capitalSold, profit,
          month: { key: ym, invoices: invThis.length, revenue: revThis, profit: revThis - capThis },
          months,
          avgMargin: sold.length
            ? Math.round(sold.reduce((s, x) => s + calcTotals(x).margin, 0) / sold.length * 10) / 10
            : 0
        });
      }
      return fail(res, 404, 'Endpoint tidak ditemukan');
    }

    return fail(res, 404, 'Endpoint tidak ditemukan');
  } catch (err) {
    console.error('[api]', req.method, url.pathname, err);
    if (!res.headersSent) return fail(res, 500, (err && err.message) || 'Internal server error');
  }
}

module.exports = { handleApi };