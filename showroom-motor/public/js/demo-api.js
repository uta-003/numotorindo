/* ============================================================
   LocalAPI — Mode Demo: seluruh API berjalan di browser
   (dipakai otomatis saat backend Node tidak tersedia, mis. Netlify)
   Data tersimpan di localStorage per perangkat.
============================================================ */
(function () {
'use strict';

const KEY = 'numo_demo_v3';
const HOLIDAY = new Set([
  '2026-01-01','2026-01-16','2026-02-17','2026-03-18','2026-03-19','2026-03-20','2026-03-21',
  '2026-04-03','2026-05-01','2026-05-14','2026-05-27','2026-06-01','2026-06-16','2026-08-17',
  '2026-12-25','2026-12-26',
  '2025-01-01','2025-03-31','2025-04-01','2025-04-18','2025-05-01','2025-05-29','2025-06-06',
  '2025-08-17','2025-12-25'
]);
const UNIT_STATUS = ['tersedia', 'booking', 'terjual'];
const PAYM = ['tunai', 'transfer', 'kredit', 'dp'];

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function isoDay(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function isLibur(dt) { const w = dt.getDay(); return w === 0 || w === 6 || HOLIDAY.has(isoDay(dt)); }
function addWD(startISO, days) {
  const d = new Date(startISO + 'T00:00:00'); let n = 0, g = 0;
  while (n < days && g++ < 3000) { d.setDate(d.getDate() + 1); if (!isLibur(d)) n++; }
  return isoDay(d);
}
function wdBetween(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00'), b = new Date(bISO + 'T00:00:00');
  const fw = b >= a; let n = 0, g = 0;
  const c = new Date(a.getTime()); c.setDate(c.getDate() + (fw ? 1 : -1));
  while ((fw ? c <= b : c >= b) && g++ < 3000) { if (!isLibur(c)) n++; c.setDate(c.getDate() + (fw ? 1 : -1)); }
  return fw ? n : -n;
}
function calcTotals(u) {
  const rep = (u.repairCosts || []).reduce((s, x) => s + x.amount, 0);
  const doc = (u.docCosts || []).reduce((s, x) => s + x.amount, 0);
  const purchase = Number(u.purchaseCost) || 0;
  const modal = purchase + rep + doc;
  const sp = Number(u.sellPrice) || 0;
  return { purchase, repair: rep, doc, modal, sellPrice: sp,
    profit: sp - modal, margin: sp ? Math.round((sp - modal) / sp * 1000) / 10 : 0 };
}
function calcBpkb(u) {
  const days = Number(u.bpkbDays) || 0;
  if (!days) return null;
  const start = u.bpkbStart || u.purchaseDate || u.soldAt || todayISO();
  const due = addWD(start, days);
  if (u.bpkbReady) return { days, start, due, remainWork: null, calLeft: null, status: 'siap', readyAt: u.bpkbReadyAt || null };
  const today = todayISO();
  const remainWork = wdBetween(today, due);
  const calLeft = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  return { days, start, due, remainWork, calLeft,
    status: calLeft < 0 ? 'terlambat' : (calLeft <= 7 ? 'kritis' : 'proses'), readyAt: null };
}

/* @@DA2@@ */

function buildSeed() {
  const S = window.DEMO_SEED;
  const meta = {
    'unit-1': { nr:'MHLCXB210K9A01234', nm:'JC39E-1023456', pj:'2026-09-10', stnk:true, fak:true, fa:false },
    'unit-2': { nr:'MHJXB53C0KA123456', nm:'B5RE-9876543', pj:'2027-01-20', stnk:true, fak:true, fa:true },
    'unit-3': { nr:'MHCF1B1234K9081721', nm:'F115-4567890', pj:'2026-11-05', stnk:true, fak:false, fa:false },
    'unit-4': { nr:'MHJKVA52C0N0045678', nm:'K1ZT-1122334', pj:'2027-02-15', stnk:true, fak:true, fa:false },
    'unit-5': { nr:'JKARXA2310K7011223', nm:'EX300E-7788990', pj:'2026-08-30', stnk:true, fak:true, fa:false },
    'unit-6': { nr:'MHCB150BK8J9988776', nm:'C150RU-5566778', pj:'2026-12-12', stnk:true, fak:true, fa:true }
  };
  function mk(id, code, name, brand, type, year, km, cc, color, trans, nopol, pc, pd, sp, st, m) {
    return { id, code, name, brand, type, year, km, cc, color, transmisi: trans, nopol,
      purchaseCost: pc, purchaseDate: pd, sellPrice: sp, status: st,
      repairCosts: [], docCosts: [], photos: [], archived: false, notes: '',
      noRangka: m.nr, noMesin: m.nm, pajakDue: m.pj,
      docs: { stnk: m.stnk, faktur: m.fak, formA: m.fa } };
  }
  const units = [
    mk('unit-1','UM-0001','Honda Beat Sporty FI','Honda','Skutik',2020,15430,110,'Merah','Otomatis','B 3421 KQA',7150000,'2026-06-02',9350000,'tersedia',meta['unit-1']),
    mk('unit-2','UM-0002','Yamaha NMAX 155 Connected ABS','Yamaha','Skutik',2021,9870,155,'Biru','Otomatis','B 5678 XYZ',18500000,'2026-05-12',21500000,'terjual',meta['unit-2']),
    mk('unit-3','UM-0003','Suzuki Satria F150','Suzuki','Bebek Sport',2016,23450,150,'Hitam','Manual 6','B 4521 ABC',8600000,'2026-04-18',11900000,'tersedia',meta['unit-3']),
    mk('unit-4','UM-0004','Honda Vario 125 LED','Honda','Skutik',2023,5120,125,'Merah Matte','Otomatis','B 9876 PQR',17400000,'2026-07-01',19900000,'booking',meta['unit-4']),
    mk('unit-5','UM-0005','Kawasaki W175 SE','Kawasaki','Retro Klasik',2019,18760,177,'Hijau','Manual 5','B 1122 DEF',13900000,'2026-06-20',16250000,'tersedia',meta['unit-5']),
    mk('unit-6','UM-0006','Honda CB150 Verza','Honda','Sport',2018,31240,150,'Putih','Manual 6','B 7788 GHI',12100000,'2026-03-15',14750000,'terjual',meta['unit-6'])
  ];
  units[0].bpkbDays = 21; units[0].bpkbStart = '2026-06-02';
  units[1].bpkbDays = 14; units[1].bpkbStart = '2026-05-12'; units[1].bpkbReady = true; units[1].bpkbReadyAt = '2026-06-20';
  units[3].bpkbDays = 14; units[3].bpkbStart = '2026-08-10';
  units[5].bpkbDays = 21; units[5].bpkbStart = '2026-03-15'; units[5].bpkbReady = true; units[5].bpkbReadyAt = '2026-04-08';

/* @@DA2B@@ */

  const C = (id, desc, amt, d) => ({ id, desc, amount: amt, date: d });
  units[0].repairCosts.push(C('cost-1','Servis besar + ganti oli, filter, busi',385000,'2026-06-03'), C('cost-2','Ganti kampas rem depan & belakang',175000,'2026-06-03'));
  units[0].docCosts.push(C('cost-3','Balik nama (BBN) Samsat',400000,'2026-06-05'), C('cost-4','Cek pajak & administrasi STNK',100000,'2026-06-05'));
  units[1].repairCosts.push(C('cost-5','Ganti ban belakang IRC NR53',475000,'2026-05-14'), C('cost-6','Ganti aki GS Astra 5Ah',320000,'2026-05-14'));
  units[1].docCosts.push(C('cost-7','Balik nama (BBN) Samsat',450000,'2026-05-16'));
  units[2].repairCosts.push(C('cost-8','Overhaul mesin bagian atas',1150000,'2026-04-22'), C('cost-9','Cat & poles fairing body',675000,'2026-04-25'), C('cost-10','Ganti rantai-gir set',420000,'2026-04-22'));
  units[2].docCosts.push(C('cost-11','Perpanjangan STNK 5 tahun',325000,'2026-04-28'), C('cost-12','Balik nama (BBN) Samsat',400000,'2026-04-28'));
  units[3].docCosts.push(C('cost-13','Balik nama (BBN) Samsat',350000,'2026-07-03'));
  units[4].repairCosts.push(C('cost-14','Setel karburator + tune up',225000,'2026-06-23'), C('cost-15','Ganti spion set original',145000,'2026-06-23'));
  units[4].docCosts.push(C('cost-16','Cek Form A & fisik STNK',75000,'2026-06-24'));
  units[5].repairCosts.push(C('cost-17','Ganti rantai-gir set',395000,'2026-03-18'), C('cost-18','Service mesin + ganti oli',260000,'2026-03-18'));
  units[5].docCosts.push(C('cost-19','Balik nama (BBN) Samsat',350000,'2026-03-20'), C('cost-20','Mutasi nama kendaraan',275000,'2026-03-20'));

  const invoices = [
    { id:'inv-1', number:'INV/2026/06/0002', unitId:'unit-2', customerId:'cust-1',
      snapshot:{name:'Yamaha NMAX 155 Connected ABS',brand:'Yamaha',year:2021,cc:155,color:'Biru',nopol:'B 5678 XYZ'},
      buyer:{name:'Hendra Wijaya',phone:'0812-3344-5566',address:'Jl. Kenanga No. 21, Depok'},
      sellPrice:21500000, discount:0, total:21500000, paymentMethod:'transfer', date:'2026-06-28', note:'',
      createdBy:'Rina Amelia (Sales)', createdById:'user-3', createdAt:'2026-06-28T06:30:00Z',
      payments:[{id:'pay-1',date:'2026-06-28',amount:21500000,method:'transfer',note:'Pelunasan penuh'}] },
    { id:'inv-2', number:'INV/2026/05/0001', unitId:'unit-6', customerId:'cust-2',
      snapshot:{name:'Honda CB150 Verza',brand:'Honda',year:2018,cc:150,color:'Putih',nopol:'B 7788 GHI'},
      buyer:{name:'Agus Salim',phone:'0857-1122-3344',address:'Jl. Melati Raya No. 9, Bekasi'},
      sellPrice:14750000, discount:250000, total:14500000, paymentMethod:'tunai', date:'2026-05-09', note:'',
      createdBy:'Rina Amelia (Sales)', createdById:'user-3', createdAt:'2026-05-09T04:15:00Z',
      payments:[{id:'pay-2',date:'2026-05-09',amount:5000000,method:'tunai',note:'Uang muka (DP)'}] }
  ];
  const bastds = [{
    id:'bastd-1', number:'BASTD/2026/07/0001', date:'2026-07-01', unitId:'unit-2', customerId:'cust-1',
    type:['stnk','bpkb'],
    items:[{key:'stnk',number:'D 5678 XYZ · masa 06-2027'},{key:'bpkb',number:'BPKB B 05678 XYZ · hal 1-4'}],
    snapshot:{unitCode:'UM-0002',unitName:'Yamaha NMAX 155 Connected ABS',brand:'Yamaha',year:2021,color:'Biru',
      nopol:'B 5678 XYZ',noRangka:'MHJXB53C0KA123456',noMesin:'B5RE-9876543',
      buyerName:'Hendra Wijaya',buyerPhone:'0812-3344-5566',buyerAddress:'Jl. Kenanga No. 21, Depok'},
    note:'', createdBy:'Rina Amelia (Sales)', createdById:'user-3', createdAt:'2026-07-01T03:00:00Z'
  }];

  return {
    users: S.users.map((u) => Object.assign({}, u)),
    customers: S.customers.map((c) => Object.assign({}, c)),
    units, invoices, bastds,
    logs: [], sessions: {}, tok: null,
    seq: { user:5, unit:7, inv:3, cost:21, pay:4, customer:3, bastdid:2, photo:1 }
  };
}

/* @@DA3@@ */

let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!db || !Array.isArray(db.units)) {
    db = buildSeed();
    db.seq.bastd = 2;
    persist();
  }
  if (!db.customers) db.customers = [];
  if (!db.bastds) db.bastds = [];
  if (!db.logs) db.logs = [];
  return db;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

function nextId(kind, prefix) {
  const d = load();
  const n = d.seq[kind] ? d.seq[kind]++ : (d.seq[kind] = 1);
  return prefix + '-' + n;
}
function fail(status, message, errors) {
  const e = new Error(message);
  e.status = status; e.data = errors ? { message, errors } : { message };
  return e;
}
function ok(data, status) { return { status: status || 200, data: data }; }

function currentUser() {
  const d = load();
  if (!d.tok) return null;
  const u = d.users.find((x) => x.id === d.tok);
  return u && u.active ? u : null;
}
function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, active: !!u.active,
    komisiPersen: Number(u.komisiPersen) || 0, targetBulanan: Number(u.targetBulanan) || 0, createdAt: u.createdAt };
}
function perms(u) {
  const b = { manageUnits:false, editPurchase:false, editRepairs:false, editDocs:false,
    editSellPrice:false, sell:false, viewReports:false, manageUsers:false };
  if (u.role === 'admin') return Object.assign(b, { manageUnits:true, editPurchase:true, editRepairs:true,
    editDocs:true, editSellPrice:true, sell:true, viewReports:true, manageUsers:true });
  if (u.role === 'owner') return Object.assign(b, { editSellPrice:true, viewReports:true });
  if (u.role === 'sales') return Object.assign(b, { editSellPrice:true, sell:true });
  if (u.role === 'mekanik') return Object.assign(b, { editRepairs:true });
  return b;
}
function logAct(me, action, detail) {
  const d = load();
  d.logs.push({ id: 'log-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    at: new Date().toISOString(), user: me ? me.username : '-', role: me ? me.role : '-',
    action, detail: String(detail || '').slice(0, 300) });
  if (d.logs.length > 400) d.logs.splice(0, d.logs.length - 400);
  persist();
}
function serializeUnit(u, viewer) {
  const t = calcTotals(u);
  const base = Object.assign({}, u, { repairCosts: u.repairCosts || [], docCosts: u.docCosts || [], bpkb: calcBpkb(u) });
  if (viewer && viewer.role === 'mekanik') {
    base.purchaseCost = null; base.sellPrice = null;
    base.totals = { purchase:null, repair:t.repair, doc:null, modal:null, sellPrice:null, profit:null, margin:null };
  } else base.totals = t;
  return base;
}
function serializeInvoice(i) {
  const pays = Array.isArray(i.payments) ? i.payments : [];
  const paid = pays.reduce((s, x) => s + x.amount, 0);
  return Object.assign({}, i, { payments: pays, paid,
    sisa: Math.max(0, i.total - paid), lunas: i.total > 0 && paid >= i.total });
}

