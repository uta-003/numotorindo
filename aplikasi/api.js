/* ============================================================
   NuMotorindo Finance — REST API
   /api/auth/*            login, logout, info sesi
   /api/settings          profil showroom (untuk header invoice)
   /api/stats             ringkasan dashboard
   /api/units             CRUD unit motor + biaya perbaikan/dokumen
   /api/units/:id/sell    catat penjualan → nomor invoice otomatis
   /api/report/laba-rugi  laporan laba rugi per periode
   /api/invoices          daftar & detail invoice
============================================================ */
'use strict';

const crypto = require('crypto');
const db = require('./db');

const PAYMENTS = ['cash', 'kredit'];
const OPEX_CATS = ['gaji', 'sewa', 'listrik-air', 'marketing', 'lainnya'];

/* pembatas percobaan login gagal: 5x dalam 10 menit → kunci 15 menit */
const loginFails = {};

/* ---------- Helper respons & CORS ---------- */
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (ch) => {
      size += ch.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('Payload terlalu besar (maks 2MB)'));
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

/* ---------- Autentikasi ---------- */
function getSession(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const data = db.load();
  const sess = data.sessions[m[1]];
  return sess ? Object.assign({ token: m[1] }, sess) : null;
}

function requireAuth(req, res) {
  const sess = getSession(req);
  if (!sess) {
    json(res, 401, { message: 'Sesi tidak valid — silakan login ulang' });
    return null;
  }
  return sess;
}

function verifyPassword(user, password) {
  try {
    const test = crypto.scryptSync(String(password), user.salt, 64);
    const real = Buffer.from(user.hash, 'hex');
    return test.length === real.length && crypto.timingSafeEqual(test, real);
  } catch (e) { return false; }
}

/* ---------- Audit log (maks 200 entri terakhir) ---------- */
function logAudit(data, sess, action, detail) {
  data.auditLog.unshift({
    at: new Date().toISOString(),
    username: sess ? sess.username : '-',
    name: sess ? sess.name : '-',
    action: String(action).slice(0, 60),
    detail: String(detail || '').slice(0, 200)
  });
  if (data.auditLog.length > 200) data.auditLog.length = 200;
}

/* ---------- Kalkulasi keuangan per unit ---------- */
function sumCost(list) {
  return (Array.isArray(list) ? list : []).reduce((a, c) => a + (Number(c.cost) || 0), 0);
}

function totalsOf(unit) {
  const purchase = unit.purchase ? (Number(unit.purchase.price) || 0) : 0;
  const repair = sumCost(unit.repairs);
  const doc = sumCost(unit.documents);
  const modal = purchase + repair + doc;
  const price = unit.sale ? (Number(unit.sale.price) || 0) : null;
  return { purchase, repair, doc, modal, price, profit: price == null ? null : price - modal };
}

/* ---------- Validator umum ---------- */
function str(v) { return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim(); }

function toInt(v) {
  if (v == null || v === '') return NaN;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function isDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(new Date(v + 'T00:00:00').getTime());
}

/* ---------- Validator: unit motor ---------- */
function validateUnit(raw, partial) {
  const errors = {};
  const out = {};
  const maxY = new Date().getFullYear() + 1;

  const name = str(raw.name);
  if (name) { if (name.length < 3) errors.name = 'Nama minimal 3 karakter'; else out.name = name; }
  else if (!partial) errors.name = 'Nama motor wajib diisi';

  const brand = str(raw.brand);
  if (brand) out.brand = brand;
  else if (!partial) errors.brand = 'Merek wajib diisi';

  if (raw.year != null && raw.year !== '') {
    const year = parseInt(raw.year, 10);
    if (isNaN(year) || year < 1990 || year > maxY) errors.year = 'Tahun harus 1990–' + maxY;
    else out.year = year;
  } else if (!partial) errors.year = 'Tahun wajib diisi';

  if (raw.km != null && raw.km !== '') {
    const km = toInt(raw.km);
    if (isNaN(km) || km < 0) errors.km = 'Kilometer harus angka ≥ 0';
    else out.km = km;
  } else if (!partial) errors.km = 'Kilometer wajib diisi';

  ['plate', 'color'].forEach((k) => {
    const v = str(raw[k]);
    if (v) out[k] = v.slice(0, 40); else if (!partial && k === 'plate') out.plate = '';
  });

  /* jatuh tempo pajak berikutnya (opsional; string kosong = dihapus) */
  if ('taxDueDate' in raw) {
    if (raw.taxDueDate && isDate(raw.taxDueDate)) out.taxDueDate = raw.taxDueDate;
    else if (!raw.taxDueDate) out.taxDueDate = '';
    else errors.taxDueDate = 'Format tanggal pajak harus YYYY-MM-DD';
  } else if (!partial) out.taxDueDate = '';

  /* Pembelian */
  const p = raw.purchase || {};
  if (p.price != null && p.price !== '') {
    const price = toInt(p.price);
    if (isNaN(price) || price <= 0) errors.purchasePrice = 'Harga pembelian harus angka > 0';
    else out.purchasePrice = price;
  } else if (!partial) errors.purchasePrice = 'Harga pembelian wajib diisi';

  if (p.date) {
    if (!isDate(p.date)) errors.purchaseDate = 'Format tanggal beli harus YYYY-MM-DD';
    else out.purchaseDate = p.date;
  } else if (!partial) errors.purchaseDate = 'Tanggal pembelian wajib diisi';

  const seller = str(p.seller);
  if (seller) out.seller = seller.slice(0, 80); else if (!partial) out.seller = '';
  const note = str(p.note);
  if (note) out.note = note.slice(0, 300); else if (!partial) out.note = '';

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value: out };
}

