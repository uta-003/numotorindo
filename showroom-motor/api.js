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
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { PHOTOS_DIR } = db;
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

function readBody(req, maxKB) {
  const cap = Math.max(10, maxKB || 200) * 1024;
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (ch) => {
      size += ch.length;
      if (size > cap) {
        reject(new Error('Payload terlalu besar (maks ' + Math.round(cap / 1024) + 'KB)'));
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
  return { id: u.id, username: u.username, name: u.name, role: u.role, active: !!u.active,
    komisiPersen: Number(u.komisiPersen) || 0, targetBulanan: Number(u.targetBulanan) || 0,
    createdAt: u.createdAt };
}

/* ---------- Audit log & proteksi login ---------- */
const loginFails = new Map();
const LOGIN_MAX_FAIL = 5;
const LOGIN_LOCK_MS = 5 * 60 * 1000;

function logAct(me, action, detail) {
  try {
    const d = db.load();
    if (!Array.isArray(d.logs)) d.logs = [];
    d.logs.push({
      id: 'log-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: new Date().toISOString(),
      user: me ? me.username : '-',
      role: me ? me.role : '-',
      action: action,
      detail: String(detail == null ? '' : detail).slice(0, 300)
    });
    if (d.logs.length > 600) d.logs.splice(0, d.logs.length - 600);
    db.save();
  } catch (e) { /* jangan ganggu respons utama */ }
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
    docCosts: u.docCosts || [],
    bpkb: calcBpkb(u)
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

/* ---------- BPKB: hitungan hari kerja (Sabtu, Minggu & libur nasional) ---------- */
/* Daftar libur nasional & cuti bersama Indonesia.
   Update tiap awal tahun sesuai SKB 3 Menteri. Tanggal Hijriah = perkiraan. */
const LIBUR_NASIONAL = new Set([
  /* 2025 */
  '2025-01-01','2025-01-27','2025-01-29','2025-03-14','2025-03-31',
  '2025-04-01','2025-04-02','2025-04-03','2025-04-07','2025-04-18',
  '2025-05-01','2025-05-12','2025-05-29','2025-05-30','2025-06-01',
  '2025-06-06','2025-06-26','2025-08-17','2025-09-05','2025-12-25','2025-12-26',
  /* 2026 */
  '2026-01-01','2026-01-16','2026-02-17','2026-03-18','2026-03-19',
  '2026-03-20','2026-03-21','2026-04-03','2026-05-01','2026-05-14',
  '2026-05-27','2026-06-01','2026-06-16','2026-08-17','2026-12-25','2026-12-26',
  /* 2027 (perkiraan) */
  '2027-01-01','2027-01-05','2027-02-06','2027-03-09','2027-03-10',
  '2027-03-11','2027-03-26','2027-05-01','2027-05-06','2027-05-17',
  '2027-05-20','2027-06-01','2027-06-06','2027-08-17','2027-12-25','2027-12-26'
]);

function isoDay(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function isLibur(d) {
  const wd = d.getDay();
  return wd === 0 || wd === 6 || LIBUR_NASIONAL.has(isoDay(d));
}

/* tambah `days` hari kerja dari tanggal mulai */
function addWorkingDays(startISO, days) {
  const d = new Date(startISO + 'T00:00:00');
  let added = 0, guard = 0;
  while (added < days && guard++ < 4000) {
    d.setDate(d.getDate() + 1);
    if (!isLibur(d)) added++;
  }
  return isoDay(d);
}

/* selisih hari kerja antar dua tanggal (arah otomatis, hasil bisa negatif) */
function workdaysBetween(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00'), b = new Date(bISO + 'T00:00:00');
  const forward = b >= a;
  let n = 0, guard = 0;
  const cur = new Date(a.getTime());
  cur.setDate(cur.getDate() + (forward ? 1 : -1));
  while ((forward ? cur <= b : cur >= b) && guard++ < 4000) {
    if (!isLibur(cur)) n++;
    cur.setDate(cur.getDate() + (forward ? 1 : -1));
  }
  return forward ? n : -n;
}

/* ringkasan status BPKB sebuah unit */
function calcBpkb(u) {
  const days = Number(u.bpkbDays) || 0;
  if (!days) return null;
  const start = u.bpkbStart || u.purchaseDate || u.soldAt || isoDay(new Date());
  const due = addWorkingDays(start, days);
  const today = isoDay(new Date());

  /* sudah diambil -> SIAP, notifikasi berhenti */
  if (u.bpkbReady) {
    return { days, start, due, remainWork: null, calLeft: null,
      status: 'siap', readyAt: u.bpkbReadyAt || null };
  }

  const remainWork = workdaysBetween(today, due);
  const calLeft = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  const status = calLeft < 0 ? 'terlambat' : (calLeft <= 7 ? 'kritis' : 'proses');
  return { days, start, due, remainWork, calLeft, status, readyAt: null };
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

  n = num('bpkbDays');
  if (n === null) { if (!partial) out.bpkbDays = 0; }
  else if ([7, 14, 21, 28].indexOf(n) < 0) errors.bpkbDays = 'Pilih 7, 14, 21, atau 28 hari kerja';
  else out.bpkbDays = n;

  v = s('bpkbStart');
  if (v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) errors.bpkbStart = 'Format tanggal tidak valid'; else out.bpkbStart = v; }

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

  v = s('pajakDue');
  if (v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) errors.pajakDue = 'Format tanggal tidak valid'; else out.pajakDue = v; }

  v = s('noRangka'); if (v) { if (v.length > 40) errors.noRangka = 'Nomor rangka maksimal 40 karakter'; else out.noRangka = v.toUpperCase(); }
  v = s('noMesin'); if (v) { if (v.length > 40) errors.noMesin = 'Nomor mesin maksimal 40 karakter'; else out.noMesin = v.toUpperCase(); }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

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
  if (raw.komisiPersen != null && raw.komisiPersen !== '') {
    const k = parseInt(String(raw.komisiPersen).replace(/[^0-9.]/g, ''), 10);
    if (isNaN(k) || k < 0 || k > 100) errors.komisiPersen = 'Komisi harus 0–100';
    else out.komisiPersen = k;
  }
  if (raw.targetBulanan != null && raw.targetBulanan !== '') {
    const t = parseInt(String(raw.targetBulanan).replace(/[^0-9]/g, ''), 10);
    if (isNaN(t) || t < 0) errors.targetBulanan = 'Target tidak valid';
    else out.targetBulanan = t;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

function validateCustomer(raw) {
  const errors = {}, out = {};
  const name = String(raw.name || '').trim();
  if (name.length < 3) errors.name = 'Nama pelanggan minimal 3 karakter';
  else if (name.length > 80) errors.name = 'Nama maksimal 80 karakter';
  else out.name = name;

  const phone = String(raw.phone || '').trim().replace(/\s+/g, ' ');
  if (phone) {
    if (!/^[\d+\-() ]{5,20}$/.test(phone)) errors.phone = 'Nomor telepon tidak valid';
    else out.phone = phone;
  }

  const addr = String(raw.address || '').trim();
  if (addr.length > 200) errors.address = 'Alamat maksimal 200 karakter';
  else out.address = addr;

  const notes = String(raw.notes || '').trim();
  if (notes.length > 300) errors.notes = 'Catatan maksimal 300 karakter';
  else out.notes = notes;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, out };
}

/* sertakan ringkasan pembayaran pada invoice */
function serializeInvoice(i) {
  const pays = Array.isArray(i.payments) ? i.payments : [];
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total = Number(i.total) || 0;
  return Object.assign({}, i, { payments: pays, paid: paid,
    sisa: Math.max(0, total - paid), lunas: total > 0 && paid >= total });
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
        const ip = req.socket.remoteAddress || '-';
        const failKey = uname + '|' + ip;
        const rec = loginFails.get(failKey);
        if (rec && rec.count >= LOGIN_MAX_FAIL && Date.now() - rec.last < LOGIN_LOCK_MS) {
          const sisaDetik = Math.ceil((LOGIN_LOCK_MS - (Date.now() - rec.last)) / 1000);
          return fail(res, 429, 'Terlalu banyak percobaan gagal. Coba lagi dalam ' + sisaDetik + ' detik.');
        }
        const u = data.users.find((x) => x.username.toLowerCase() === uname);
        if (!u || !verifyPassword(pw, u.salt, u.passHash)) {
          const c = ((rec && rec.count) || 0) + 1;
          loginFails.set(failKey, { count: c, last: Date.now() });
          if (c >= LOGIN_MAX_FAIL) logAct(null, 'login-terkunci', 'Username "' + uname + '" dikunci ' + LOGIN_MAX_FAIL + 'x gagal');
          return fail(res, 401, 'Username atau password salah');
        }
        loginFails.delete(failKey);
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
      if (seg[1] === 'change-password' && m === 'POST') {
        const b = await readBody(req);
        const oldPw = String(b.oldPassword || ''), newPw = String(b.newPassword || '');
        if (!verifyPassword(oldPw, me0.salt, me0.passHash)) {
          return fail(res, 400, 'Password lama salah', { oldPassword: 'Password lama salah' });
        }
        if (newPw.length < 5) return fail(res, 400, 'Password baru terlalu pendek', { newPassword: 'Minimal 5 karakter' });
        const { salt, hash } = hashPassword(newPw);
        me0.salt = salt; me0.passHash = hash;
        db.save();
        logAct(me0, 'password-ubah', 'User mengganti password sendiri');
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
        if (v.out.komisiPersen !== undefined) target.komisiPersen = v.out.komisiPersen;
        if (v.out.targetBulanan !== undefined) target.targetBulanan = v.out.targetBulanan;
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

    /* ---------- /api/customers ---------- */
    if (seg[0] === 'customers') {
      const canCust = me.role === 'admin' || me.role === 'owner' || me.role === 'sales';
      if (!canCust) return fail(res, 403, 'Tidak diizinkan mengakses data pelanggan');
      if (!data.customers) data.customers = [];

      if (m === 'GET' && !seg[1]) {
        let list = [...data.customers].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const q = (url.searchParams.get('q') || '').toLowerCase().trim();
        if (q) list = list.filter((c) => [c.name, c.phone, c.address].join(' ').toLowerCase().includes(q));
        return json(res, 200, list.map((c) => {
          const invs = data.invoices.filter((i) => i.customerId === c.id);
          return Object.assign({}, c, {
            totalTransaksi: invs.length,
            omzet: invs.reduce((s, i) => s + (Number(i.total) || 0), 0)
          });
        }));
      }

      if (m === 'POST' && !seg[1]) {
        const b = await readBody(req);
        const v = validateCustomer(b);
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        const c = Object.assign({ id: db.nextId('customer', 'cust'), createdAt: new Date().toISOString() }, v.out);
        data.customers.push(c); db.save();
        logAct(me, 'pelanggan-tambah', c.name);
        return json(res, 201, c);
      }

      const cIdx = data.customers.findIndex((x) => x.id === seg[1]);
      if (cIdx < 0) return fail(res, 404, 'Pelanggan tidak ditemukan');
      const cust = data.customers[cIdx];

      if (m === 'PUT') {
        const b = await readBody(req);
        const v = validateCustomer(b);
        if (!v.ok) return fail(res, 400, 'Validasi gagal', v.errors);
        Object.assign(cust, v.out); db.save();
        logAct(me, 'pelanggan-ubah', cust.name);
        return json(res, 200, cust);
      }

      if (m === 'DELETE') {
        const used = data.invoices.some((i) => i.customerId === cust.id);
        if (used) return fail(res, 400, 'Pelanggan memiliki riwayat invoice dan tidak bisa dihapus');
        data.customers.splice(cIdx, 1); db.save();
        logAct(me, 'pelanggan-hapus', cust.name);
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
        const ar = url.searchParams.get('archived');
        if (ar === '1') list = list.filter((u2) => u2.archived);
        else if (ar !== 'all') list = list.filter((u2) => !u2.archived);
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
        ['name', 'brand', 'type', 'color', 'transmisi', 'nopol', 'notes', 'bpkbStart', 'noRangka', 'noMesin', 'pajakDue'].forEach((k) => {
          if (v.out[k] !== undefined && v.out[k] !== null) u[k] = v.out[k];
        });
        ['year', 'km', 'cc', 'purchaseCost', 'sellPrice', 'purchaseDate', 'bpkbDays'].forEach((k) => {
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
        if (typeof b.bpkbReady === 'boolean') {
          if (!u.bpkbDays) return fail(res, 400, 'Unit ini belum memiliki proses BPKB');
          if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
            return fail(res, 403, 'Tidak diizinkan mengubah status BPKB');
          }
          u.bpkbReady = b.bpkbReady;
          if (u.bpkbReady) u.bpkbReadyAt = isoDay(new Date());
          else delete u.bpkbReadyAt;
        }
        if (typeof b.archived === 'boolean') {
          if (me.role !== 'admin') return fail(res, 403, 'Hanya admin yang dapat mengarsipkan unit');
          u.archived = b.archived;
        }
        if (b.pajakDue !== undefined) {
          if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
            return fail(res, 403, 'Tidak diizinkan mengubah jatuh tempo pajak');
          }
          const pd = String(b.pajakDue || '').trim();
          if (pd === '') u.pajakDue = '';
          else if (/^\d{4}-\d{2}-\d{2}$/.test(pd) && !isNaN(new Date(pd).getTime())) u.pajakDue = pd;
          else return fail(res, 400, 'Tanggal pajak tidak valid', { pajakDue: 'Format tanggal tidak valid' });
        }
        if (b.docs && typeof b.docs === 'object') {
          if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
            return fail(res, 403, 'Tidak diizinkan mengubah kelengkapan dokumen');
          }
          if (!u.docs) u.docs = {};
          ['stnk', 'faktur', 'formA'].forEach((k) => {
            if (typeof b.docs[k] === 'boolean') u.docs[k] = b.docs[k];
          });
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

            /* ---------- duplikat & foto unit ---------- */
      if (seg[2] === 'duplicate' && m === 'POST') {
        if (!P.manageUnits) return fail(res, 403, 'Anda tidak memiliki izin menduplikasi unit');
        const nid = db.nextId('unit', 'unit');
        const cp = JSON.parse(JSON.stringify(u));
        cp.id = nid;
        cp.code = 'UM-' + String(parseInt(nid.split('-')[1], 10)).padStart(4, '0');
        cp.status = 'tersedia'; cp.archived = false;
        delete cp.invoiceId; delete cp.soldAt;
        cp.bpkbReady = false; delete cp.bpkbReadyAt;
        cp.photos = [];
        cp.nopol = '';
        cp.repairCosts = (u.repairCosts || []).map((c) => Object.assign({}, c, { id: db.nextId('cost', 'cost') }));
        cp.docCosts = (u.docCosts || []).map((c) => Object.assign({}, c, { id: db.nextId('cost', 'cost') }));
        cp.createdAt = new Date().toISOString();
        data.units.push(cp); db.save();
        logAct(me, 'unit-duplikat', cp.code + ' (dari ' + u.code + ')');
        return json(res, 201, serializeUnit(cp, me));
      }

      if (seg[2] === 'photos') {
        const canPhoto = me.role !== 'mekanik';
        if (!canPhoto) return fail(res, 403, 'Tidak diizinkan mengelola foto');

        if (m === 'POST' && !seg[3]) {
          const b = await readBody(req, 1600);
          const raw64 = String(b.data || '');
          const comma = raw64.indexOf(',');
          const buf = Buffer.from(comma >= 0 ? raw64.slice(comma + 1) : raw64, 'base64');
          if (!buf.length) return fail(res, 400, 'File foto kosong');
          if (buf.length > 1024 * 1024) return fail(res, 400, 'Ukuran foto maksimal 1 MB');
          let ext = '.jpg';
          const nm = String(b.filename || 'foto.jpg').toLowerCase();
          [['jpeg','.jpg'],['jpg','.jpg'],['png','.png'],['webp','.webp']].forEach(([k, v]) => {
            if (nm.endsWith('.' + k)) ext = v;
          });
          fs.mkdirSync(PHOTOS_DIR, { recursive: true });
          const fname = u.id + '-' + Date.now() + ext;
          fs.writeFileSync(path.join(PHOTOS_DIR, fname), buf);
          if (!Array.isArray(u.photos)) u.photos = [];
          const ph = { id: db.nextId('photo', 'ph'), url: '/photos/' + fname,
            name: String(b.filename || fname).slice(0, 120), addedAt: new Date().toISOString() };
          u.photos.push(ph); db.save();
          logAct(me, 'foto-upload', u.code + ' · ' + ph.name);
          return json(res, 201, { photo: ph, unit: serializeUnit(u, me) });
        }

        if (seg[3] === 'cover' && m === 'POST') {
          const b = await readBody(req);
          const i = (u.photos || []).findIndex((x) => x.id === b.photoId);
          if (i < 0) return fail(res, 404, 'Foto tidak ditemukan');
          const ph = u.photos.splice(i, 1)[0];
          u.photos.unshift(ph); db.save();
          return json(res, 200, serializeUnit(u, me));
        }

        if (seg[3] && m === 'DELETE') {
          const i = (u.photos || []).findIndex((x) => x.id === seg[3]);
          if (i < 0) return fail(res, 404, 'Foto tidak ditemukan');
          const ph = u.photos.splice(i, 1)[0];
          try {
            const base = path.basename(decodeURIComponent(ph.url || ''));
            if (base.startsWith(u.id + '-')) fs.unlinkSync(path.join(PHOTOS_DIR, base));
          } catch (e) {}
          db.save();
          logAct(me, 'foto-hapus', u.code);
          return json(res, 200, serializeUnit(u, me));
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
        return json(res, 200, list.map(serializeInvoice));
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
        /* pelanggan: pakai yang ada atau daftarkan otomatis */
        if (!Array.isArray(data.customers)) data.customers = [];
        let cust = null;
        if (b.customerId) cust = data.customers.find((c) => c.id === b.customerId);
        if (!cust && v.out.buyerName) {
          cust = data.customers.find((c) =>
            c.name.toLowerCase() === v.out.buyerName.toLowerCase() ||
            (v.out.buyerPhone && c.phone && c.phone === v.out.buyerPhone));
          if (!cust) {
            cust = { id: db.nextId('customer', 'cust'), name: v.out.buyerName,
              phone: v.out.buyerPhone || '', address: v.out.buyerAddress || '',
              notes: '', createdAt: now.toISOString() };
            data.customers.push(cust);
            logAct(me, 'pelanggan-tambah', '(otomatis dari invoice) ' + cust.name);
          }
        }

        /* DP / pembayaran pertama */
        const invTotal = sellPrice - discount;
        const dp = parseInt(String(b.dpAmount == null ? '' : b.dpAmount).replace(/[^0-9]/g, ''), 10) || 0;
        if (dp > 0 && dp > invTotal) {
          return fail(res, 400, 'DP melebihi total tagihan', { dpAmount: 'Maksimal Rp ' + invTotal.toLocaleString('id-ID') });
        }

        const id = db.nextId('inv', 'inv');
        const now = new Date();
        const inv = {
          id: id,
          number: 'INV/' + now.getFullYear() + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' +
            String(parseInt(id.split('-')[1], 10)).padStart(4, '0'),
          unitId: unit.id,
          customerId: cust ? cust.id : null,
          snapshot: { name: unit.name, brand: unit.brand, year: unit.year, cc: unit.cc, color: unit.color, nopol: unit.nopol },
          buyer: { name: v.out.buyerName, phone: v.out.buyerPhone || '', address: v.out.buyerAddress || '' },
          sellPrice: sellPrice, discount: discount, total: sellPrice - discount,
          paymentMethod: v.out.paymentMethod, date: v.out.date, note: v.out.note,
          createdBy: me.name || me.username, createdById: me.id, createdAt: now.toISOString(),
          payments: []
        };
        if (dp > 0) {
          inv.payments.push({ id: db.nextId('pay', 'pay'), date: v.out.date,
            amount: dp, method: v.out.paymentMethod, note: 'Uang muka (DP)' });
        }
        data.invoices.push(inv);
        unit.status = 'terjual'; unit.sellPrice = sellPrice;
        unit.invoiceId = inv.id; unit.soldAt = inv.date;
        db.save();
        logAct(me, 'invoice-buat', inv.number + ' · ' + unit.code + ' · Rp ' + inv.total.toLocaleString('id-ID'));
        return json(res, 201, { invoice: serializeInvoice(inv), unit: serializeUnit(unit, me) });
      }

      const invIdx = data.invoices.findIndex((x) => x.id === seg[1]);
      if (invIdx < 0) return fail(res, 404, 'Invoice tidak ditemukan');
      const inv = data.invoices[invIdx];

      /* ---------- pembayaran cicilan / DP ---------- */
      if (seg[2] === 'payments' || seg[2] === 'payment') {
        if (!(me.role === 'admin' || me.role === 'sales')) {
          return fail(res, 403, 'Hanya admin/sales yang dapat mengelola pembayaran');
        }
        if (!Array.isArray(inv.payments)) inv.payments = [];

        if (seg[3] && m === 'DELETE') {
          if (me.role !== 'admin' && me.role !== 'sales') {
            return fail(res, 403, 'Tidak diizinkan menghapus pembayaran');
          }
          const pi = inv.payments.findIndex((x) => x.id === seg[3]);
          if (pi < 0) return fail(res, 404, 'Pembayaran tidak ditemukan');
          const rem = inv.payments.splice(pi, 1)[0];
          db.save();
          logAct(me, 'bayar-hapus', inv.number + ' · Rp ' + Number(rem.amount).toLocaleString('id-ID'));
          return json(res, 200, { ok: true, invoice: serializeInvoice(inv) });
        }

        if (m === 'POST' && !seg[3]) {
          const b = await readBody(req);
          const date = String(b.date || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
            return fail(res, 400, 'Tanggal tidak valid', { date: 'Format tanggal tidak valid' });
          }
          const amt = parseInt(String(b.amount == null ? '' : b.amount).replace(/[^0-9]/g, ''), 10);
          if (isNaN(amt) || amt <= 0) return fail(res, 400, 'Nominal tidak valid', { amount: 'Harus angka > 0' });
          const method = String(b.method || inv.paymentMethod || 'tunai').toLowerCase();
          if (!PAY_METHODS.includes(method)) return fail(res, 400, 'Metode tidak valid', { method: 'Metode tidak dikenal' });
          const paidSoFar = inv.payments.reduce((s, x) => s + (Number(x.amount) || 0), 0);
          const sisa = Math.max(0, (inv.total || 0) - paidSoFar);
          if (amt > sisa) return fail(res, 400, 'Melebihi sisa tagihan',
            { amount: 'Sisa hanya Rp ' + sisa.toLocaleString('id-ID') });
          const pay = { id: db.nextId('pay', 'pay'), date: date, amount: amt,
            method: method, note: String(b.note || '').slice(0, 200) };
          inv.payments.push(pay); db.save();
          logAct(me, 'bayar-tambah', inv.number + ' · Rp ' + amt.toLocaleString('id-ID'));
          return json(res, 201, { payment: pay, invoice: serializeInvoice(inv) });
        }
        return fail(res, 405, 'Metode tidak didukung');
      }

      if (m === 'GET') {
        const unit = data.units.find((x) => x.id === inv.unitId);
        return json(res, 200, { invoice: serializeInvoice(inv), unit: unit ? serializeUnit(unit, me) : null });
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

      /* komisi & target per sales */
      if (seg[1] === 'commissions' && m === 'GET') {
        const month = url.searchParams.get('month') || isoMonth(new Date());
        const invs = data.invoices.filter((i) => (i.date || '').startsWith(month));
        const unitByInv = {};
        data.units.forEach((x) => { if (x.invoiceId) unitByInv[x.invoiceId] = x; });
        const agg = {};
        invs.forEach((i) => {
          let uu = data.users.find((x) => x.id === i.createdById);
          if (!uu) uu = data.users.find((x) => x.name === i.createdBy || x.username === i.createdBy);
          const key = uu ? uu.id : (i.createdBy || '-');
          const a = agg[key] = agg[key] || {
            userId: uu ? uu.id : null,
            name: uu ? uu.name : (i.createdBy || '(tidak dikenal)'),
            role: uu ? uu.role : '-',
            komisiPersen: uu ? (Number(uu.komisiPersen) || 0) : 0,
            target: uu ? (Number(uu.targetBulanan) || 0) : 0,
            count: 0, omzet: 0, laba: 0
          };
          a.count++;
          a.omzet += Number(i.total) || 0;
          const ux = unitByInv[i.id];
          if (ux) a.laba += calcTotals(ux).profit;
        });
        const rows = Object.values(agg);
        rows.forEach((a) => {
          a.komisi = Math.round(a.laba * a.komisiPersen) / 100;
          a.pct = a.target ? Math.round(a.omzet / a.target * 1000) / 10 : null;
        });
        rows.sort((x, y) => y.omzet - x.omzet);
        return json(res, 200, { month: month, rows: rows });
      }

      return fail(res, 404, 'Endpoint tidak ditemukan');
    }

    /* ---------- audit log ---------- */
    if (seg[0] === 'logs') {
      if (!(me.role === 'admin' || me.role === 'owner')) return fail(res, 403, 'Tidak diizinkan melihat log');
      const lim = Math.min(parseInt(url.searchParams.get('limit') || '80', 10) || 80, 300);
      const arr = [...(data.logs || [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, lim);
      return json(res, 200, arr);
    }

    /* ---------- export CSV (Excel-compatible) ---------- */
    if (seg[0] === 'export') {
      if (!P.viewReports) return fail(res, 403, 'Tidak diizinkan mengekspor laporan');
      const csvEsc = (v) => { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const sendCsv = (name, rows) => {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
        res.end('\uFEFF' + rows.map((r) => r.map(csvEsc).join(';')).join('\r\n'));
      };

            if ((seg[1] || '').startsWith('units') && m === 'GET') {
        const rows = [['Kode', 'Nama', 'Merek', 'Tipe', 'Tahun', 'KM', 'CC', 'Warna', 'Nopol', 'No Rangka', 'No Mesin',
          'Status', 'BPKB Due', 'BPKB Diambil', 'Pajak Due', 'Pembelian', 'Perbaikan', 'Dokumen', 'Total Modal', 'Harga Jual', 'Laba/Rugi']];
        [...data.units].sort((a, b) => a.code.localeCompare(b.code)).forEach((u) => {
          const t = calcTotals(u); const bp = calcBpkb(u);
          rows.push([u.code, u.name, u.brand, u.type, u.year, u.km, u.cc, u.color || '', u.nopol || '',
            u.noRangka || '', u.noMesin || '', u.status,
            bp ? bp.due : '', bp && bp.readyAt ? bp.readyAt : '', u.pajakDue || '',
            t.purchase, t.repair, t.doc, t.modal, t.sellPrice, t.profit]);
        });
        sendCsv('stok-unit.csv', rows); return;
      }

      if ((seg[1] || '').startsWith('invoices') && m === 'GET') {
        const rows = [['No Invoice', 'Tanggal', 'Pelanggan', 'Unit', 'Nopol', 'Harga', 'Diskon', 'Total', 'Dibayar', 'Sisa', 'Lunas', 'Metode', 'Oleh']];
        [...data.invoices].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((i) => {
          const s = serializeInvoice(i);
          rows.push([s.number, s.date, s.buyer ? s.buyer.name : '', s.snapshot ? s.snapshot.name : '',
            s.snapshot ? s.snapshot.nopol : '', s.sellPrice, s.discount, s.total,
            s.paid, s.sisa, s.lunas ? 'Ya' : 'Belum', s.paymentMethod, s.createdBy]);
        });
        sendCsv('invoice.csv', rows); return;
      }

      if ((seg[1] || '').startsWith('profit') && m === 'GET') {
        const from = url.searchParams.get('from'), to = url.searchParams.get('to');
        let soldList = data.units.filter((x) => x.status === 'terjual');
        if (from) soldList = soldList.filter((x) => (x.soldAt || '') >= from);
        if (to) soldList = soldList.filter((x) => (x.soldAt || '') <= to);
        const rows = [['Kode', 'Motor', 'Terjual', 'Pembelian', 'Perbaikan', 'Dokumen', 'Total Modal', 'Harga Jual', 'Laba/Rugi', 'Margin %']];
        let totProfit = 0, totRev = 0;
        soldList.sort((a, b) => (a.soldAt || '').localeCompare(b.soldAt || '')).forEach((x) => {
          const t = calcTotals(x);
          totProfit += t.profit; totRev += t.sellPrice;
          rows.push([x.code, x.name, x.soldAt || '', t.purchase, t.repair, t.doc, t.modal, t.sellPrice, t.profit, t.margin]);
        });
        rows.push(['TOTAL', '', '', '', '', '', '', totRev, totProfit, '']);
        sendCsv('laba-rugi.csv', rows); return;
      }
      return fail(res, 404, 'Jenis ekspor tidak dikenal');
    }

    return fail(res, 404, 'Endpoint tidak ditemukan');
  } catch (err) {
    console.error('[api]', req.method, url.pathname, err);
    if (!res.headersSent) return fail(res, 500, (err && err.message) || 'Internal server error');
  }
}

module.exports = { handleApi };