/* ---------- Router utama mode demo ---------- */
function handle(m, seg, qs, body) {
  const me = currentUser();

  /* ---- AUTH ---- */
  if (seg[0] === 'auth') {
    if (seg[1] === 'login' && m === 'POST') {
      const uname = String((body && body.username) || '').trim().toLowerCase();
      const pw = String((body && body.password) || '');
      const u = load().users.find((x) => x.username.toLowerCase() === uname);
      if (!u || u.pass !== pw) throw fail(401, 'Username atau password salah');
      if (!u.active) throw fail(403, 'Akun dinonaktifkan');
      const d = load(); d.tok = u.id; persist();
      return ok({ token: 'demo-' + u.id, user: publicUser(u), permissions: perms(u) });
    }
    if (!me) throw fail(401, 'Silakan login terlebih dahulu');
    if (seg[1] === 'me' && m === 'GET') return ok({ user: publicUser(me), permissions: perms(me) });
    if (seg[1] === 'logout' && m === 'POST') { const d = load(); d.tok = null; persist(); return ok({ ok:true }); }
    if (seg[1] === 'change-password' && m === 'POST') {
      if ((body && body.oldPassword) !== me.pass) throw fail(400, 'Password lama salah', { oldPassword:'Password lama salah' });
      const np = String((body && body.newPassword) || '');
      if (np.length < 5) throw fail(400, 'Minimal 5 karakter', { newPassword:'Minimal 5 karakter' });
      me.pass = np; persist(); logAct(me,'password-ubah','Ganti password sendiri');
      return ok({ ok:true });
    }
    throw fail(404, 'Endpoint tidak ditemukan');
  }

  if (!me) throw fail(401, 'Silakan login terlebih dahulu');
  const P = perms(me);

  switch (seg[0]) {
    case 'units':   return unitRoutes(m, seg, qs, body, me, P);
    case 'invoices':return invoiceRoutes(m, seg, qs, body, me, P);
    case 'customers':return customerRoutes(m, seg, qs, body, me);
    case 'bastds':  return bastdRoutes(m, seg, qs, body, me);
    case 'reports': return reportRoutes(seg, qs, me);
    case 'logs':
      if (!(me.role === 'admin' || me.role === 'owner')) throw fail(403, 'Tidak diizinkan');
      return ok([...load().logs].sort((a,b)=>b.at.localeCompare(a.at)).slice(0, Math.min(parseInt(qs.get('limit')||'80',10)||80,300)));
    case 'export':
      if (!P.viewReports) throw fail(403, 'Tidak diizinkan mengekspor laporan');
      return exportCsv(seg[1] || '');
    case 'users':
      if (!P.manageUsers) throw fail(403, 'Hanya admin yang dapat mengelola pengguna');
      return userRoutes(m, seg, qs, body, me);
    default: throw fail(404, 'Endpoint tidak ditemukan');
  }
}