/* ---------- Validator: biaya perbaikan / dokumen ---------- */
function validateCost(raw) {
  const errors = {};
  const value = {};

  const desc = str(raw.desc);
  if (desc) { if (desc.length < 3) errors.desc = 'Keterangan minimal 3 karakter'; else value.desc = desc.slice(0, 120); }
  else errors.desc = 'Keterangan biaya wajib diisi';

  const cost = toInt(raw.cost);
  if (isNaN(cost) || cost <= 0) errors.cost = 'Jumlah biaya harus angka > 0';
  else value.cost = cost;

  if (raw.date) {
    if (!isDate(raw.date)) errors.date = 'Format tanggal harus YYYY-MM-DD';
    else value.date = raw.date;
  } else value.date = new Date().toISOString().slice(0, 10);

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/* ---------- Validator: penjualan ---------- */
function validateSale(raw, partial) {
  const errors = {};
  const value = {};

  if (raw.price != null && raw.price !== '') {
    const price = toInt(raw.price);
    if (isNaN(price) || price <= 0) errors.price = 'Harga jual harus angka > 0';
    else value.price = price;
  } else if (!partial) errors.price = 'Harga jual wajib diisi';

  if (raw.date) {
    if (!isDate(raw.date)) errors.date = 'Format tanggal jual harus YYYY-MM-DD';
    else value.date = raw.date;
  } else if (!partial) value.date = new Date().toISOString().slice(0, 10);

  const buyerName = str(raw.buyerName);
  if (buyerName) { if (buyerName.length < 3) errors.buyerName = 'Nama pembeli minimal 3 karakter'; else value.buyerName = buyerName.slice(0, 80); }
  else if (!partial) errors.buyerName = 'Nama pembeli wajib diisi';

  if (raw.payment != null && raw.payment !== '') {
    if (PAYMENTS.indexOf(raw.payment) === -1) errors.payment = 'Metode harus cash atau kredit';
    else value.payment = raw.payment;
  } else if (!partial) value.payment = 'cash';

  if (raw.dp != null && raw.dp !== '') {
    const dp = toInt(raw.dp);
    if (isNaN(dp) || dp < 0) errors.dp = 'DP harus angka ≥ 0';
    else value.dp = dp;
  } else if (!partial) value.dp = null;

  ['buyerPhone', 'buyerAddress', 'note'].forEach((k) => {
    const v = str(raw[k]);
    if (v) value[k] = v.slice(0, 200); else if (!partial) value[k] = '';
  });

  /* opsional: rincian kredit */
  const leasing = str(raw.leasing);
  if (leasing) value.leasing = leasing.slice(0, 60); else if (!partial) value.leasing = '';
  if (raw.tenor != null && raw.tenor !== '') {
    const tenor = parseInt(raw.tenor, 10);
    if (isNaN(tenor) || tenor < 0) errors.tenor = 'Tenor harus angka ≥ 0';
    else value.tenor = tenor || null;
  } else if (!partial) value.tenor = null;
  if (raw.installment != null && raw.installment !== '') {
    const inst = toInt(raw.installment);
    if (isNaN(inst) || inst < 0) errors.installment = 'Angsuran harus angka ≥ 0';
    else value.installment = inst || null;
  } else if (!partial) value.installment = null;

  /* jumlah angsuran yang sudah dibayar (untuk kolektibilitas) */
  if (raw.installmentsPaid != null && raw.installmentsPaid !== '') {
    const paid = parseInt(raw.installmentsPaid, 10);
    if (isNaN(paid) || paid < 0) errors.installmentsPaid = 'Angsuran dibayar harus angka ≥ 0';
    else value.installmentsPaid = paid;
  } else if (!partial) value.installmentsPaid = 0;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/* ---------- Validator: pengguna ---------- */
function validateUser(raw, partial) {
  const errors = {};
  const out = {};

  const username = str(raw.username).toLowerCase();
  if (username) {
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) errors.username = 'Username 3–30 karakter (huruf kecil, angka, titik, garis bawah)';
    else out.username = username;
  } else if (!partial) errors.username = 'Username wajib diisi';

  const name = str(raw.name);
  if (name) { if (name.length < 3) errors.name = 'Nama minimal 3 karakter'; else out.name = name.slice(0, 80); }
  else if (!partial) errors.name = 'Nama wajib diisi';

  const role = str(raw.role);
  if (role) {
    if (role !== 'admin' && role !== 'staff') errors.role = 'Peran harus admin atau staff';
    else out.role = role;
  } else if (!partial) errors.role = 'Peran wajib dipilih';

  if (!partial) {
    const pw = raw.password == null ? '' : String(raw.password);
    if (pw.length < 6) errors.password = 'Password minimal 6 karakter';
    else {
      const salt = crypto.randomBytes(16).toString('hex');
      out.salt = salt;
      out.hash = crypto.scryptSync(pw, salt, 64).toString('hex');
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: out };
}

/* ---------- Validator: biaya operasional ---------- */
function validateOpex(raw) {
  const errors = {};
  const value = {};

  const cat = str(raw.category);
  if (OPEX_CATS.indexOf(cat) === -1) errors.category = 'Kategori harus salah satu dari: ' + OPEX_CATS.join(', ');
  else value.category = cat;

  const desc = str(raw.desc);
  if (desc.length < 3) errors.desc = 'Keterangan minimal 3 karakter';
  else value.desc = desc.slice(0, 120);

  const amt = toInt(raw.amount);
  if (isNaN(amt) || amt <= 0) errors.amount = 'Jumlah harus angka > 0';
  else value.amount = amt;

  if (raw.date) {
    if (!isDate(raw.date)) errors.date = 'Format tanggal harus YYYY-MM-DD';
    else value.date = raw.date;
  } else value.date = new Date().toISOString().slice(0, 10);

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/* ============================================================
   Router API
============================================================ */
function handleApi(req, res, url) {
  const method = req.method === 'OPTIONS' ? 'OPTIONS' : req.method;
  if (method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  const seg = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const data = db.load();

  /* ---------- /api/auth ---------- */
  if (seg[1] === 'auth') {
    /* POST /api/auth/login */
    if (seg[2] === 'login' && method === 'POST') {
      return readBody(req).then((body) => {
        const username = str(body.username).toLowerCase();
        const password = body.password == null ? '' : String(body.password);
        if (!username || !password) return json(res, 400, { message: 'Username dan password wajib diisi' });

        /* rate-limit: 5 kegagalan dalam 10 menit → kunci 15 menit */
        const failKey = (req.socket.remoteAddress || '?') + '|' + username;
        const nowMs = Date.now();
        const lf = loginFails[failKey];
        if (lf && lf.blockedUntil && lf.blockedUntil > nowMs) {
          const sisa = Math.ceil((lf.blockedUntil - nowMs) / 60000);
          return json(res, 429, { message: 'Terlalu banyak percobaan gagal — coba lagi dalam ' + sisa + ' menit' });
        }

        const user = data.users.find((u) => u.username.toLowerCase() === username);
        if (!user || !verifyPassword(user, password)) {
          const f = loginFails[failKey] || (loginFails[failKey] = { count: 0, firstAt: nowMs });
          if (nowMs - f.firstAt > 10 * 60000) { f.count = 0; f.firstAt = nowMs; }
          f.count += 1;
          if (f.count >= 5) f.blockedUntil = nowMs + 15 * 60000;
          return json(res, 401, { message: 'Username atau password salah' });
        }
        delete loginFails[failKey];

        /* buang sesi kadaluarsa (>7 hari) sekalian merapikan */
        const now = Date.now();
        Object.keys(data.sessions).forEach((t) => {
          if (now - new Date(data.sessions[t].createdAt).getTime() > 7 * 864e5) delete data.sessions[t];
        });

        const token = crypto.randomBytes(24).toString('hex');
        data.sessions[token] = {
          userId: user.id, username: user.username, name: user.name,
          role: user.role, createdAt: new Date().toISOString()
        };
        logAudit(data, { username: user.username, name: user.name }, 'login', 'Masuk ke aplikasi');
        db.save();
        return json(res, 200, { token, user: { username: user.username, name: user.name, role: user.role } });
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    const sess = requireAuth(req, res);
    if (!sess) return;

    /* POST /api/auth/logout */
    if (seg[2] === 'logout' && method === 'POST') {
      delete data.sessions[sess.token];
      db.save();
      return json(res, 200, { message: 'Logout berhasil' });
    }

    /* POST /api/auth/change-password — ganti password sendiri */
    if (seg[2] === 'change-password' && method === 'POST') {
      return readBody(req).then((body) => {
        const user = data.users.find((u) => u.id === sess.userId);
        if (!user) return json(res, 404, { message: 'Pengguna tidak ditemukan' });
        if (!verifyPassword(user, String(body.oldPassword == null ? '' : body.oldPassword))) {
          return json(res, 400, { message: 'Password lama salah' });
        }
        const np = String(body.newPassword == null ? '' : body.newPassword);
        if (np.length < 6) return json(res, 400, { message: 'Password baru minimal 6 karakter' });
        const salt = crypto.randomBytes(16).toString('hex');
        user.salt = salt;
        user.hash = crypto.scryptSync(np, salt, 64).toString('hex');
        /* putuskan sesi lain milik pengguna ini */
        Object.keys(data.sessions).forEach((t) => {
          if (data.sessions[t].userId === user.id && t !== sess.token) delete data.sessions[t];
        });
        db.save();
        return json(res, 200, { message: 'Password berhasil diganti' });
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* GET /api/auth/me */
    if (seg[2] === 'me' && method === 'GET') {
      return json(res, 200, { username: sess.username, name: sess.name, role: sess.role });
    }
  }

  /* ---------- /api/users — khusus admin ---------- */
  if (seg[1] === 'users') {
    const sess = requireAuth(req, res);
    if (!sess) return;
    if (sess.role !== 'admin') return json(res, 403, { message: 'Halaman pengguna khusus admin' });

    const uid = seg[2];
    const adminCount = () => data.users.filter((u) => u.role === 'admin').length;

    /* GET /api/users */
    if (!uid && method === 'GET') {
      return json(res, 200, data.users.map((u) => ({
        id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt
      })));
    }

    /* POST /api/users */
    if (!uid && method === 'POST') {
      return readBody(req).then((body) => {
        const v = validateUser(body, false);
        if (!v.ok) return json(res, 400, { message: 'Data pengguna tidak valid', errors: v.errors });
        if (data.users.some((u) => u.username.toLowerCase() === v.value.username)) {
          return json(res, 409, { message: 'Username "' + v.value.username + '" sudah dipakai' });
        }
        const nu = Object.assign({ id: db.nextId('user') }, v.value, { createdAt: new Date().toISOString() });
        data.users.push(nu);
        db.save();
        return json(res, 201, { id: nu.id, username: nu.username, name: nu.name, role: nu.role });
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    const target = data.users.find((u) => u.id === uid);
    if (uid && !target) return json(res, 404, { message: 'Pengguna "' + uid + '" tidak ditemukan' });

    /* PATCH /api/users/:id — edit nama/peran/reset password */
    if (uid && method === 'PATCH') {
      return readBody(req).then((body) => {
        const v = validateUser(Object.assign({}, target, body), true);
        if (!v.ok) return json(res, 400, { message: 'Data tidak valid', errors: v.errors });
        if (target.role === 'admin' && v.value.role === 'staff' && adminCount() <= 1) {
          return json(res, 409, { message: 'Minimal harus ada satu admin' });
        }
        target.name = v.value.name;
        target.role = v.value.role;
        if (body.newPassword != null && String(body.newPassword) !== '') {
          if (String(body.newPassword).length < 6) return json(res, 400, { message: 'Password minimal 6 karakter' });
          const salt = crypto.randomBytes(16).toString('hex');
          target.salt = salt;
          target.hash = crypto.scryptSync(String(body.newPassword), salt, 64).toString('hex');
        }
        db.save();
        return json(res, 200, { id: target.id, username: target.username, name: target.name, role: target.role });
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* DELETE /api/users/:id */
    if (uid && method === 'DELETE') {
      if (target.id === sess.userId) return json(res, 409, { message: 'Tidak bisa menghapus akun sendiri' });
      if (target.role === 'admin' && adminCount() <= 1) return json(res, 409, { message: 'Minimal harus ada satu admin' });
      data.users.splice(data.users.indexOf(target), 1);
      Object.keys(data.sessions).forEach((t) => {
        if (data.sessions[t].userId === target.id) delete data.sessions[t];
      });
      db.save();
      return json(res, 200, { message: 'Pengguna "@' + target.username + '" dihapus' });
    }
  }

  /* ---------- /api/public — tanpa autentikasi ---------- */
  if (seg[1] === 'public' && seg[2] === 'hint' && method === 'GET') {
    return json(res, 200, { showHint: !!data.settings.showLoginHint });
  }

  /* ---------- /api/settings ---------- */
  if (seg[1] === 'settings' && !seg[2]) {
    const sess = requireAuth(req, res);
    if (!sess) return;

    if (method === 'GET') return json(res, 200, data.settings);

    if (method === 'PUT' || method === 'PATCH') {
      if (sess.role !== 'admin') return json(res, 403, { message: 'Hanya admin yang dapat mengubah pengaturan showroom' });
      return readBody(req).then((body) => {
        const errors = {};
        const name = str(body.name);
        if (name.length < 3) errors.name = 'Nama showroom minimal 3 karakter';
        ['address', 'phone', 'email', 'footerNote'].forEach((k) => {
          data.settings[k] = str(body[k]).slice(0, 200);
        });
        data.settings.showLoginHint = !!body.showLoginHint;
        if (Object.keys(errors).length) return json(res, 400, { message: 'Data tidak valid', errors });
        data.settings.name = name.slice(0, 100);
        logAudit(data, sess, 'settings', 'Mengubah pengaturan showroom');
        db.save();
        return json(res, 200, data.settings);
      }).catch((err) => json(res, 400, { message: err.message }));
    }
  }

  /* ---------- /api/stats (dashboard) ---------- */
  if (seg[1] === 'stats' && !seg[2] && method === 'GET') {
    if (!requireAuth(req, res)) return;

    const units = data.units;
    const sold = units.filter((u) => u.sale);
    const available = units.filter((u) => !u.sale);

    let revenue = 0, modalSold = 0, repairSold = 0, docSold = 0, purchaseSold = 0;
    sold.forEach((u) => {
      const t = totalsOf(u);
      revenue += t.price; modalSold += t.modal;
      purchaseSold += t.purchase; repairSold += t.repair; docSold += t.doc;
    });
    const investedAvailable = available.reduce((a, u) => a + totalsOf(u).modal, 0);

    /* stok mengendap: unit tersedia berdasarkan umur sejak tanggal beli */
    const DAY = 864e5;
    const nowT = Date.now();
    const aging = available.map((u) => ({
      id: u.id, code: u.code, name: u.name, plate: u.plate || '',
      days: Math.floor((nowT - new Date(u.purchase.date + 'T00:00:00').getTime()) / DAY),
      modal: totalsOf(u).modal
    })).filter((a) => a.days >= 30).sort((a, b) => b.days - a.days);

    /* biaya operasional: total & bulan berjalan */
    const curMonth = new Date().toISOString().slice(0, 7);
    const opexTotal = data.opex.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const opexMonth = data.opex
      .filter((o) => String(o.date).slice(0, 7) === curMonth)
      .reduce((a, o) => a + (Number(o.amount) || 0), 0);

    /* pengingat pajak/STNK: unit tersedia dengan jatuh tempo ≤ 30 hari */
    const taxDue = available.filter((u) => u.taxDueDate)
      .map((u) => ({
        id: u.id, code: u.code, name: u.name, plate: u.plate || '',
        dueDate: u.taxDueDate,
        days: Math.ceil((new Date(u.taxDueDate + 'T00:00:00').getTime() - nowT) / DAY)
      }))
      .filter((x) => x.days <= 30)
      .sort((a, b) => a.days - b.days);

    /* kolektibilitas angsuran penjualan kredit */
    const credits = sold.filter((u) => u.sale.payment === 'kredit')
      .map((u) => {
        const s = u.sale;
        const monthsElapsed = Math.max(0,
          Math.floor((nowT - new Date(s.date + 'T00:00:00').getTime()) / (30 * DAY)));
        const paid = Number(s.installmentsPaid) || 0;
        const tenor = Number(s.tenor) || 0;
        const installment = Number(s.installment) || 0;
        return {
          id: u.id, code: u.code, name: u.name, buyerName: s.buyerName,
          leasing: s.leasing || '', paid, tenor, installment,
          remaining: Math.max(0, tenor - paid) * installment,
          monthsElapsed, arrears: Math.max(0, monthsElapsed - paid)
        };
      });

    /* deret 6 bulan terakhir berdasarkan tanggal jual */
    const monthly = [];
    const base = new Date();
    base.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthly.push({ key, label: d.toLocaleDateString('id-ID', { month: 'short' }), revenue: 0, cost: 0, profit: 0 });
    }
    const byMonth = {};
    monthly.forEach((m) => { byMonth[m.key] = m; });
    sold.forEach((u) => {
      const key = String(u.sale.date).slice(0, 7);
      if (!byMonth[key]) return;
      const t = totalsOf(u);
      byMonth[key].revenue += t.price; byMonth[key].cost += t.modal; byMonth[key].profit += t.profit;
    });

    const recentInvoices = sold.slice().sort((a, b) => b.sale.date.localeCompare(a.sale.date)).slice(0, 5)
      .map((u) => ({ no: u.sale.invoiceNo, date: u.sale.date, name: u.name, code: u.code, price: u.sale.price }));

    return json(res, 200, {
      totalUnits: units.length,
      availableCount: available.length,
      soldCount: sold.length,
      investedAvailable,
      revenue, modalSold, purchaseSold, repairSold, docSold,
      netProfit: revenue - modalSold,
      aging, agingModal: aging.reduce((a, x) => a + x.modal, 0),
      opexTotal, opexMonth,
      netProfitAfterOpex: revenue - modalSold - opexTotal,
      taxDue, credits,
      monthly, recentInvoices
    });
  }

    /* ---------- /api/units ---------- */
  if (seg[1] === 'units') {
    const sess = requireAuth(req, res);
    if (!sess) return;

    const id = seg[2];

    /* GET /api/units?q=&status=&brand= */
    if (!id && method === 'GET') {
      let list = data.units.slice();
      const q = str(url.searchParams.get('q')).toLowerCase();
      const status = url.searchParams.get('status');
      const brand = url.searchParams.get('brand');
      if (q) {
        list = list.filter((u) =>
          [u.code, u.name, u.brand, u.plate, u.color].join(' ').toLowerCase().indexOf(q) !== -1);
      }
      if (status === 'tersedia' || status === 'terjual') list = list.filter((u) => u.status === status);
      if (brand) list = list.filter((u) => u.brand.toLowerCase() === brand.toLowerCase());
      list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(res, 200, list.map((u) => Object.assign({}, u, { _totals: totalsOf(u) })));
    }

    /* POST /api/units */
    if (!id && method === 'POST') {
      return readBody(req).then((body) => {
        const v = validateUnit(body, false);
        if (!v.ok) return json(res, 400, { message: 'Data unit tidak valid', errors: v.errors });

        /* plat nomor unik antar unit */
        if (v.value.plate) {
          const pl = String(v.value.plate).toUpperCase();
          if (data.units.some((x) => (x.plate || '').toUpperCase() === pl)) {
            return json(res, 409, { message: 'Plat nomor "' + v.value.plate + '" sudah terdaftar di unit lain' });
          }
        }

        /* foto opsional berupa data URL gambar */
        let photo = '';
        if (body.photo) {
          if (typeof body.photo !== 'string' ||
              !/^data:image\/(png|jpe?g|webp);base64,/.test(body.photo) || body.photo.length > 900000) {
            return json(res, 400, { message: 'Foto harus data URL gambar (png/jpg/webp, maks ±650KB)' });
          }
          photo = body.photo;
        }

        const uid = db.nextId('unit');
        const num = parseInt(uid.replace('unit-', ''), 10) || data.units.length + 1;
        const unit = {
          id: uid,
          code: 'MB-' + String(num).padStart(4, '0'),
          name: v.value.name, brand: v.value.brand, year: v.value.year, km: v.value.km,
          plate: v.value.plate || '', color: v.value.color || '',
          taxDueDate: v.value.taxDueDate || '', photo,
          status: 'tersedia',
          purchase: { price: v.value.purchasePrice, date: v.value.purchaseDate, seller: v.value.seller, note: v.value.note },
          repairs: [], documents: [], sale: null,
          createdAt: new Date().toISOString()
        };
        data.units.push(unit);
        logAudit(data, sess, 'unit-tambah', unit.code + ' — ' + unit.name);
        db.save();
        return json(res, 201, Object.assign({}, unit, { _totals: totalsOf(unit) }));
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* /api/units/:id */
    const idx = data.units.findIndex((u) => u.id === id);
    if (idx === -1) return json(res, 404, { message: 'Unit "' + id + '" tidak ditemukan' });
    const unit = data.units[idx];
    const sub = seg[3]; // 'costs' | 'sell' | 'sale' | undefined

    if (!sub && method === 'GET') {
      return json(res, 200, Object.assign({}, unit, { _totals: totalsOf(unit) }));
    }

    /* PUT/PATCH /api/units/:id — ubah data & pembelian */
    if (!sub && (method === 'PUT' || method === 'PATCH')) {
      const partial = method === 'PATCH';
      return readBody(req).then((body) => {
        const merged = partial ? Object.assign({}, unit, body,
          { purchase: Object.assign({}, unit.purchase, body.purchase || {}) }) : body;
        const v = validateUnit(merged, partial);
        if (!v.ok) return json(res, 400, { message: 'Data unit tidak valid', errors: v.errors });
        const val = v.value;
        ['name', 'brand', 'year', 'km', 'plate', 'color'].forEach((k) => {
          if (val[k] != null) unit[k] = val[k];
        });
        if (val.taxDueDate !== undefined) unit.taxDueDate = val.taxDueDate;
        if (body.photo !== undefined) {
          if (body.photo && (typeof body.photo !== 'string' ||
              !/^data:image\/(png|jpe?g|webp);base64,/.test(body.photo) || body.photo.length > 900000)) {
            return json(res, 400, { message: 'Foto harus data URL gambar (maks ±650KB)' });
          }
          unit.photo = body.photo || '';
        }
        /* plat unik antar unit (kecuali dirinya sendiri) */
        const candPlate = val.plate != null ? String(val.plate) : String(unit.plate || '');
        if (candPlate && data.units.some((x) => x.id !== unit.id && (x.plate || '').toUpperCase() === candPlate.toUpperCase())) {
          return json(res, 409, { message: 'Plat nomor "' + candPlate + '" sudah terdaftar di unit lain' });
        }
        if (val.purchasePrice != null) unit.purchase.price = val.purchasePrice;
        if (val.purchaseDate != null) unit.purchase.date = val.purchaseDate;
        if (val.seller != null) unit.purchase.seller = val.seller;
        if (val.note != null) unit.purchase.note = val.note;
        logAudit(data, sess, 'unit-edit', unit.code + ' — data/pembelian diperbarui');
        db.save();
        return json(res, 200, Object.assign({}, unit, { _totals: totalsOf(unit) }));
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* DELETE /api/units/:id — hanya admin */
    if (!sub && method === 'DELETE') {
      if (sess.role !== 'admin') return json(res, 403, { message: 'Hanya admin yang dapat menghapus unit' });
      data.units.splice(idx, 1);
      logAudit(data, sess, 'unit-hapus', unit.code + ' — ' + unit.name);
      db.save();
      return json(res, 200, { message: 'Unit "' + unit.name + '" dihapus', id: unit.id });
    }

      /* POST /api/units/:id/costs — tambah biaya perbaikan/dokumen */
    if (sub === 'costs' && !seg[4] && method === 'POST') {
      return readBody(req).then((body) => {
        const kindMap = { perbaikan: 'repairs', repair: 'repairs', dokumen: 'documents', document: 'documents' };
        const arrName = kindMap[str(body.kind).toLowerCase()];
        if (!arrName) return json(res, 400, { message: 'kind harus "perbaikan" atau "dokumen"' });
        const v = validateCost(body);
        if (!v.ok) return json(res, 400, { message: 'Data biaya tidak valid', errors: v.errors });
        const prefix = arrName === 'repairs' ? 'rp-' : 'dc-';
        const item = Object.assign({ id: prefix + crypto.randomBytes(4).toString('hex') }, v.value);
        unit[arrName].push(item);
        db.save();
        return json(res, 201, Object.assign({}, item, { _totals: totalsOf(unit) }));
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* PATCH/DELETE /api/units/:id/costs/:cid */
    if (sub === 'costs' && seg[4] && (method === 'PATCH' || method === 'DELETE')) {
      const cid = seg[4];
      const arrName = unit.repairs.some((c) => c.id === cid) ? 'repairs'
        : unit.documents.some((c) => c.id === cid) ? 'documents' : null;
      if (!arrName) return json(res, 404, { message: 'Item biaya tidak ditemukan' });
      const cidx = unit[arrName].findIndex((c) => c.id === cid);

      if (method === 'DELETE') {
        const removed = unit[arrName].splice(cidx, 1)[0];
        db.save();
        return json(res, 200, { message: 'Biaya "' + removed.desc + '" dihapus', id: cid, _totals: totalsOf(unit) });
      }

      return readBody(req).then((body) => {
        const item = unit[arrName][cidx];
        if (body.desc != null) {
          const desc = str(body.desc);
          if (desc.length < 3) return json(res, 400, { message: 'Keterangan minimal 3 karakter' });
          item.desc = desc.slice(0, 120);
        }
        if (body.cost != null && body.cost !== '') {
          const cost = toInt(body.cost);
          if (isNaN(cost) || cost <= 0) return json(res, 400, { message: 'Jumlah biaya harus angka > 0' });
          item.cost = cost;
        }
        if (body.date) {
          if (!isDate(body.date)) return json(res, 400, { message: 'Format tanggal harus YYYY-MM-DD' });
          item.date = body.date;
        }
        db.save();
        return json(res, 200, Object.assign({}, item, { _totals: totalsOf(unit) }));
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* POST /api/units/:id/sell — catat penjualan + invoice otomatis */
    if (sub === 'sell' && method === 'POST') {
      if (unit.sale) return json(res, 409, { message: 'Motor ini sudah terjual (' + unit.sale.invoiceNo + ')' });
      return readBody(req).then((body) => {
        const v = validateSale(body, false);
        if (!v.ok) return json(res, 400, { message: 'Data penjualan tidak valid', errors: v.errors });
        unit.sale = Object.assign({}, v.value, { invoiceNo: db.nextInvoiceNo() });
        unit.status = 'terjual';
        logAudit(data, sess, 'penjualan', unit.code + ' terjual — invoice ' + unit.sale.invoiceNo);
        db.save();
        return json(res, 201, Object.assign({}, unit, { _totals: totalsOf(unit) }));
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* PATCH /api/units/:id/sale — koreksi data penjualan */
    if (sub === 'sale' && method === 'PATCH') {
      if (!unit.sale) return json(res, 409, { message: 'Motor belum terjual' });
      return readBody(req).then((body) => {
        const merged = Object.assign({}, unit.sale, body);
        const v = validateSale(merged, true);
        if (!v.ok) return json(res, 400, { message: 'Data penjualan tidak valid', errors: v.errors });
        ['price', 'date', 'payment', 'dp', 'buyerName', 'buyerPhone', 'buyerAddress', 'note'].forEach((k) => {
          if (v.value[k] !== undefined) unit.sale[k] = v.value[k];
        });
        /* izinkan mengosongkan rincian kredit secara eksplisit */
        if (body.leasing !== undefined) unit.sale.leasing = str(body.leasing).slice(0, 60);
        ['tenor', 'installment'].forEach((k) => {
          if (body[k] !== undefined) unit.sale[k] = toInt(body[k]) > 0 ? toInt(body[k]) : null;
        });
        if (body.dp !== undefined && v.value.dp === undefined) {
          unit.sale.dp = toInt(body.dp) > 0 ? toInt(body.dp) : null;
        }
        /* angsuran terbayar (kolektibilitas) */
        if (body.installmentsPaid !== undefined) {
          const paid = parseInt(body.installmentsPaid, 10);
          unit.sale.installmentsPaid = isNaN(paid) || paid < 0 ? 0 : paid;
        }
        /* penjualan cash tidak boleh menyimpan rincian kredit */
        if (unit.sale.payment === 'cash') {
          unit.sale.dp = null;
          unit.sale.leasing = '';
          unit.sale.tenor = null;
          unit.sale.installment = null;
          unit.sale.installmentsPaid = null;
        }
        logAudit(data, sess, 'koreksi-jual', unit.code + ' — data penjualan dikoreksi');
        db.save();
        return json(res, 200, Object.assign({}, unit, { _totals: totalsOf(unit) }));
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    /* DELETE /api/units/:id/sale — batalkan penjualan (hanya admin) */
    if (sub === 'sale' && method === 'DELETE') {
      if (!unit.sale) return json(res, 409, { message: 'Motor belum terjual' });
      if (sess.role !== 'admin') return json(res, 403, { message: 'Hanya admin yang dapat membatalkan penjualan' });
      const no = unit.sale.invoiceNo;
      unit.sale = null;
      unit.status = 'tersedia';
      logAudit(data, sess, 'batal-jual', unit.code + ' — invoice ' + no + ' dinonaktifkan');
      db.save();
      return json(res, 200, { message: 'Penjualan dibatalkan — invoice ' + no + ' dinonaktifkan', _totals: totalsOf(unit) });
    }
  }

    /* ---------- /api/report/laba-rugi ---------- */
  if (seg[1] === 'report' && seg[2] === 'laba-rugi' && method === 'GET') {
    if (!requireAuth(req, res)) return;

    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const rows = data.units
      .filter((u) => u.sale)
      .filter((u) => (!from || u.sale.date >= from) && (!to || u.sale.date <= to))
      .map((u) => {
        const t = totalsOf(u);
        return {
          id: u.id, code: u.code, name: u.name, brand: u.brand, year: u.year, plate: u.plate,
          purchaseDate: u.purchase.date,
          purchasePrice: t.purchase, repairTotal: t.repair, docTotal: t.doc, totalModal: t.modal,
          salePrice: t.price, profit: t.profit,
          marginPct: t.modal > 0 ? Math.round(t.profit / t.modal * 1000) / 10 : 0,
          saleDate: u.sale.date, invoiceNo: u.sale.invoiceNo
        };
      })
      .sort((a, b) => a.saleDate.localeCompare(b.saleDate));

    const totals = rows.reduce((acc, r) => ({
      purchase: acc.purchase + r.purchasePrice,
      repair: acc.repair + r.repairTotal,
      doc: acc.doc + r.docTotal,
      modal: acc.modal + r.totalModal,
      revenue: acc.revenue + r.salePrice,
      profit: acc.profit + r.profit
    }), { purchase: 0, repair: 0, doc: 0, modal: 0, revenue: 0, profit: 0 });
    totals.count = rows.length;
    totals.marginPct = totals.modal > 0 ? Math.round(totals.profit / totals.modal * 1000) / 10 : 0;

    const operational = data.opex
      .filter((o) => (!from || o.date >= from) && (!to || o.date <= to))
      .reduce((a, o) => a + (Number(o.amount) || 0), 0);

    return json(res, 200, {
      rows, totals, operational,
      netAfterOpex: totals.profit - operational,
      generatedAt: new Date().toISOString()
    });
  }

  /* ---------- /api/invoices ---------- */
  if (seg[1] === 'invoices') {
    if (!requireAuth(req, res)) return;
    const no = seg[2];

    /* GET /api/invoices — daftar */
    if (!no && method === 'GET') {
      const list = data.units.filter((u) => u.sale)
        .sort((a, b) => b.sale.date.localeCompare(a.sale.date))
        .map((u) => ({
          no: u.sale.invoiceNo, unitId: u.id, date: u.sale.date, price: u.sale.price,
          buyerName: u.sale.buyerName, name: u.name, code: u.code, payment: u.sale.payment
        }));
      return json(res, 200, list);
    }

    /* GET /api/invoices/:no — detail lengkap untuk cetak */
    if (no && method === 'GET') {
      const unit = data.units.find((u) => u.sale && u.sale.invoiceNo.toLowerCase() === no.toLowerCase());
      if (!unit) return json(res, 404, { message: 'Invoice "' + no + '" tidak ditemukan' });
      const t = totalsOf(unit);
      return json(res, 200, {
        invoice: Object.assign({}, unit.sale),
        unit: {
          id: unit.id, code: unit.code, name: unit.name, brand: unit.brand,
          year: unit.year, km: unit.km, plate: unit.plate, color: unit.color
        },
        breakdown: {
          purchasePrice: t.purchase,
          repairs: unit.repairs.slice(),
          documents: unit.documents.slice(),
          repairTotal: t.repair, docTotal: t.doc, totalModal: t.modal,
          profit: t.profit
        },
        settings: data.settings
      });
    }
  }

  /* ---------- /api/opex — biaya operasional ---------- */
  if (seg[1] === 'opex') {
    const sess = requireAuth(req, res);
    if (!sess) return;
    const oid = seg[2];

    if (!oid && method === 'GET') {
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const cat = url.searchParams.get('category');
      let list = data.opex.slice();
      if (from) list = list.filter((o) => o.date >= from);
      if (to) list = list.filter((o) => o.date <= to);
      if (cat) list = list.filter((o) => o.category === cat);
      list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const amount = list.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      return json(res, 200, { items: list, totals: { count: list.length, amount } });
    }

    if (!oid && method === 'POST') {
      return readBody(req).then((body) => {
        const v = validateOpex(body);
        if (!v.ok) return json(res, 400, { message: 'Data biaya operasional tidak valid', errors: v.errors });
        const item = Object.assign({ id: db.nextId('opex') }, v.value);
        data.opex.push(item);
        logAudit(data, sess, 'opex-tambah', item.desc + ' — Rp ' + item.amount);
        db.save();
        return json(res, 201, item);
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    const oitem = data.opex.find((o) => o.id === oid);
    if (oid && !oitem) return json(res, 404, { message: 'Biaya operasional tidak ditemukan' });

    if (oid && method === 'PATCH') {
      return readBody(req).then((body) => {
        const v = validateOpex(Object.assign({}, oitem, body));
        if (!v.ok) return json(res, 400, { message: 'Data tidak valid', errors: v.errors });
        Object.assign(oitem, v.value);
        logAudit(data, sess, 'opex-edit', oitem.desc);
        db.save();
        return json(res, 200, oitem);
      }).catch((err) => json(res, 400, { message: err.message }));
    }

    if (oid && method === 'DELETE') {
      if (sess.role !== 'admin') return json(res, 403, { message: 'Hanya admin yang dapat menghapus biaya operasional' });
      data.opex.splice(data.opex.indexOf(oitem), 1);
      logAudit(data, sess, 'opex-hapus', oitem.desc + ' — Rp ' + oitem.amount);
      db.save();
      return json(res, 200, { message: 'Biaya "' + oitem.desc + '" dihapus' });
    }
  }

  /* ---------- /api/audit — riwayat aktivitas (admin) ---------- */
  if (seg[1] === 'audit' && !seg[2] && method === 'GET') {
    const sess = requireAuth(req, res);
    if (!sess) return;
    if (sess.role !== 'admin') return json(res, 403, { message: 'Riwayat aktivitas khusus admin' });
    return json(res, 200, data.auditLog.slice(0, 100));
  }

  return json(res, 404, { message: 'Endpoint API tidak ditemukan', hint: 'Lihat README.md di folder aplikasi' });
}

module.exports = { handleApi, totalsOf, validateSale, validateUser, validateOpex };