/* @@DA4@@ */

function unitRoutes(m, seg, qs, body, me, P) {
  const d = load();

  if (m === 'GET' && !seg[1]) {
    let list = [...d.units].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const ar = qs.get('archived');
    if (ar === '1') list = list.filter((x) => x.archived);
    else if (ar !== 'all') list = list.filter((x) => !x.archived);
    const st = qs.get('status');
    if (st && UNIT_STATUS.includes(st)) list = list.filter((x) => x.status === st);
    const q = (qs.get('q') || '').toLowerCase().trim();
    if (q) list = list.filter((x) => [x.code, x.name, x.brand, x.nopol, String(x.year || '')].join(' ').toLowerCase().includes(q));
    return ok(list.map((x) => serializeUnit(x, me)));
  }

  if (m === 'POST' && !seg[1]) {
    if (!P.manageUnits) throw fail(403, 'Anda tidak memiliki izin menambah unit');
    let st = 'tersedia';
    if (body.status && UNIT_STATUS.includes(body.status)) st = body.status;
    const nid = nextId('unit', 'unit');
    const u = {
      id: nid, code: 'UM-' + String(parseInt(nid.split('-')[1],10)).padStart(4,'0'),
      name: String(body.name||'').trim(), brand: String(body.brand||'').trim(),
      type: String(body.type||'').trim(), color: String(body.color||'').trim(),
      transmisi: String(body.transmisi||'').trim(),
      nopol: String(body.nopol||'').trim().toUpperCase(),
      notes: String(body.notes||'').slice(0,500),
      year: parseInt(body.year,10)||0, km: parseInt(body.km,10)||0, cc: parseInt(body.cc,10)||0,
      purchaseCost: Number(body.purchaseCost)||0,
      purchaseDate: body.purchaseDate || todayISO(),
      sellPrice: Number(body.sellPrice)||0,
      bpkbDays: [0,7,14,21,28].includes(Number(body.bpkbDays)) ? Number(body.bpkbDays) : 0,
      bpkbStart: body.bpkbStart || '',
      noRangka: String(body.noRangka||'').trim().toUpperCase(),
      noMesin: String(body.noMesin||'').trim().toUpperCase(),
      pajakDue: body.pajakDue || '',
      docs: Object.assign({ stnk:false, faktur:false, formA:false }, body.docs || {}),
      repairCosts: [], docCosts: [], photos: [], archived: false,
      status: st, createdAt: new Date().toISOString()
    };
    if (!u.name || u.name.length < 3) throw fail(400,'Validasi gagal',{name:'Nama motor minimal 3 karakter'});
    u.repairCosts = (body.repairCosts||[]).filter((c)=>c&&c.desc).map((c)=>
      ({ id:nextId('cost','cost'), desc:String(c.desc).slice(0,120), amount:Number(c.amount)||0, date:c.date||todayISO() }));
    u.docCosts = (body.docCosts||[]).filter((c)=>c&&c.desc).map((c)=>
      ({ id:nextId('cost','cost'), desc:String(c.desc).slice(0,120), amount:Number(c.amount)||0, date:c.date||todayISO() }));
    d.units.push(u); persist();
    logAct(me,'unit-tambah',u.code+' · '+u.name);
    return ok(serializeUnit(u,me),201);
  }

  const u = d.units.find((x) => x.id === seg[1]);
  if (!u) throw fail(404, 'Unit tidak ditemukan');

  if (!seg[2] && m === 'GET') return ok(serializeUnit(u, me));

  if (!seg[2] && m === 'PUT') {
    if (!P.manageUnits) throw fail(403, 'Anda tidak memiliki izin mengubah unit');
    ['name','brand','type','color','transmisi','notes','bpkbStart','pajakDue'].forEach((k)=>{
      if (body[k]!==undefined&&body[k]!==null) u[k]=String(body[k]).trim().slice(k==='notes'?500:80*9);
    });
    if (body.nopol!==undefined) u.nopol=String(body.nopol).trim().toUpperCase();
    if (body.noRangka!==undefined) u.noRangka=String(body.noRangka).trim().toUpperCase();
    if (body.noMesin!==undefined) u.noMesin=String(body.noMesin).trim().toUpperCase();
    ['year','km','cc'].forEach((k)=>{ if(body[k]!==undefined) u[k]=parseInt(body[k],10)||0; });
    if (body.purchaseCost!==undefined) u.purchaseCost=Number(body.purchaseCost)||0;
    if (body.purchaseDate) u.purchaseDate=body.purchaseDate;
    if (body.sellPrice!==undefined && u.status!=='terjual') u.sellPrice=Number(body.sellPrice)||0;
    if (body.bpkbDays!==undefined && [0,7,14,21,28].includes(Number(body.bpkbDays))) u.bpkbDays=Number(body.bpkbDays);
    if ((u.status==='terjual'||u.invoiceId) && body.status && body.status!=='terjual')
      throw fail(400,'Unit sudah terjual — hapus invoice terlebih dahulu');
    if (body.status && UNIT_STATUS.includes(body.status)) u.status=body.status;
    if (body.repairCosts) u.repairCosts=(body.repairCosts||[]).filter((c)=>c&&c.desc).map((c)=>
      ({ id:nextId('cost','cost'), desc:String(c.desc).slice(0,120), amount:Number(c.amount)||0, date:c.date||todayISO() }));
    if (body.docCosts) u.docCosts=(body.docCosts||[]).filter((c)=>c&&c.desc).map((c)=>
      ({ id:nextId('cost','cost'), desc:String(c.desc).slice(0,120), amount:Number(c.amount)||0, date:c.date||todayISO() }));
    persist(); logAct(me,'unit-ubah',u.code);
    return ok(serializeUnit(u,me));
  }

  /* @@DA5a@@ */

  if (!seg[2] && m === 'PATCH') {
    if (body.status != null) {
      if (!(me.role === 'admin' || me.role === 'sales')) throw fail(403, 'Tidak diizinkan mengubah status');
      if (!UNIT_STATUS.includes(body.status)) throw fail(400, 'Status tidak valid');
      if ((u.status === 'terjual' || u.invoiceId) && body.status !== 'terjual')
        throw fail(400, 'Unit sudah terjual — hapus invoice lebih dahulu');
      u.status = body.status;
    }
    if (body.sellPrice !== undefined && body.sellPrice !== null && body.sellPrice !== '') {
      if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) throw fail(403, 'Tidak diizinkan mengubah harga jual');
      if (u.status === 'terjual') throw fail(400, 'Unit sudah terjual — harga terkunci di invoice');
      u.sellPrice = Number(String(body.sellPrice).replace(/[^0-9]/g,'')) || 0;
    }
    if (typeof body.bpkbReady === 'boolean') {
      if (!u.bpkbDays) throw fail(400, 'Unit ini belum memiliki proses BPKB');
      if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) throw fail(403, 'Tidak diizinkan mengubah status BPKB');
      u.bpkbReady = body.bpkbReady;
      if (u.bpkbReady) u.bpkbReadyAt = todayISO(); else delete u.bpkbReadyAt;
    }
    if (typeof body.archived === 'boolean') {
      if (me.role !== 'admin') throw fail(403, 'Hanya admin yang dapat mengarsipkan unit');
      u.archived = body.archived;
    }
    if (body.pajakDue !== undefined) {
      const pd = String(body.pajakDue || '').trim();
      if (pd === '') u.pajakDue = '';
      else if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) u.pajakDue = pd;
      else throw fail(400, 'Tanggal pajak tidak valid', { pajakDue:'Format tanggal tidak valid' });
    }
    if (body.docs && typeof body.docs === 'object' &&
        (me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
      if (!u.docs) u.docs = {};
      ['stnk','faktur','formA'].forEach((k) => { if (typeof body.docs[k] === 'boolean') u.docs[k] = body.docs[k]; });
    }
    persist(); logAct(me, 'unit-patch', u.code);
    return ok(serializeUnit(u, me));
  }

  if (!seg[2] && m === 'DELETE') {
    if (!P.manageUnits) throw fail(403, 'Anda tidak memiliki izin menghapus unit');
    if (u.status === 'terjual' || u.invoiceId) throw fail(400, 'Unit sudah terjual. Hapus invoice terkait terlebih dahulu.');
    d.units.splice(d.units.indexOf(u), 1); persist();
    logAct(me, 'unit-hapus', u.code);
    return ok({ ok:true });
  }

  /* @@DA5b@@ */

  /* duplikat unit */
  if (seg[2] === 'duplicate' && m === 'POST') {
    if (!P.manageUnits) throw fail(403, 'Anda tidak memiliki izin menduplikasi unit');
    const nid = nextId('unit', 'unit');
    const cp = JSON.parse(JSON.stringify(u));
    cp.id = nid;
    cp.code = 'UM-' + String(parseInt(nid.split('-')[1],10)).padStart(4,'0');
    cp.status = 'tersedia'; cp.archived = false; cp.photos = []; cp.nopol = '';
    delete cp.invoiceId; delete cp.soldAt;
    cp.bpkbReady = false; delete cp.bpkbReadyAt;
    cp.repairCosts = (u.repairCosts||[]).map((c)=>Object.assign({},c,{id:nextId('cost','cost')}));
    cp.docCosts = (u.docCosts||[]).map((c)=>Object.assign({},c,{id:nextId('cost','cost')}));
    cp.createdAt = new Date().toISOString();
    d.units.push(cp); persist();
    logAct(me,'unit-duplikat',cp.code+' (dari '+u.code+')');
    return ok(serializeUnit(cp, me), 201);
  }

  /* foto unit — disimpan sebagai dataURL */
  if (seg[2] === 'photos') {
    if (me.role === 'mekanik') throw fail(403, 'Tidak diizinkan mengelola foto');
    if (!Array.isArray(u.photos)) u.photos = [];
    if (m === 'POST' && !seg[3]) {
      const dataUrl = String(body.data || '');
      if (!dataUrl) throw fail(400, 'File foto kosong');
      if (dataUrl.length > 1400 * 1024) throw fail(400, 'Ukuran foto maksimal 1 MB');
      const ph = { id: nextId('photo','ph'), url: dataUrl,
        name: String(body.filename || 'foto').slice(0,120), addedAt: new Date().toISOString() };
      u.photos.push(ph); persist();
      logAct(me,'foto-upload',u.code);
      return ok({ photo: ph, unit: serializeUnit(u, me) }, 201);
    }
    if (seg[3] === 'cover' && m === 'POST') {
      const i = u.photos.findIndex((x) => x.id === body.photoId);
      if (i < 0) throw fail(404, 'Foto tidak ditemukan');
      const ph = u.photos.splice(i, 1)[0];
      u.photos.unshift(ph); persist();
      return ok(serializeUnit(u, me));
    }
    if (seg[3] && m === 'DELETE') {
      const i = u.photos.findIndex((x) => x.id === seg[3]);
      if (i < 0) throw fail(404, 'Foto tidak ditemukan');
      u.photos.splice(i, 1); persist();
      logAct(me,'foto-hapus',u.code);
      return ok(serializeUnit(u, me));
    }
  }

  /* biaya perbaikan & dokumen */
  if (seg[2] === 'costs') {
    if (seg[3]) {
      if (m !== 'DELETE') throw fail(405, 'Metode tidak didukung');
      let found = null;
      [['repairCosts'],['docCosts']].forEach(([k]) => {
        const i = (u[k] || []).findIndex((c) => c.id === seg[3]);
        if (i >= 0) found = { k, i };
      });
      if (!found) throw fail(404, 'Biaya tidak ditemukan');
      const allowed = found.k === 'repairCosts' ? P.editRepairs : P.editDocs;
      if (!allowed) throw fail(403, found.k === 'repairCosts'
        ? 'Hanya admin/mekanik yang dapat menghapus biaya perbaikan'
        : 'Hanya admin yang dapat menghapus biaya dokumen');
      u[found.k].splice(found.i, 1); persist();
      logAct(me,'biaya-hapus',u.code+' · '+found.k);
      return ok(serializeUnit(u, me));
    }
    if (m === 'POST') {
      const type = String(body.type || '');
      const allowed = type === 'perbaikan' ? P.editRepairs : P.editDocs;
      if (!allowed) throw fail(403, type === 'dokumen'
        ? 'Hanya admin yang dapat menambah biaya dokumen'
        : 'Hanya admin/mekanik yang dapat menambah biaya perbaikan');
      const desc = String(body.desc || '').trim();
      if (desc.length < 3) throw fail(400, 'Keterangan minimal 3 karakter', { desc:'Keterangan minimal 3 karakter' });
      const amt = Number(String(body.amount == null ? '' : body.amount).replace(/[^0-9]/g,'')) || 0;
      if (amt <= 0) throw fail(400, 'Nominal harus lebih dari 0', { amount:'Nominal harus > 0' });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date||'')) ? body.date : todayISO();
      const cost = { id: nextId('cost','cost'), desc, amount: amt, date };
      (type === 'perbaikan' ? u.repairCosts : u.docCosts).push(cost);
      persist(); logAct(me,'biaya-tambah',u.code+' · '+desc+' · Rp'+amt.toLocaleString('id-ID'));
      return ok(serializeUnit(u, me), 201);
    }
  }

  throw fail(404, 'Endpoint tidak ditemukan');
}

function invoiceRoutes(m, seg, qs, body, me, P) {
  const d = load();
  if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
    throw fail(403, 'Tidak diizinkan mengakses invoice');
  }

  if (m === 'GET' && !seg[1]) {
    let list = [...d.invoices].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const q = (qs.get('q') || '').toLowerCase().trim();
    if (q) list = list.filter((i) => [i.number, i.buyer && i.buyer.name, i.snapshot && i.snapshot.name]
      .join(' ').toLowerCase().includes(q));
    return ok(list.map(serializeInvoice));
  }

  if (m === 'POST' && !seg[1]) {
    if (!P.sell) throw fail(403, 'Hanya admin/sales yang dapat membuat invoice');
    const unit = d.units.find((x) => x.id === body.unitId);
    if (!unit) throw fail(400, 'Pilih unit yang akan dijual', { unitId:'Unit wajib dipilih' });
    if (unit.status === 'terjual' || unit.invoiceId) throw fail(400, 'Unit ' + unit.code + ' sudah terjual');

    const sellPrice = Number(String(body.sellPrice == null ? '' : body.sellPrice).replace(/[^0-9]/g,'')) ||
      (Number(unit.sellPrice) || 0);
    const discount = Number(String(body.discount == null ? '' : body.discount).replace(/[^0-9]/g,'')) || 0;
    const buyerName = String(body.buyerName || '').trim();
    if (buyerName.length < 3) throw fail(400, 'Validasi gagal', { buyerName:'Nama pembeli minimal 3 karakter' });
    if (!sellPrice) throw fail(400, 'Validasi gagal', { sellPrice:'Harga jual wajib diisi' });
    const invTotal = sellPrice - discount;
    if (invTotal <= 0) throw fail(400, 'Validasi gagal', { total:'Total tidak valid' });

    /* pelanggan: pakai yang ada atau daftarkan otomatis */
    if (!Array.isArray(d.customers)) d.customers = [];
    let cust = null;
    if (body.customerId) cust = d.customers.find((c) => c.id === body.customerId);
    const buyerPhone = String(body.buyerPhone || '').trim();
    if (!cust) cust = d.customers.find((c) =>
      c.name.toLowerCase() === buyerName.toLowerCase() || (buyerPhone && c.phone === buyerPhone));
    if (!cust) {
      cust = { id: nextId('customer','cust'), name: buyerName,
        phone: buyerPhone, address: String(body.buyerAddress||'').trim(), notes:'', createdAt:new Date().toISOString() };
      d.customers.push(cust);
      logAct(me,'pelanggan-tambah','(otomatis dari invoice) ' + cust.name);
    }

    const dp = Number(String(body.dpAmount == null ? '' : body.dpAmount).replace(/[^0-9]/g,'')) || 0;
    if (dp > invTotal) throw fail(400, 'DP melebihi total tagihan', { dpAmount:'Maksimal Rp ' + invTotal.toLocaleString('id-ID') });

    const nid = nextId('inv','inv');
    const now = new Date();
    const inv = {
      id: nid,
      number:'INV/' + now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' +
        String(parseInt(nid.split('-')[1],10)).padStart(4,'0'),
      unitId: unit.id, customerId: cust ? cust.id : null,
      snapshot:{name:unit.name,brand:unit.brand,year:unit.year,cc:unit.cc,color:unit.color,nopol:unit.nopol},
      buyer:{name:buyerName,phone:buyerPhone,address:String(body.buyerAddress||'').trim()},
      sellPrice:sellPrice, discount:discount, total:invTotal,
      paymentMethod:String(body.paymentMethod||'tunai'), date:body.date||todayISO(),
      note:String(body.note||'').slice(0,300),
      createdBy:me.name||me.username, createdById:me.id, createdAt:now.toISOString(),
      payments:[]
    };
    if (dp > 0) inv.payments.push({ id: nextId('pay','pay'), date: inv.date,
      amount: dp, method: inv.paymentMethod, note:'Uang muka (DP)' });
    d.invoices.push(inv);
    unit.status='terjual'; unit.sellPrice=sellPrice; unit.invoiceId=inv.id; unit.soldAt=inv.date;
    persist();
    logAct(me,'invoice-buat',inv.number+' · '+unit.code+' · Rp'+inv.total.toLocaleString('id-ID'));
    return ok({ invoice: serializeInvoice(inv), unit: serializeUnit(unit, me) }, 201);
  }

const invIdx = d.invoices.findIndex((x) => x.id === seg[1]);
  if (invIdx < 0) throw fail(404, 'Invoice tidak ditemukan');
  const inv = d.invoices[invIdx];

  /* ---------- pembayaran cicilan / DP ---------- */
  if (seg[2] === 'payments') {
    if (!(me.role === 'admin' || me.role === 'sales')) throw fail(403, 'Hanya admin/sales yang dapat mengelola pembayaran');
    if (!Array.isArray(inv.payments)) inv.payments = [];

    if (seg[3] && m === 'DELETE') {
      const pi = inv.payments.findIndex((x) => x.id === seg[3]);
      if (pi < 0) throw fail(404, 'Pembayaran tidak ditemukan');
      const rem = inv.payments.splice(pi, 1)[0]; persist();
      logAct(me,'bayar-hapus',inv.number+' · Rp'+Number(rem.amount).toLocaleString('id-ID'));
      return ok({ ok:true, invoice: serializeInvoice(inv) });
    }

    if (m === 'POST' && !seg[3]) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date||'')) ? body.date : todayISO();
      const amt = Number(String(body.amount == null ? '' : body.amount).replace(/[^0-9]/g,'')) || 0;
      const paidSoFar = inv.payments.reduce((s,x)=>s+x.amount,0);
      const sisa = Math.max(0, inv.total - paidSoFar);
      if (amt <= 0) throw fail(400, 'Nominal tidak valid', { amount:'Harus angka > 0' });
      if (amt > sisa) throw fail(400, 'Melebihi sisa tagihan', { amount:'Sisa hanya Rp '+sisa.toLocaleString('id-ID') });
      const pay = { id: nextId('pay','pay'), date: date, amount: amt,
        method: String(body.method||inv.paymentMethod||'tunai'), note:String(body.note||'').slice(0,200) };
      inv.payments.push(pay); persist();
      logAct(me,'bayar-tambah',inv.number+' · Rp'+amt.toLocaleString('id-ID'));
      return ok({ payment: pay, invoice: serializeInvoice(inv) }, 201);
    }
    throw fail(405, 'Metode tidak didukung');
  }

  if (m === 'GET') {
    const unit = d.units.find((x) => x.id === inv.unitId);
    return ok({ invoice: serializeInvoice(inv), unit: unit ? serializeUnit(unit, me) : null });
  }

  if (m === 'DELETE') {
    if (me.role !== 'admin') throw fail(403, 'Hanya admin yang dapat menghapus invoice');
    d.invoices.splice(invIdx, 1);
    const unit = d.units.find((x) => x.id === inv.unitId);
    if (unit && unit.invoiceId === inv.id) {
      unit.status = 'tersedia'; delete unit.invoiceId; delete unit.soldAt;
    }
    persist(); logAct(me,'invoice-hapus',inv.number);
    return ok({ ok:true });
  }
  throw fail(405, 'Metode tidak didukung');
}

function customerRoutes(m, seg, qs, body, me) {
  const d = load();
  if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
    throw fail(403, 'Tidak diizinkan mengakses data pelanggan');
  }
  if (!Array.isArray(d.customers)) d.customers = [];

  if (m === 'GET' && !seg[1]) {
    let list = [...d.customers].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const q = (qs.get('q') || '').toLowerCase().trim();
    if (q) list = list.filter((c) => [c.name, c.phone, c.address].join(' ').toLowerCase().includes(q));
    return ok(list.map((c) => {
      const invs = d.invoices.filter((i) => i.customerId === c.id);
      return Object.assign({}, c, { totalTransaksi: invs.length,
        omzet: invs.reduce((s, i) => s + i.total, 0) });
    }));
  }

  function vcust(raw) {
    const name = String(raw.name || '').trim();
    if (name.length < 3) throw fail(400, 'Validasi gagal', { name:'Nama minimal 3 karakter' });
    return { name, phone: String(raw.phone||'').trim(), address: String(raw.address||'').trim(),
      notes: String(raw.notes||'').trim() };
  }

  if (m === 'POST' && !seg[1]) {
    const c = Object.assign({ id: nextId('customer','cust'), createdAt: new Date().toISOString() }, vcust(body));
    d.customers.push(c); persist();
    logAct(me,'pelanggan-tambah',c.name);
    return ok(c, 201);
  }

  const cust = d.customers.find((x) => x.id === seg[1]);
  if (!cust) throw fail(404, 'Pelanggan tidak ditemukan');

  if (m === 'PUT') {
    Object.assign(cust, vcust(body)); persist();
    logAct(me,'pelanggan-ubah',cust.name);
    return ok(cust);
  }
  if (m === 'DELETE') {
    if (d.invoices.some((i) => i.customerId === cust.id)) {
      throw fail(400, 'Pelanggan memiliki riwayat invoice dan tidak bisa dihapus');
    }
    d.customers.splice(d.customers.indexOf(cust), 1); persist();
    logAct(me,'pelanggan-hapus',cust.name);
    return ok({ ok:true });
  }
  throw fail(405, 'Metode tidak didukung');
}

/* ---------- BASTD ---------- */
function bastdRoutes(m, seg, qs, body, me) {
  const d = load();
  if (!(me.role === 'admin' || me.role === 'owner' || me.role === 'sales')) {
    throw fail(403, 'Tidak diizinkan mengakses BASTD');
  }
  if (!Array.isArray(d.bastds)) d.bastds = [];

  if (m === 'GET' && !seg[1]) {
    let list = [...d.bastds].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const q = (qs.get('q') || '').toLowerCase().trim();
    if (q) list = list.filter((x) => [x.number, x.snapshot.unitName, x.snapshot.buyerName]
      .join(' ').toLowerCase().includes(q));
    return ok(list);
  }

  if (m === 'POST' && !seg[1]) {
    const unit = d.units.find((x) => x.id === body.unitId);
    if (!unit) throw fail(400, 'Pilih unit terlebih dahulu', { unitId:'Unit wajib dipilih' });
    const inv = d.invoices.find((i) => i.unitId === unit.id);
    if (!inv) throw fail(400, 'Unit ini belum terjual — BASTD dibuat setelah ada invoice', { unitId:'Belum ada pembeli' });

    const items = Array.isArray(body.items) ? body.items : [];
    const clean = [], seen = {};
    items.forEach((it) => {
      const key = String(it && it.key || '').toLowerCase();
      if (!seen[key] && key) { seen[key] = 1; clean.push({ key, number: String(it.number||'').slice(0,80) }); }
    });
    if (!clean.length) throw fail(400, 'Pilih minimal satu dokumen', { items:'Minimal satu dokumen' });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date||'')) ? body.date : todayISO();

    const nid = nextId('basdid','bastd');
    const now = new Date();
    const doc = {
      id: nid,
      number:'BASTD/' + now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' +
        String(parseInt(nid.split('-')[1],10)).padStart(4,'0'),
      date: date, unitId: unit.id, customerId: inv.customerId || null,
      type: clean.map((i) => i.key),
      items: clean,
      snapshot:{ unitCode:unit.code, unitName:unit.name, brand:unit.brand, year:unit.year,
        color:unit.color||'', nopol:unit.nopol||'', noRangka:unit.noRangka||'', noMesin:unit.noMesin||'',
        buyerName:inv.buyer?inv.buyer.name:'', buyerPhone:inv.buyer?inv.buyer.phone:'',
        buyerAddress:inv.buyer?inv.buyer.address:'' },
      note:String(body.note||'').slice(0,300),
      createdBy:me.name||me.username, createdById:me.id, createdAt:now.toISOString()
    };
    d.bastds.push(doc);

    /* BPKB diserahkan -> otomatis tandai SIAP */
    if (clean.some((i) => i.key === 'bpkb') && unit.bpkbDays) {
      unit.bpkbReady = true;
      unit.bpkbReadyAt = date;
    }
    persist();
    logAct(me,'bastd-buat',doc.number+' · '+unit.code+' · '+doc.type.join('/').toUpperCase());
    return ok({ bastd: doc }, 201);
  }

  if (seg[1] && m === 'DELETE') {
    if (me.role !== 'admin') throw fail(403, 'Hanya admin yang dapat menghapus BASTD');
    const bi = d.bastds.findIndex((x) => x.id === seg[1]);
    if (bi < 0) throw fail(404, 'BASTD tidak ditemukan');
    const rem = d.bastds.splice(bi, 1)[0]; persist();
    logAct(me,'bastd-hapus',rem.number);
    return ok({ ok:true });
  }
  throw fail(405, 'Metode tidak didukung');
}

/* ---------- Laporan ---------- */
function reportRoutes(seg, qs, me) {
  const d = load();
  if (!(me.role === 'admin' || me.role === 'owner')) throw fail(403, 'Hanya admin/pemilik yang dapat melihat laporan');
  const modal = (x) => calcTotals(x).modal;
  const BL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  if (seg[1] === 'summary') {
    const sold = d.units.filter((x) => x.status === 'terjual');
    const stock = d.units.filter((x) => x.status !== 'terjual');
    const revenue = d.invoices.reduce((s, i) => s + i.total, 0);
    const capitalSold = sold.reduce((s, x) => s + modal(x), 0);
    const ym = isoMonth(new Date());
    const invThis = d.invoices.filter((i) => (i.date || '').startsWith(ym));
    const unitByInv = {};
    d.units.forEach((x) => { if (x.invoiceId) unitByInv[x.invoiceId] = x; });
    const months = [];
    for (let k = 5; k >= 0; k--) {
      const dd = new Date(); dd.setDate(1); dd.setMonth(dd.getMonth() - k);
      const key = isoMonth(dd);
      const invs = d.invoices.filter((i) => (i.date || '').startsWith(key));
      let rev = 0, cap = 0;
      invs.forEach((i) => { rev += i.total;
        const uu = unitByInv[i.id]; if (uu) cap += modal(uu); });
      months.push({ key, label: BL[dd.getMonth()] + ' ' + String(dd.getFullYear()).slice(-2),
        sold: invs.length, revenue: rev, profit: rev - cap });
    }
    return ok({
      counts: { total: d.units.length,
        tersedia: stock.filter((x) => x.status === 'tersedia').length,
        booking: stock.filter((x) => x.status === 'booking').length,
        terjual: sold.length },
      stockValue: stock.reduce((s, x) => s + modal(x), 0),
      revenue, capitalSold, profit: revenue - capitalSold,
      month: { key: ym, invoices: invThis.length,
        revenue: invThis.reduce((s,i)=>s+i.total,0),
        profit: invThis.reduce((s,i)=>s+i.total,0) -
          invThis.reduce((s,i)=>{const uu=unitByInv[i.id];return s+(uu?modal(uu):0);},0) },
      months,
      avgMargin: sold.length ? Math.round(sold.reduce((s,x)=>s+calcTotals(x).margin,0)/sold.length*10)/10 : 0
    });
  }

/* @@E6@@ */

  if (seg[1] === 'commissions') {
    const month = qs.get('month') || isoMonth(new Date());
    const invs = d.invoices.filter((i) => (i.date || '').startsWith(month));
    const unitByInv = {};
    d.units.forEach((x) => { if (x.invoiceId) unitByInv[x.invoiceId] = x; });
    const agg = {};
    invs.forEach((i) => {
      let uu = d.users.find((x) => x.id === i.createdById);
      if (!uu) uu = d.users.find((x) => x.name === i.createdBy || x.username === i.createdBy);
      const key = uu ? uu.id : (i.createdBy || '-');
      const a = agg[key] = agg[key] || { userId: uu?uu.id:null,
        name: uu?uu.name:(i.createdBy||'(tidak dikenal)'), role: uu?uu.role:'-',
        komisiPersen: uu?(Number(uu.komisiPersen)||0):0,
        target: uu?(Number(uu.targetBulanan)||0):0, count:0, omzet:0, laba:0 };
      a.count++; a.omzet += i.total;
      const ux = unitByInv[i.id]; if (ux) a.laba += calcTotals(ux).profit;
    });
    const rows = Object.values(agg);
    rows.forEach((a) => { a.komisi = Math.round(a.laba * a.komisiPersen) / 100;
      a.pct = a.target ? Math.round(a.omzet / a.target * 1000) / 10 : null; });
    rows.sort((x, y) => y.omzet - x.omzet);
    return ok({ month, rows });
  }
  throw fail(404, 'Endpoint tidak ditemukan');
}

/* ---------- Pengguna ---------- */
function userRoutes(m, seg, qs, body, me) {
  const d = load();
  if (m === 'GET' && !seg[1]) return ok(d.users.map(publicUser));

  if (m === 'POST' && !seg[1]) {
    const username = String(body.username||'').trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(username)) throw fail(400,'Validasi gagal',{username:'Username 3–20 karakter'});
    if (d.users.some((x)=>x.username===username)) throw fail(400,'Validasi gagal',{username:'Username sudah dipakai'});
    if (!ROLES.includes(body.role)) throw fail(400,'Validasi gagal',{role:'Role tidak valid'});
    if (String(body.password||'').length < 5) throw fail(400,'Validasi gagal',{password:'Password minimal 5 karakter'});
    const u = { id: nextId('user','user'), username, name:String(body.name||'').trim(),
      role:body.role, pass:String(body.password), active: body.active !== false,
      komisiPersen: Number(body.komisiPersen)||0, targetBulanan:Number(body.targetBulanan)||0,
      createdAt:new Date().toISOString() };
    d.users.push(u); persist();
    logAct(me,'user-tambah',u.username+' ('+u.role+')');
    return ok(publicUser(u), 201);
  }

  const u = d.users.find((x) => x.id === seg[1]);
  if (!u) throw fail(404, 'Pengguna tidak ditemukan');

  if (m === 'PUT') {
    if (body.username && body.username !== u.username &&
        d.users.some((x)=>x.username===body.username)) throw fail(400,'Validasi gagal',{username:'Username sudah dipakai'});
    if (u.id === me.id) {
      if (body.role && body.role !== 'admin') throw fail(400,'Tidak dapat mengubah role akun sendiri');
      if (body.active === false) throw fail(400,'Tidak dapat menonaktifkan akun sendiri');
    }
    if (body.name) u.name = String(body.name).trim();
    if (body.username) u.username = String(body.username).trim().toLowerCase();
    if (body.role && ROLES.includes(body.role)) u.role = body.role;
    if (body.komisiPersen !== undefined) u.komisiPersen = Number(body.komisiPersen)||0;
    if (body.targetBulanan !== undefined) u.targetBulanan = Number(body.targetBulanan)||0;
    if (body.active !== undefined) u.active = !!body.active;
    if (body.password) {
      if (String(body.password).length < 5) throw fail(400,'Validasi gagal',{password:'Minimal 5 karakter'});
      u.pass = String(body.password);
    }
    persist(); logAct(me,'user-ubah',u.username);
    return ok(publicUser(u));
  }

  if (m === 'DELETE') {
    if (u.id === me.id) throw fail(400,'Tidak dapat menghapus akun sendiri');
    d.users.splice(d.users.indexOf(u),1); persist();
    logAct(me,'user-hapus',u.username);
    return ok({ ok:true });
  }
  throw fail(405, 'Metode tidak didukung');
}

/* ---------- Ekspor CSV ---------- */
function exportCsv(kind) {
  const d = load();
  const escC = (v) => { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const toCsv = (rows) => '\uFEFF' + rows.map((r) => r.map(escC).join(';')).join('\r\n');

  if (kind.indexOf('units') === 0) {
    const rows = [['Kode','Nama','Merek','Tipe','Tahun','KM','CC','Warna','Nopol','No Rangka','No Mesin',
      'Status','BPKB Due','BPKB Diambil','Pajak Due','Pembelian','Perbaikan','Dokumen','Total Modal','Harga Jual','Laba/Rugi']];
    [...d.units].sort((a,b)=>a.code.localeCompare(b.code)).forEach((u)=>{
      const t=calcTotals(u); const bp=calcBpkb(u);
      rows.push([u.code,u.name,u.brand,u.type,u.year,u.km,u.cc,u.color||'',u.nopol||'',
        u.noRangka||'',u.noMesin||'',u.status,bp?bp.due:'',bp&&bp.readyAt?bp.readyAt:'',u.pajakDue||'',
        t.purchase,t.repair,t.doc,t.modal,t.sellPrice,t.profit]);
    });
    return ok({ __csv: toCsv(rows), __filename:'stok-unit.csv' });
  }
  if (kind.indexOf('invoices') === 0) {
    const rows=[['No Invoice','Tanggal','Pelanggan','Unit','Nopol','Harga','Diskon','Total','Dibayar','Sisa','Lunas','Metode','Oleh']];
    [...d.invoices].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach((i)=>{
      const s=serializeInvoice(i);
      rows.push([s.number,s.date,s.buyer?s.buyer.name:'',s.snapshot?s.snapshot.name:'',
        s.snapshot?s.snapshot.nopol:'',s.sellPrice,s.discount,s.total,s.paid,s.sisa,
        s.lunas?'Ya':'Belum',s.paymentMethod,s.createdBy]);
    });
    return ok({ __csv: toCsv(rows), __filename:'invoice.csv' });
  }
  if (kind.indexOf('profit') === 0) {
    let sold=d.units.filter((x)=>x.status==='terjual');
    const rows=[['Kode','Motor','Terjual','Pembelian','Perbaikan','Dokumen','Total Modal','Harga Jual','Laba/Rugi','Margin %']];
    let tp=0,tr=0;
    [...sold].sort((a,b)=>(a.soldAt||'').localeCompare(b.soldAt||'')).forEach((u)=>{
      const t=calcTotals(u); tp+=t.profit; tr+=t.sellPrice;
      rows.push([u.code,u.name,u.soldAt||'',t.purchase,t.repair,t.doc,t.modal,t.sellPrice,t.profit,t.margin]);
    });
    rows.push(['TOTAL','','','','','','',tr,tp,'']);
    return ok({ __csv: toCsv(rows), __filename:'laba-rugi.csv' });
  }
  throw fail(404, 'Jenis ekspor tidak dikenal');
}

/* ---------- Ekspos LocalAPI ---------- */
window.LocalAPI = {
  mode: 'demo',
  async get(path)   { return this.req('GET', path, null); },
  async post(p, b)  { return this.req('POST', p, b); },
  async put(p, b)   { return this.req('PUT', p, b); },
  async patch(p, b) { return this.req('PATCH', p, b); },
  async del(p)      { return this.req('DELETE', p, null); },
  req(m, p, b) {
    const clean = p.split('?')[0].replace(/^\/api\/?/, '');
    const qs = new URLSearchParams(p.split('?')[1] || '');
    const seg = clean.split('/').filter(Boolean);
    try {
      const r = handle(m, seg, qs, b || {});
      return r.data;
    } catch (e) {
      if (e && e.status) throw e;
      throw Object.assign(new Error(e.message || 'Kesalahan demo'), { status:500, data:{} });
    }
  }
};

/* Host statis (mis. Netlify) → langsung pakai Mode Demo */
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
  window.API.use(window.LocalAPI);
}
})();
