/* ============================================================
   NuMo Showroom — SPA utama
   Login multi-role · unit & biaya · modal & laba/rugi ·
   invoice cetak · laporan · manajemen pengguna
============================================================ */
'use strict';

/* ---------- State global ---------- */
const S = {
  user: null,
  perm: {},
  page: null,
  units: [],
  invoices: []
};

const SHOP = {
  name: 'NUMOTORINDO',
  tagline: 'SHOWROOM MOTOR BEKAS TERPERCAYA',
  addr: 'Jl. Raya Industri No. 88, Jakarta Selatan · DKI Jakarta',
  phone: '(021) 555-0123 · 0812-9000-1234'
};

const ROLE_LABEL = { admin: 'Administrator', owner: 'Pemilik', sales: 'Sales', mekanik: 'Mekanik' };

/* ---------- Helper dasar ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtRp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
function parseRp(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; }

function todayISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
}

function monthLabel(key) {
  if (!key || key.length < 7) return key || '';
  const [y, m] = key.split('-');
  return BULAN[parseInt(m, 10) - 1] + ' ' + y;
}

/* Sapaan sesuai waktu */
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'Selamat Pagi';
  if (h >= 11 && h < 15) return 'Selamat Siang';
  if (h >= 15 && h < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}
function greetingEmoji() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return '☀️';
  if (h >= 11 && h < 15) return '🌤️';
  if (h >= 15 && h < 18) return '🌇';
  return '🌙';
}

function initials(name) {
  return String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

/* Terbilang rupiah (Indonesia) */
function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'nol';
  const a = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function t(x) {
    if (x < 12) return a[x];
    if (x < 20) return t(x - 10) + ' belas';
    if (x < 100) return a[Math.floor(x / 10)] + ' puluh' + (x % 10 ? ' ' + t(x % 10) : '');
    if (x < 200) return 'seratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 1000) return a[Math.floor(x / 100)] + ' ratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 2000) return 'seribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1e6) return t(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1e9) return t(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + t(x % 1e6) : '');
    if (x < 1e12) return t(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + t(x % 1e9) : '');
    return String(x);
  }
  return t(n);
}

/* ---------- Ikon SVG ---------- */
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  moto: '<circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M5.5 17.5H10l3-6h3.5M13 11.5 11 7H8.5M15 7h2.2l2 4.2"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z"/><path d="M9.5 8h5M9.5 12h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.8c2.7.4 4.7 2.3 4.7 5.2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16.5 15h1.5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};

function ic(name, size) {
  size = size || 18;
  return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
}

const LOGO_SVG = '<svg viewBox="0 0 64 64" fill="none"><circle cx="20" cy="43" r="8" fill="#FCBF49"/><circle cx="46" cy="43" r="8" fill="#fff"/><path d="M16 25l10-9h9l9 11-7 5h-9l-4 9" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- Toast ---------- */
function toast(msg, type) {
  type = type || 'info';
  const iconName = type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<span class="t-ico">' + ic(iconName, 20) + '</span><span>' + esc(msg) + '</span>';
  $('#toast-root').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 240);
  }, 3400);
}

/* ---------- Modal & konfirmasi ---------- */
function openModal(html, opts) {
  opts = opts || {};
  const ov = document.createElement('div');
  ov.className = 'overlay' + (opts.wide ? ' wide' : '');
  ov.innerHTML = '<div class="modal">' + html + '</div>';
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(ov); });
  document.body.appendChild(ov);
  document.body.classList.add('modal-open');
  $$('[data-close]', ov).forEach((b) => b.addEventListener('click', () => closeModal(ov)));
  return ov;
}

function closeModal(ov) {
  if (ov && ov.parentNode) ov.remove();
  else $$('.overlay').forEach((o) => o.remove());
  if (!$('.overlay')) document.body.classList.remove('modal-open');
}

function confirmDlg(title, msg) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (val) => { if (!done) { done = true; resolve(val); } };
    const ov = openModal(
      '<div class="m-head"><h3>' + esc(title) + '</h3><button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
      '<p class="confirm-msg">' + msg + '</p>' +
      '<div class="m-actions"><button class="btn ghost" data-close>Batal</button>' +
      '<button class="btn danger" id="cf-ok">Ya, Lanjutkan</button></div>'
    );
    $('#cf-ok', ov).addEventListener('click', () => { closeModal(ov); fin(true); });
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) fin(false); });
  });
}

/* Format otomatis input rupiah */
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input.rp')) {
    const digits = el.value.replace(/[^0-9]/g, '');
    el.value = digits ? Number(digits).toLocaleString('id-ID') : '';
  }
});

/* Tampilkan error validasi di form modal */
function showFieldErrors(ov, errors, alertEl) {
  if (!errors) return;
  Object.keys(errors).forEach((k) => {
    const inp = ov.querySelector('[name="' + k + '"]');
    if (inp) {
      inp.classList.add('err');
      let fe = inp.parentNode.querySelector('.field-err');
      if (!fe) { fe = document.createElement('div'); fe.className = 'field-err'; inp.parentNode.appendChild(fe); }
      fe.textContent = errors[k];
      fe.classList.add('show');
      inp.addEventListener('input', () => { inp.classList.remove('err'); fe.classList.remove('show'); }, { once: true });
    }
  });
  if (alertEl) {
    const firstKey = Object.keys(errors)[0];
    alertEl.textContent = errors[firstKey] || 'Periksa kembali isian Anda';
    alertEl.classList.remove('hidden');
  }
}

/* ============================================================
   Autentikasi & navigasi
============================================================ */
function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#app-view').classList.add('hidden');
}

async function doLogin(username, password) {
  const r = await API.post('/auth/login', { username, password });
  API.setToken(r.token);
  S.user = r.user;
  S.perm = r.permissions || {};
  bootApp();
}

async function init() {
  /* logo di semua tempat */
  $$('[data-logo]').forEach((el) => { el.innerHTML = LOGO_SVG; });

  /* form login */
  $$('.chip[data-u]').forEach((c) => c.addEventListener('click', () => {
    $('#lg-user').value = c.dataset.u;
    $('#lg-pass').value = c.dataset.p;
    $('#login-err').classList.add('hidden');
  }));
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#lg-btn'), errBox = $('#login-err');
    errBox.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Memproses…';
    try {
      await doLogin($('#lg-user').value.trim(), $('#lg-pass').value);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Masuk ke Dashboard';
    }
  });

  /* jam topbar + sapaan */
  setInterval(() => {
    const d = new Date();
    $('#clock').textContent = greetingEmoji() + ' ' + greeting() + ' · ' +
      d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }, 1000);

  if (API.token) {
    try {
      const r = await API.get('/auth/me');
      S.user = r.user;
      S.perm = r.permissions || {};
      bootApp();
      return;
    } catch (e) { /* token invalid → login */ }
  }
  showLogin();
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'units', label: 'Data Unit', icon: 'moto' },
  { key: 'invoices', label: 'Invoice', icon: 'receipt', show: () => S.user.role !== 'mekanik' },
  { key: 'reports', label: 'Laba Rugi', icon: 'chart', show: () => !!S.perm.viewReports },
  { key: 'users', label: 'Pengguna', icon: 'users', show: () => !!S.perm.manageUsers }
];

function bootApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');

  const u = S.user;
  $('#ub-name').textContent = u.name.split('(')[0].trim();
  $('#ub-role').textContent = ROLE_LABEL[u.role] || u.role;
  $('#ub-avatar').textContent = initials(u.name);
  $('#pc-name').textContent = u.name.split('(')[0].trim();
  $('#pc-role').textContent = ROLE_LABEL[u.role] || u.role;
  $('#pc-avatar').textContent = initials(u.name);
  $('#btn-logout').innerHTML = ic('logout', 18);

  /* menu sesuai role */
  const nav = $('#side-nav');
  const items = NAV.filter((n) => !n.show || n.show());
  nav.innerHTML = '';
  items.forEach((n) => {
    const b = document.createElement('button');
    b.className = 'nav-item';
    b.dataset.page = n.key;
    b.innerHTML = ic(n.icon, 19) + '<span>' + n.label + '</span>';
    b.addEventListener('click', () => go(n.key));
    nav.appendChild(b);
  });

  /* bottom navigation — tampilan mobile */
  const bnav = $('#bottom-nav');
  if (bnav) {
    bnav.innerHTML = '';
    items.forEach((n) => {
      const b = document.createElement('button');
      b.className = 'bnav-item';
      b.dataset.page = n.key;
      b.innerHTML = '<span class="bnav-ico">' + ic(n.icon, 19) + '</span><span class="bnav-lbl">' + n.label + '</span>';
      b.addEventListener('click', () => go(n.key));
      bnav.appendChild(b);
    });
  }

  $('#btn-logout').addEventListener('click', async () => {
    if (!(await confirmDlg('Keluar Aplikasi?', 'Anda akan keluar dari sesi ini.'))) return;
    try { await API.post('/auth/logout'); } catch (e) {}
    API.setToken(null);
    location.reload();
  });

  const burger = $('#btn-burger');
  burger.innerHTML = ic('menu', 20);
  const setBurgerIcon = () => {
    burger.innerHTML = ic($('#sidebar').classList.contains('open') ? 'x' : 'menu', 20);
  };
  burger.addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#side-backdrop').classList.toggle('show');
    setBurgerIcon();
  });
  $('#side-backdrop').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#side-backdrop').classList.remove('show');
    setBurgerIcon();
  });

  /* ciut/buka sidebar (desktop) — responsif */
  const COLLAPSE_BREAK = 1180; // di bawah lebar ini sidebar otomatis jadi icon rail
  let sideManual = 0;          // waktu toggle manual terakhir
  const appView = $('#app-view');
  const pcBtn = $('#btn-side-pc');
  const isMobileW = () => window.innerWidth < 900;

  const applyCol = () => {
    const col = appView.classList.contains('side-collapsed');
    if (pcBtn) {
      pcBtn.innerHTML = ic(col ? 'chevR' : 'chevL', 20);
      pcBtn.title = col ? 'Buka sidebar' : 'Ciutkan sidebar';
    }
  };
  const setCol = (on) => {
    appView.classList.toggle('side-collapsed', on);
    if (on) localStorage.setItem('sm_side_collapsed', '1');
    else localStorage.removeItem('sm_side_collapsed');
    applyCol();
  };
  const toggleSide = () => {
    sideManual = Date.now();
    setCol(!appView.classList.contains('side-collapsed'));
  };
  const syncSide = () => {
    if (isMobileW()) { setCol(false); return; }
    if (Date.now() - sideManual < 2500) return; // hormati aksi manual terakhir
    const pref = localStorage.getItem('sm_side_collapsed') === '1';
    setCol(pref || window.innerWidth < COLLAPSE_BREAK);
  };

  if (pcBtn) pcBtn.addEventListener('click', toggleSide);
  syncSide();
  window.addEventListener('resize', syncSide);

  go('dashboard');
}

function closeSidebarMobile() {
  $('#sidebar').classList.remove('open');
  $('#side-backdrop').classList.remove('show');
  const b = $('#btn-burger');
  if (b && !$('#sidebar').classList.contains('open')) b.innerHTML = ic('menu', 20);
}

function go(page) {
  S.page = page;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  $$('.bnav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  const titles = {
    dashboard: ['Dashboard', 'Ringkasan showroom hari ini'],
    units: ['Data Unit', 'Stok motor, biaya & total modal'],
    invoices: ['Invoice Penjualan', 'Buat, cetak & kelola invoice'],
    reports: ['Laporan Laba Rugi', 'Performa penjualan & profitabilitas'],
    users: ['Manajemen Pengguna', 'Akun, role & hak akses']
  };
  const t = titles[page] || [page, ''];
  $('#pg-title').textContent = t[0];
  $('#pg-sub').textContent = t[1];
  closeSidebarMobile();
  const pages = { dashboard: pageDashboard, units: pageUnits, invoices: pageInvoices, reports: pageReports, users: pageUsers };
  (pages[page] || pageDashboard)();
}

/* ============================================================
   Halaman: Dashboard
============================================================ */
async function pageDashboard() {
  const c = $('#content');
  c.innerHTML = '<div class="empty-state"><p>Memuat data…</p></div>';

  let summary = null;
  const jobs = [API.get('/units'), API.get('/invoices').catch(() => [])];
  if (S.perm.viewReports) jobs.push(API.get('/reports/summary'));
  try {
    const res = await Promise.all(jobs);
    S.units = res[0];
    S.invoices = res[1];
    summary = res[2] || null;
  } catch (err) {
    c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>';
    return;
  }

  const cnt = summary ? summary.counts : {
    tersedia: S.units.filter((u) => u.status === 'tersedia').length,
    booking: S.units.filter((u) => u.status === 'booking').length,
    terjual: S.units.filter((u) => u.status === 'terjual').length
  };

  /* kartu statistik sesuai role */
  const cards = [];
  cards.push(['navy', 'grid', cnt.tersedia, 'Unit Tersedia']);
  cards.push(['orange', 'menu', cnt.booking, 'Unit Booking']);
  cards.push(['red', 'check', cnt.terjual, 'Unit Terjual']);
  if (S.perm.viewReports && summary) {
    cards.push(['yellow', 'wallet', fmtRp(summary.stockValue), 'Nilai Modal Stok']);
    cards.push(['green', 'chart', fmtRp(summary.profit), 'Laba Terealisasi']);
    if (summary.month.invoices) cards.push(['orange', 'receipt', fmtRp(summary.month.revenue), 'Omzet Bulan Ini']);
  }
  if (S.user.role === 'mekanik') {
    const nowKey = todayISO().slice(0, 7);
    const repairThisMonth = S.units.reduce((s, u) => s + (u.repairCosts || [])
      .filter((x) => (x.date || '').startsWith(nowKey))
      .reduce((a, x) => a + x.amount, 0), 0);
    cards.push(['yellow', 'wrench', fmtRp(repairThisMonth), 'Perbaikan Bulan Ini']);
  }

  /* aksi cepat */
  let quick = '<div class="quick-actions">';
  if (S.perm.manageUnits) quick += '<button class="btn primary" data-qa="unit">' + ic('plus', 16) + ' Tambah Unit</button>';
  if (S.perm.sell) quick += '<button class="btn navy" data-qa="inv">' + ic('receipt', 16) + ' Buat Invoice</button>';
  if (S.perm.viewReports) quick += '<button class="btn ghost" data-qa="rep">' + ic('chart', 16) + ' Lihat Laporan</button>';
  if (S.perm.editRepairs) quick += '<span class="badge role mekanik">Mode Mekanik — input biaya perbaikan dari detail unit</span>';
  quick += '</div>';

  c.innerHTML =
    '<h2 style="color:var(--navy);margin-bottom:6px"><span class="greet-emoji">' + greetingEmoji() + '</span> ' + greeting() + ', ' + esc(S.user.name.split('(')[0].trim()) + ' 👋</h2>' +
    '<p style="color:var(--muted);font-size:.9rem;margin-bottom:20px">' + (ROLE_LABEL[S.user.role] || '') + ' · Berikut ringkasan showroom Anda.</p>' +
    quick +
    '<div class="stats">' + cards.map(([col, icon, val, lbl]) =>
      '<div class="stat-card"><div class="stat-ico ' + col + '">' + ic(icon, 22) + '</div>' +
      '<div><div class="stat-val num">' + (typeof val === 'string' ? esc(val) : val) + '</div>' +
      '<div class="stat-lbl">' + esc(lbl) + '</div></div></div>').join('') + '</div>' +
    '<div class="grid-2">' +
      unitRecentHTML() +
      invoiceRecentHTML() +
    '</div>';

  $$('[data-qa]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.qa;
    if (act === 'unit') unitForm(null);
    else if (act === 'inv') invoiceCreate();
    else if (act === 'rep') go('reports');
  }));
}

function unitRecentHTML() {
  const rows = S.units.slice(0, 5).map((u) =>
    '<tr data-detail="' + u.id + '" style="cursor:pointer">' +
    '<td><span class="mono">' + esc(u.code) + '</span></td>' +
    '<td><div class="cell-main">' + esc(u.name) + '</div><div class="cell-sub">' + esc(u.brand) + ' · ' + u.year + '</div></td>' +
    '<td>' + statusBadge(u.status) + '</td>' +
    '<td style="text-align:right"><b class="num">' + fin(u.totals && u.totals.sellPrice != null ? fmtRp(u.totals.sellPrice) : '•••') + '</b></td>' +
    '</tr>').join('');
  return '<div class="card"><h3>' + ic('moto') + ' Unit Terbaru</h3>' +
    '<div class="table-wrap" style="box-shadow:none;border:none"><table class="data" style="min-width:420px">' +
    '<thead><tr><th>Kode</th><th>Motor</th><th>Status</th><th style="text-align:right">Harga Jual</th></tr></thead>' +
    '<tbody>' + (rows || emptyRow(4)) + '</tbody></table></div></div>';
}

function invoiceRecentHTML() {
  if (S.user.role === 'mekanik') return '';
  const rows = S.invoices.slice(0, 5).map((i) =>
    '<tr><td><span class="mono">' + esc(i.number) + '</span></td>' +
    '<td><div class="cell-main">' + esc(i.buyer.name) + '</div><div class="cell-sub">' + esc(i.snapshot.name) + '</div></td>' +
    '<td>' + fmtDate(i.date) + '</td>' +
    '<td style="text-align:right"><b class="num">' + fmtRp(i.total) + '</b></td>' +
    '</tr>').join('');
  return '<div class="card"><h3>' + ic('receipt') + ' Invoice Terbaru</h3>' +
    '<div class="table-wrap" style="box-shadow:none;border:none"><table class="data" style="min-width:420px">' +
    '<thead><tr><th>No.</th><th>Pembeli</th><th>Tanggal</th><th style="text-align:right">Total</th></tr></thead>' +
    '<tbody>' + (rows || emptyRow(4)) + '</tbody></table></div></div>';
}

function emptyRow(cols) { return '<tr><td colspan="' + cols + '" style="text-align:center;color:var(--muted);padding:26px">Belum ada data</td></tr>'; }

function statusBadge(st) { return '<span class="badge ' + esc(st) + '">' + esc(st.charAt(0).toUpperCase() + st.slice(1)) + '</span>'; }
function fin(x) { return x; }

/* ============================================================
   Halaman: Data Unit
============================================================ */
async function pageUnits() {
  const c = $('#content');
  c.innerHTML = '<div class="empty-state"><p>Memuat data…</p></div>';
  try {
    S.units = await API.get('/units');
  } catch (err) {
    c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>';
    return;
  }

  const isMek = S.user.role === 'mekanik';
  const showFin = !isMek;

  c.innerHTML =
    '<div class="toolbar">' +
      '<div class="search-box">' + ic('search') + '<input id="u-q" type="text" placeholder="Cari kode, nama, merek, nopol…"></div>' +
      '<select id="u-status" class="filter">' +
        '<option value="">Semua Status</option><option value="tersedia">Tersedia</option>' +
        '<option value="booking">Booking</option><option value="terjual">Terjual</option></select>' +
      (S.perm.manageUnits ? '<button class="btn primary" id="btn-add-unit">' + ic('plus', 16) + ' Tambah Unit</button>' : '') +
    '</div>' +
    '<div id="u-table"></div>';

  function render() {
    const q = ($('#u-q').value || '').toLowerCase();
    const st = $('#u-status').value;
    let list = S.units;
    if (st) list = list.filter((x) => x.status === st);
    if (q) list = list.filter((x) => [x.code, x.name, x.brand, x.nopol, String(x.year)].join(' ').toLowerCase().includes(q));

    let head = '<tr><th>Kode</th><th>Motor</th><th>Nopol</th>';
    if (showFin) head += '<th style="text-align:right">Total Modal</th><th style="text-align:right">Harga Jual</th>';
    head += '<th>Status</th>';
    if (showFin) head += '<th style="text-align:right">Laba / Rugi</th>';
    head += '<th style="text-align:right">Aksi</th></tr>';

    const rows = list.map((u) => {
      const t = u.totals || {};
      let row = '<tr data-detail="' + u.id + '" style="cursor:pointer">' +
        '<td><span class="mono">' + esc(u.code) + '</span></td>' +
        '<td><div class="cell-main">' + esc(u.name) + '</div><div class="cell-sub">' + esc(u.brand) + ' · ' + u.year + ' · ' + u.cc + 'cc · ' + (u.km || 0).toLocaleString('id-ID') + ' km</div></td>' +
        '<td>' + esc(u.nopol || '—') + '</td>';
      if (showFin) {
        row += '<td style="text-align:right" class="num"><b>' + fmtRp(t.modal) + '</b>' +
          '<div class="cell-sub num">Beli ' + fmtRp(t.purchase) + ' + Perbaikan ' + fmtRp(t.repair) + ' + Dokumen ' + fmtRp(t.doc) + '</div></td>' +
          '<td style="text-align:right" class="num"><b>' + (t.sellPrice != null ? fmtRp(t.sellPrice) : '•••') + '</b></td>';
      }
      row += '<td>' + statusBadge(u.status) + '</td>';
      if (showFin) {
        const cls = t.profit >= 0 ? 'up' : 'down';
        const sign = t.profit >= 0 ? '+' : '';
        row += '<td style="text-align:right"><span class="profit-chip ' + cls + ' num">' + sign + fmtRp(t.profit).replace('Rp ', '') +
          '</span><div class="cell-sub num">' + (t.margin != null ? t.margin + '% margin' : '') + '</div></td>';
      }
      row += '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="detail" data-id="' + u.id + '" title="Detail">' + ic('eye', 17) + '</button>' +
        (S.perm.manageUnits ? '<button class="icon-btn" data-act="edit" data-id="' + u.id + '" title="Edit">' + ic('pencil', 16) + '</button>' +
        '<button class="icon-btn red" data-act="del" data-id="' + u.id + '" title="Hapus">' + ic('trash', 16) + '</button>' : '') +
        '</div></td></tr>';
      return row;
    }).join('');

    $('#u-table').innerHTML =
      '<div class="table-wrap"><table class="data"><thead>' + head + '</thead><tbody>' +
      (rows || emptyRow(showFin ? 7 : 4)) + '</tbody></table></div>';

    $$('tr[data-detail]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      unitDetail(tr.dataset.detail);
    }));
    $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.id, act = b.dataset.act;
      if (act === 'detail') unitDetail(id);
      if (act === 'edit') unitForm(S.units.find((x) => x.id === id));
      if (act === 'del') {
        const u = S.units.find((x) => x.id === id);
        if (!(await confirmDlg('Hapus Unit?', 'Unit <b>' + esc(u.code) + ' — ' + esc(u.name) + '</b> beserta catatan biayanya akan dihapus permanen.'))) return;
        try { await API.del('/units/' + id); toast('Unit dihapus', 'ok'); pageUnits(); }
        catch (err) { toast(err.message, 'err'); }
      }
    }));
  }

  $('#u-q').addEventListener('input', render);
  $('#u-status').addEventListener('change', render);
  const addBtn = $('#btn-add-unit');
  if (addBtn) addBtn.addEventListener('click', () => unitForm(null));
  render();
}

/* ---------- Form tambah / edit unit ---------- */
/* Kotak input dinamis biaya perbaikan & dokumen */
function costBoxHTML(kind, items) {
  const d = kind === 'repair' ? { title: 'Biaya Perbaikan', icon: 'wrench' } : { title: 'Biaya Dokumen', icon: 'doc' };
  const total = (items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return '<div class="cost-form-box" data-cf="' + kind + '">' +
    '<div class="box-head"><h4>' + ic(d.icon, 15) + ' ' + d.title + '</h4>' +
    '<button type="button" class="btn ghost sm" data-add-cost="' + kind + '">' + ic('plus', 13) + ' Tambah</button></div>' +
    '<div class="cfw-rows">' +
      ((items && items.length) ? items.map((x) => costRowHTML(kind, x)).join('') : '<p class="cfw-empty">Belum ada biaya.</p>') +
    '</div>' +
    '<div class="cost-total-row"><span>Total</span><strong class="num cfw-total">' + fmtRp(total) + '</strong></div>' +
  '</div>';
}

function costRowHTML(kind, cost) {
  return '<div class="cfw-row">' +
    '<input type="text" class="cfw-desc" placeholder="' + (kind === 'repair' ? 'mis. Ganti kampas rem…' : 'mis. Balik nama Samsat…') + '" value="' + esc(cost ? cost.desc : '') + '">' +
    '<input type="text" class="cfw-amt rp" inputmode="numeric" placeholder="Nominal Rp" value="' + (cost ? Number(cost.amount).toLocaleString('id-ID') : '') + '">' +
    '<input type="date" class="cfw-date" value="' + (cost ? cost.date : todayISO()) + '">' +
    '<button type="button" class="icon-btn red" data-rm-cf title="Hapus baris">' + ic('trash', 15) + '</button>' +
  '</div>';
}

function addCostRow(box, cost) {
  const empty = box.querySelector('.cfw-empty');
  if (empty) empty.remove();
  const wrap = document.createElement('div');
  wrap.innerHTML = costRowHTML(box.dataset.cf, cost);
  const row = wrap.firstElementChild;
  box.querySelector('.cfw-rows').appendChild(row);
  row.querySelector('[data-rm-cf]').addEventListener('click', () => removeCostRow(box, row));
  updateCostBoxTotal(box);
}

function removeCostRow(box, row) {
  row.remove();
  if (!box.querySelector('.cfw-row')) {
    box.querySelector('.cfw-rows').innerHTML = '<p class="cfw-empty">Belum ada biaya.</p>';
  }
  updateCostBoxTotal(box);
}

function updateCostBoxTotal(box) {
  const total = $$('.cfw-row', box).reduce((s, r) => s + parseRp($('.cfw-amt', r).value), 0);
  const el = box.querySelector('.cfw-total');
  if (el) el.textContent = fmtRp(total);
}

function collectCostRows(box) {
  if (!box) return [];
  return $$('.cfw-row', box).map((r) => {
    const desc = ($('.cfw-desc', r).value || '').trim();
    const amount = parseRp($('.cfw-amt', r).value);
    const date = $('.cfw-date', r).value;
    return { desc, amount, date };
  }).filter((x) => x.desc || x.amount);
}

function unitForm(unit) {
  const isEdit = !!unit;
  const ov = openModal(
    '<div class="m-head"><div><h3>' + (isEdit ? 'Edit Unit ' + esc(unit.code) : 'Tambah Unit Baru') + '</h3>' +
    '<p class="m-sub">Isi data unit, pilih status, serta biaya perbaikan &amp; dokumen (boleh banyak baris).</p></div>' +
    '<button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<form id="uf-form">' +
    '<div class="alert error hidden" id="uf-err"></div>' +
    '<label>Nama Motor *</label><input name="name" value="' + esc(isEdit ? unit.name : '') + '" placeholder="mis. Honda Beat Sporty FI">' +
    '<div class="form-grid">' +
      '<div><label>Merek *</label><input name="brand" value="' + esc(isEdit ? unit.brand : '') + '" placeholder="Honda / Yamaha / …" list="brand-list"><datalist id="brand-list"><option>Honda</option><option>Yamaha</option><option>Suzuki</option><option>Kawasaki</option><option>TVS</option></datalist></div>' +
      '<div><label>Tipe</label><input name="type" value="' + esc(isEdit ? (unit.type || '') : '') + '" placeholder="Skutik / Sport / Bebek"></div>' +
      '<div><label>Tahun *</label><input name="year" type="number" value="' + (isEdit ? unit.year : '') + '" placeholder="2020" min="1980" max="' + (new Date().getFullYear() + 1) + '"></div>' +
      '<div><label>Kilometer *</label><input name="km" type="number" value="' + (isEdit ? unit.km : '') + '" placeholder="15000" min="0"></div>' +
      '<div><label>CC *</label><input name="cc" type="number" value="' + (isEdit ? unit.cc : '') + '" placeholder="110" min="50" max="2000"></div>' +
      '<div><label>Warna</label><input name="color" value="' + esc(isEdit ? (unit.color || '') : '') + '" placeholder="Merah"></div>' +
      '<div><label>No. Polisi</label><input name="nopol" value="' + esc(isEdit ? (unit.nopol || '') : '') + '" placeholder="B 1234 XYZ" style="text-transform:uppercase"></div>' +
      '<div><label>Transmisi</label><input name="transmisi" value="' + esc(isEdit ? (unit.transmisi || '') : '') + '" placeholder="Otomatis / Manual"></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div><label>Biaya Pembelian Unit (Rp) *</label><input name="purchaseCost" class="rp" inputmode="numeric" value="' + (isEdit && unit.purchaseCost != null ? Number(unit.purchaseCost).toLocaleString('id-ID') : '') + '" placeholder="0"></div>' +
      '<div><label>Tanggal Pembelian</label><input name="purchaseDate" type="date" value="' + (isEdit ? (unit.purchaseDate || todayISO()) : todayISO()) + '"></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div><label>Harga Jual Rencana (Rp)</label><input name="sellPrice" class="rp" inputmode="numeric" value="' + (isEdit && unit.sellPrice != null ? Number(unit.sellPrice).toLocaleString('id-ID') : '') + '" placeholder="0"></div>' +
      '<div><label>Status Unit</label><select name="status">' +
        '<option value="tersedia"' + ((!isEdit || unit.status === 'tersedia') ? ' selected' : '') + '>Tersedia</option>' +
        '<option value="booking"' + (isEdit && unit.status === 'booking' ? ' selected' : '') + '>Booking</option>' +
        '<option value="terjual"' + (isEdit && unit.status === 'terjual' ? ' selected' : '') + '>Terjual</option>' +
      '</select></div>' +
    '</div>' +
    costBoxHTML('repair', isEdit ? (unit.repairCosts || []) : []) +
    costBoxHTML('doc', isEdit ? (unit.docCosts || []) : []) +
    '<label>Catatan Kondisi</label><textarea name="notes" placeholder="Catatan kondisi unit…">' + esc(isEdit ? (unit.notes || '') : '') + '</textarea>' +
    '<div class="m-actions">' +
      '<button type="button" class="btn ghost" data-close>Batal</button>' +
      '<button type="submit" class="btn primary">' + (isEdit ? 'Simpan Perubahan' : 'Tambah Unit') + '</button>' +
    '</div></form>',
    { wide: true }
  );

  /* aktifkan baris biaya dinamis (perbaikan & dokumen) */
  $$('.cost-form-box', ov).forEach((box) => {
    const kind = box.dataset.cf;
    $$('[data-rm-cf]', box).forEach((b) => b.addEventListener('click', () => removeCostRow(box, b.closest('.cfw-row'))));
    box.addEventListener('input', (e) => { if (e.target.classList.contains('cfw-amt')) updateCostBoxTotal(box); });
    $('[data-add-cost="' + kind + '"]', box).addEventListener('click', () => addCostRow(box, null));
  });

  $('#uf-form', ov).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      name: f.name.value.trim(), brand: f.brand.value.trim(), type: f.type.value.trim(),
      year: f.year.value, km: f.km.value, cc: f.cc.value,
      color: f.color.value.trim(), nopol: f.nopol.value.trim(), transmisi: f.transmisi.value.trim(),
      purchaseCost: parseRp(f.purchaseCost.value), purchaseDate: f.purchaseDate.value,
      sellPrice: parseRp(f.sellPrice.value),
      status: f.status.value,
      repairCosts: collectCostRows($('[data-cf="repair"]', ov)),
      docCosts: collectCostRows($('[data-cf="doc"]', ov)),
      notes: f.notes.value.trim()
    };
    try {
      if (isEdit) await API.put('/units/' + unit.id, body);
      else await API.post('/units', body);
      closeModal(ov);
      toast(isEdit ? 'Perubahan tersimpan' : 'Unit berhasil ditambahkan', 'ok');
      go(S.page);
    } catch (err) {
      showFieldErrors(ov, err.data && err.data.errors, $('#uf-err', ov));
      if (!err.data || !err.data.errors) toast(err.message, 'err');
    }
  });
}

/* ============================================================
   Detail Unit — tabs: info, perbaikan, dokumen, ringkasan
============================================================ */
async function unitDetail(id) {
  let u;
  try { u = await API.get('/units/' + id); }
  catch (err) { toast(err.message, 'err'); return; }

  const isMek = S.user.role === 'mekanik';
  const t = u.totals || {};
  const canRepair = !!S.perm.editRepairs;
  const canDocs = !!S.perm.editDocs;

  const tabsDef = [{ key: 'info', label: 'Data Unit' }, { key: 'repair', label: 'Biaya Perbaikan' }];
  if (!isMek) {
    tabsDef.push({ key: 'doc', label: 'Biaya Dokumen' });
    tabsDef.push({ key: 'sum', label: 'Ringkasan Modal & Laba' });
  }

  const ov = openModal(
    '<div class="m-head"><div>' +
      '<h3>' + esc(u.name) + '</h3>' +
      '<p class="m-sub"><span class="mono">' + esc(u.code) + '</span> · ' + esc(u.brand) + ' ' + u.year +
      (u.nopol ? ' · ' + esc(u.nopol) : '') + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:8px">' + statusBadge(u.status) +
      '<button class="icon-btn" data-close>' + ic('x') + '</button></div></div>' +
    '<div class="tabs" id="ud-tabs">' +
      tabsDef.map((x, i) => '<button class="tab' + (i === 0 ? ' active' : '') + '" data-tab="' + x.key + '">' + x.label + '</button>').join('') +
    '</div><div class="tab-body" id="ud-body"></div>',
    { wide: true }
  );

  function renderTab(key) {
    $$('#ud-tabs .tab', ov).forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
    const body = $('#ud-body', ov);

    if (key === 'info') {
      body.innerHTML =
        '<div class="info-grid">' +
        infoItem('Merek / Tipe', esc(u.brand) + ' · ' + esc(u.type || '—')) +
        infoItem('Tahun', u.year) +
        infoItem('CC / Transmisi', u.cc + 'cc · ' + esc(u.transmisi || '—')) +
        infoItem('Kilometer', (u.km || 0).toLocaleString('id-ID') + ' km') +
        infoItem('Warna', esc(u.color || '—')) +
        infoItem('No. Polisi', esc(u.nopol || '—')) +
        (!isMek ? infoItem('Tanggal Beli', fmtDate(u.purchaseDate)) : '') +
        (!isMek && u.status === 'terjual' ? infoItem('Terjual', fmtDate(u.soldAt)) : '') +
        '</div>' +
        (u.notes ? '<label style="margin-top:18px">Catatan</label><p style="font-size:.9rem;color:var(--muted);line-height:1.6">' + esc(u.notes) + '</p>' : '') +
        (S.perm.manageUnits ? '<div class="m-actions"><button class="btn navy sm" id="ud-edit">' + ic('pencil', 15) + ' Edit Data Unit</button></div>' : '');
      if (S.perm.manageUnits) $('#ud-edit', ov).addEventListener('click', () => { closeModal(ov); unitForm(u); });
      return;
    }

    if (key === 'repair' || key === 'doc') renderCostTab(ov, u, key, body, canRepair, canDocs, (r) => Object.assign(u, r));
    else renderSumTab(body, t, u);
  }

  $$('#ud-tabs .tab', ov).forEach((b) => b.addEventListener('click', () => renderTab(b.dataset.tab)));
  renderTab('info');
}

function infoItem(k, v) { return '<div class="info-item"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
function sbar(label, val, widthPct, color) {
  return '<div class="sbar"><div class="top"><b>' + label + '</b><span class="num">' + fmtRp(val) + '</span></div>' +
    '<div class="track"><div class="fill ' + color + '" style="width:' + widthPct + '%"></div></div></div>';
}
function sumBox(k, v, cls) { return '<div class="sum-box ' + cls + '"><div class="k">' + k + '</div><div class="v num">' + v + '</div></div>'; }

function renderCostTab(ov, u, key, body, canRepair, canDocs, onUpdated) {
  const isRepair = key === 'repair';
  const list = isRepair ? (u.repairCosts || []) : (u.docCosts || []);
  const canAdd = isRepair ? canRepair : canDocs;
  const total = list.reduce((s, x) => s + x.amount, 0);

  body.innerHTML =
    '<div class="cost-list">' +
    (list.map((x) =>
      '<div class="cost-row">' +
      '<div class="cost-ico ' + (isRepair ? 'repair' : 'doc') + '">' + ic(isRepair ? 'wrench' : 'doc', 16) + '</div>' +
      '<div class="cost-info"><strong>' + esc(x.desc) + '</strong><span>' + fmtDate(x.date) + '</span></div>' +
      '<span class="cost-amt num">' + fmtRp(x.amount) + '</span>' +
      (canAdd ? '<button class="icon-btn red" data-del-cost="' + x.id + '" title="Hapus biaya">' + ic('trash', 15) + '</button>' : '') +
      '</div>').join('') ||
      '<p style="color:var(--muted);padding:14px 4px;font-size:.88rem">Belum ada biaya ' + (isRepair ? 'perbaikan' : 'dokumen') + ' dicatat.</p>') +
    '</div>' +
    (canAdd ?
      '<form class="cost-add-form" id="cf-form-' + key + '">' +
      '<input type="text" name="desc" placeholder="' + (isRepair ? 'mis. Ganti kampas rem…' : 'mis. Balik nama Samsat…') + '">' +
      '<input type="text" class="rp" name="amount" inputmode="numeric" placeholder="Nominal Rp">' +
      '<input type="date" name="date" value="' + todayISO() + '">' +
      '<button type="submit" class="btn primary sm">' + ic('plus', 14) + ' Tambah</button>' +
      '</form>' : '') +
    '<div class="cost-total-row"><span>Total Biaya ' + (isRepair ? 'Perbaikan' : 'Dokumen') + '</span><strong class="num">' + fmtRp(total) + '</strong></div>';

  if (canAdd) {
    $('#cf-form-' + key, ov).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const r = await API.post('/units/' + u.id + '/costs', {
          type: isRepair ? 'perbaikan' : 'dokumen',
          desc: f.desc.value.trim(), amount: parseRp(f.amount.value), date: f.date.value
        });
        onUpdated(r);
        toast('Biaya ditambahkan', 'ok');
        renderCostTab(ov, u, key, body, canRepair, canDocs, onUpdated);
      } catch (err) { toast(err.message, 'err'); }
    });
  }
  $$('[data-del-cost]', ov).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDlg('Hapus Biaya?', 'Item biaya ini akan dihapus dari perhitungan modal.'))) return;
    try {
      const r = await API.del('/units/' + u.id + '/costs/' + b.dataset.delCost);
      onUpdated(r);
      toast('Biaya dihapus', 'ok');
      renderCostTab(ov, u, key, body, canRepair, canDocs, onUpdated);
    } catch (err) { toast(err.message, 'err'); }
  }));
}

function renderSumTab(body, t, u) {
  const totalAll = Math.max(t.modal || 0, 1);
  const pct = (v) => Math.max(2, Math.round((v / totalAll) * 100));
  body.innerHTML =
    '<div class="sum-hero"><div class="big num">' + fmtRp(t.modal) + '</div><div class="lbl">Total Modal (' + esc(u.code) + ')</div></div>' +
    '<div class="sum-bars">' +
      sbar('Biaya Pembelian', t.purchase, pct(t.purchase), 'navy') +
      sbar('Biaya Perbaikan', t.repair, pct(t.repair), 'orange') +
      sbar('Biaya Dokumen', t.doc, pct(t.doc), 'yellow') +
    '</div>' +
    '<div class="sum-grid">' +
      sumBox('Harga Jual', t.sellPrice != null ? fmtRp(t.sellPrice) : '•••', '') +
      sumBox('Margin', (t.margin != null ? t.margin : 0) + '%', '') +
      '<div class="sum-box ' + (t.profit >= 0 ? 'profit-pos' : 'profit-neg') + '"><div class="k">' + (t.profit >= 0 ? 'Estimasi Laba' : 'Rugi') + '</div>' +
      '<div class="v num">' + (t.profit >= 0 ? '+ ' : '- ') + fmtRp(Math.abs(t.profit)).replace('Rp ', '') + '</div></div>' +
      '<div class="sum-box"><div class="k">Status</div><div class="v">' + statusBadge(u.status) + '</div></div>' +
    '</div>';
}

/* ============================================================
   Halaman: Invoice
============================================================ */
async function pageInvoices() {
  const c = $('#content');
  c.innerHTML = '<div class="empty-state"><p>Memuat data…</p></div>';
  try {
    S.invoices = await API.get('/invoices');
  } catch (err) {
    c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>';
    return;
  }

  const canDelete = !!S.perm.manageUsers; /* hanya admin */
  c.innerHTML =
    '<div class="toolbar">' +
      '<div class="search-box">' + ic('search') + '<input id="i-q" type="text" placeholder="Cari nomor invoice, pembeli, motor…"></div>' +
      (S.perm.sell ? '<button class="btn primary" id="btn-add-inv">' + ic('plus', 16) + ' Buat Invoice</button>' : '') +
    '</div><div id="i-table"></div>';

  function render() {
    const q = ($('#i-q').value || '').toLowerCase();
    let list = S.invoices;
    if (q) list = list.filter((x) => [x.number, x.buyer && x.buyer.name, x.snapshot && x.snapshot.name].join(' ').toLowerCase().includes(q));

    const rows = list.map((i) =>
      '<tr data-print="' + i.id + '" style="cursor:pointer">' +
      '<td><span class="mono">' + esc(i.number) + '</span></td>' +
      '<td><div class="cell-main">' + esc(i.snapshot.name) + '</div><div class="cell-sub">' + esc(i.snapshot.nopol || '—') + '</div></td>' +
      '<td><div class="cell-main">' + esc(i.buyer.name) + '</div><div class="cell-sub">' + esc(i.buyer.phone || '') + '</div></td>' +
      '<td>' + fmtDate(i.date) + '</td>' +
      '<td><span class="badge role sales" style="text-transform:capitalize">' + esc(i.paymentMethod) + '</span></td>' +
      '<td style="text-align:right"><b class="num">' + fmtRp(i.total) + '</b></td>' +
      '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="print" data-id="' + i.id + '" title="Cetak">' + ic('printer', 17) + '</button>' +
        (canDelete ? '<button class="icon-btn red" data-act="del" data-id="' + i.id + '" title="Hapus (admin)">' + ic('trash', 16) + '</button>' : '') +
      '</div></td></tr>').join('');

    $('#i-table').innerHTML =
      '<div class="table-wrap"><table class="data">' +
      '<thead><tr><th>No. Invoice</th><th>Motor</th><th>Pembeli</th><th>Tanggal</th><th>Pembayaran</th><th style="text-align:right">Total</th><th style="text-align:right">Aksi</th></tr></thead>' +
      '<tbody>' + (rows || emptyRow(7)) + '</tbody></table></div>';

    $$('tr[data-print]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      const inv = S.invoices.find((x) => x.id === tr.dataset.print);
      if (inv) printInvoice(inv);
    }));
    $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const inv = S.invoices.find((x) => x.id === b.dataset.id);
      if (!inv) return;
      if (b.dataset.act === 'print') printInvoice(inv);
      else {
        if (!(await confirmDlg('Hapus Invoice?', 'Invoice <b>' + esc(inv.number) + '</b> akan dihapus dan unit dikembalikan ke status <b>Tersedia</b>.'))) return;
        try { await API.del('/invoices/' + inv.id); toast('Invoice dihapus, unit kembali tersedia', 'ok'); pageInvoices(); }
        catch (err) { toast(err.message, 'err'); }
      }
    }));
  }

  $('#i-q').addEventListener('input', render);
  const addBtn = $('#btn-add-inv');
  if (addBtn) addBtn.addEventListener('click', () => invoiceCreate());
  render();
}

/* ---------- Form buat invoice ---------- */
async function invoiceCreate() {
  let units;
  try { units = await API.get('/units'); }
  catch (err) { toast(err.message, 'err'); return; }

  const sellable = units.filter((u) => u.status !== 'terjual' && !u.invoiceId);
  if (!sellable.length) { toast('Tidak ada unit yang bisa dijual — semua sudah terjual', 'err'); return; }

  const ov = openModal(
    '<div class="m-head"><div><h3>Buat Invoice Penjualan</h3>' +
    '<p class="m-sub">Unit otomatis menjadi <b>Terjual</b> setelah invoice dibuat.</p></div>' +
    '<button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<form id="iv-form"><div class="alert error hidden" id="iv-err"></div>' +
    '<label>Unit Motor *</label>' +
    '<select name="unitId"><option value="">— Pilih unit —</option>' +
      sellable.map((u) => '<option value="' + u.id + '" data-price="' + (u.totals.sellPrice || 0) + '">' +
        esc(u.code + ' · ' + u.name + ' (' + u.year + ')') + '</option>').join('') + '</select>' +
    '<div class="form-grid">' +
      '<div><label>Nama Pembeli *</label><input name="buyerName" placeholder="Nama lengkap"></div>' +
      '<div><label>No. Telepon</label><input name="buyerPhone" placeholder="08xx-xxxx-xxxx"></div>' +
    '</div>' +
    '<label>Alamat Pembeli</label><textarea name="buyerAddress" placeholder="Alamat pembeli…"></textarea>' +
    '<div class="form-grid">' +
      '<div><label>Harga Jual (Rp)</label><input name="sellPrice" class="rp" inputmode="numeric" placeholder="0"></div>' +
      '<div><label>Diskon (Rp)</label><input name="discount" class="rp" inputmode="numeric" placeholder="0"></div>' +
      '<div><label>Metode Pembayaran *</label><select name="paymentMethod"><option value="tunai">Tunai</option><option value="transfer">Transfer Bank</option><option value="dp">DP / Cicilan Awal</option><option value="kredit">Kredit</option></select></div>' +
      '<div><label>Tanggal</label><input name="date" type="date" value="' + todayISO() + '"></div>' +
    '</div>' +
    '<label>Catatan</label><input type="text" name="note" placeholder="Catatan opsional…">' +
    '<div class="cost-total-row" style="margin-top:16px"><span>Total Bayar</span><strong class="num" id="iv-total">Rp 0</strong></div>' +
    '<p id="iv-terbilang" style="font-size:.8rem;color:var(--muted);font-style:italic;margin-top:6px"></p>' +
    '<div class="m-actions">' +
      '<button type="button" class="btn ghost" data-close>Batal</button>' +
      '<button type="submit" class="btn primary">' + ic('check', 16) + ' Simpan & Cetak</button>' +
    '</div></form>',
    { wide: true }
  );

  function refresh() {
    const f = $('#iv-form', ov);
    const sel = f.unitId;
    const opt = sel.options[sel.selectedIndex];
    let price = parseRp(f.sellPrice.value);
    if (!price && opt && opt.dataset.price) {
      price = parseInt(opt.dataset.price, 10);
      f.sellPrice.value = Number(price).toLocaleString('id-ID');
    }
    const total = Math.max(0, price - parseRp(f.discount.value));
    $('#iv-total', ov).textContent = fmtRp(total);
    $('#iv-terbilang', ov).textContent = total > 0 ? '# ' + terbilang(total).replace(/^\w/, (c) => c.toUpperCase()) + ' Rupiah' : '';
  }

  const form = $('#iv-form', ov);
  ['change', 'input'].forEach((ev) => form.addEventListener(ev, (e) => {
    if (['sellPrice', 'discount', 'unitId'].includes(e.target.name)) refresh();
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await API.post('/invoices', {
        unitId: f.unitId.value,
        buyerName: f.buyerName.value.trim(),
        buyerPhone: f.buyerPhone.value.trim(),
        buyerAddress: f.buyerAddress.value.trim(),
        sellPrice: parseRp(f.sellPrice.value),
        discount: parseRp(f.discount.value),
        paymentMethod: f.paymentMethod.value,
        date: f.date.value,
        note: f.note.value.trim()
      });
      closeModal(ov);
      toast('Invoice ' + r.invoice.number + ' dibuat — unit terjual!', 'ok');
      go(S.page);
      setTimeout(() => printInvoice(r.invoice), 350);
    } catch (err) {
      showFieldErrors(ov, err.data && err.data.errors, $('#iv-err', ov));
      if (!err.data || !err.data.errors) toast(err.message, 'err');
    }
  });
}

/* ============================================================
   Cetak Invoice
============================================================ */
function printInvoice(inv) {
  const payLabel = { tunai: 'Tunai', transfer: 'Transfer Bank', dp: 'DP / Cicilan Awal', kredit: 'Kredit' }[inv.paymentMethod] || inv.paymentMethod;
  const isPaid = inv.paymentMethod !== 'kredit';

  const ov = document.createElement('div');
  ov.id = 'print-overlay';
  ov.innerHTML =
    '<div class="print-bar">' +
      '<button class="btn yellow sm" id="pb-print">' + ic('printer', 15) + ' Cetak</button>' +
      '<button class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.3)" id="pb-close">' + ic('x', 15) + ' Tutup</button>' +
    '</div>' +
    '<div class="invoice-sheet">' +
      '<div class="inv-head">' +
        '<div class="inv-brand"><div class="logo-badge">' + LOGO_SVG + '</div><div>' +
          '<h4>' + esc(SHOP.name) + '</h4><p>' + esc(SHOP.tagline) + '<br>' + esc(SHOP.addr) + '<br>' + esc(SHOP.phone) + '</p></div></div>' +
        '<div class="inv-title"><div class="word">INVOICE</div>' +
          '<div class="no">' + esc(inv.number) + '</div>' +
          '<div class="dt">Tanggal: ' + fmtDate(inv.date || inv.createdAt) + '</div></div>' +
      '</div>' +
      '<div class="inv-strip"></div>' +
      '<div class="inv-meta">' +
        '<div class="blk"><div class="h">Ditagihkan Kepada</div><div class="n">' + esc(inv.buyer.name) + '</div>' +
          '<p>' + esc(inv.buyer.address || '—') + (inv.buyer.phone ? '<br>Telp: ' + esc(inv.buyer.phone) : '') + '</p></div>' +
        '<div class="blk"><div class="h">Pembayaran</div>' +
          '<p style="margin-bottom:6px"><span class="pay-tag">' + esc(payLabel) + ' · ' + (isPaid ? 'LUNAS' : 'MENUNGGU') + '</span></p>' +
          '<p>Dibuat oleh: ' + esc(inv.createdBy || '—') + '</p></div>' +
      '</div>' +
      '<table class="inv-items">' +
        '<thead><tr><th>Deskripsi Kendaraan</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead>' +
        '<tbody>' +
          '<tr><td><b>' + esc(inv.snapshot.name) + '</b><br><small style="color:#7b8b9d">' +
            esc(inv.snapshot.brand + ' · ' + inv.snapshot.year + ' · ' + inv.snapshot.cc + 'cc · ' + (inv.snapshot.color || '-')) +
            '<br>Nopol: <b>' + esc(inv.snapshot.nopol || '—') + '</b> · 1 unit</small></td>' +
            '<td class="r num">' + fmtRp(inv.sellPrice) + '</td><td class="r num">' + fmtRp(inv.sellPrice) + '</td></tr>' +
          (inv.discount > 0 ? '<tr class="discount"><td>Diskon</td><td class="r num">-' + fmtRp(inv.discount) + '</td><td class="r num">-' + fmtRp(inv.discount) + '</td></tr>' : '') +
          '<tr class="total"><td>TOTAL BAYAR</td><td class="r"></td><td class="r num">' + fmtRp(inv.total) + '</td></tr>' +
        '</tbody>' +
      '</table>' +
      '<div class="inv-terbilang"><b>Terbilang:</b> #' + terbilang(inv.total).replace(/^\w/, (c) => c.toUpperCase()) + ' Rupiah#</div>' +
      (inv.note ? '<div class="inv-note">Catatan: ' + esc(inv.note) + '</div>' : '') +
      '<div class="inv-signs">' +
        '<div class="sg"><small>Penerima,</small><div class="line">( ' + esc(inv.buyer.name) + ' )</div></div>' +
        '<div class="sg"><small>Hormat kami,</small><div class="line">( ' + esc(inv.createdBy || SHOP.name) + ' )</div></div>' +
      '</div>' +
      '<div class="inv-note" style="margin-top:20px;font-size:.7rem">Bukti pembayaran yang sah. Kendaraan telah diperiksa dan diserahkan dalam kondisi baik. ' +
        'Garansi mesin &amp; transmisi berlaku sesuai ketentuan showroom. Terima kasih atas kepercayaan Anda.</div>' +
      '<div class="inv-foot"><span>' + esc(SHOP.name) + ' — ' + esc(SHOP.tagline) + '</span><span>' + esc(SHOP.phone) + '</span></div>' +
    '</div>';

  document.body.classList.add('printing');
  document.body.appendChild(ov);

  $('#pb-print', ov).addEventListener('click', () => window.print());
  $('#pb-close', ov).addEventListener('click', () => {
    ov.remove();
    if (!$('#print-overlay')) document.body.classList.remove('printing');
  });
}

/* ============================================================
   Halaman: Laporan Laba Rugi (admin & owner)
============================================================ */
async function pageReports() {
  const c = $('#content');
  if (!S.perm.viewReports) {
    c.innerHTML = '<div class="card"><div class="alert error">Hanya admin dan pemilik yang dapat mengakses laporan.</div></div>';
    return;
  }
  c.innerHTML = '<div class="empty-state"><p>Memuat laporan…</p></div>';

  let summary, units;
  try {
    [summary, units] = await Promise.all([API.get('/reports/summary'), API.get('/units')]);
  } catch (err) {
    c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>';
    return;
  }

  const soldUnits = units.filter((u) => u.status === 'terjual' && u.totals);

  c.innerHTML =
    '<div class="stats">' +
      statCard('green', 'wallet', fmtRp(summary.revenue), 'Total Omzet') +
      statCard('navy', 'menu', fmtRp(summary.capitalSold), 'Modal Unit Terjual') +
      statCard(summary.profit >= 0 ? 'orange' : 'red', 'chart', fmtRp(summary.profit), 'Laba Bersih Terealisasi') +
      statCard('yellow', 'receipt', summary.counts.terjual + ' unit · rata-rata ' + summary.avgMargin + '%', 'Performa Margin') +
    '</div>' +
    '<div class="card" style="margin-bottom:18px">' +
      '<h3>' + ic('chart') + ' Tren 6 Bulan Terakhir</h3>' +
      '<div class="chart">' + summary.months.map((mo) => {
        const maxVal = Math.max.apply(null, [1].concat(summary.months.map((x) => Math.max(x.revenue, Math.abs(x.profit)))));
        const rh = Math.max(2, Math.round(mo.revenue / maxVal * 100));
        const ph = mo.profit >= 0 ? Math.max(2, Math.round(mo.profit / maxVal * 100)) : Math.min(100, Math.max(3, Math.round(Math.abs(mo.profit) / maxVal * 100)));
        return '<div class="chart-col">' +
          '<div class="chart-pair" title="' + monthLabel(mo.key) + ' — Omzet ' + fmtRp(mo.revenue) + ', Laba ' + fmtRp(mo.profit) + '">' +
            '<div class="cbar rev" style="height:' + rh + '%"></div>' +
            '<div class="cbar ' + (mo.profit >= 0 ? 'prof' : 'loss') + '" style="height:' + ph + '%"></div>' +
          '</div>' +
          '<span class="chart-lbl">' + monthLabel(mo.key) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="legend"><span><i style="background:var(--orange)"></i>Omzet</span><span><i style="background:var(--yellow)"></i>Laba</span><span><i style="background:var(--red)"></i>Rugi</span></div>' +
    '</div>' +
    '<div class="section-head"><div><h2 style="color:var(--navy)">Rincian Laba Rugi per Unit Terjual</h2>' +
      '<p class="sub">Modal = pembelian + perbaikan + dokumen · Laba = harga jual − modal</p></div>' +
      '<input type="month" id="r-month" class="filter" value=""> <button class="btn ghost sm" id="r-clear">Semua Periode</button></div>' +
    '<div id="r-table"></div>';

  function statCard(col, icon, val, lbl) {
    return '<div class="stat-card"><div class="stat-ico ' + col + '">' + ic(icon, 22) + '</div>' +
      '<div><div class="stat-val num">' + val + '</div><div class="stat-lbl">' + esc(lbl) + '</div></div></div>';
  }

  function renderTable() {
    const mv = $('#r-month').value;
    let rows = soldUnits;
    if (mv) rows = rows.filter((u) => (u.soldAt || '').startsWith(mv));
    rows = [...rows].sort((a, b) => (b.soldAt || '').localeCompare(a.soldAt || ''));

    let tRev = 0, tMod = 0, tProf = 0;
    const trs = rows.map((u) => {
      const tt = u.totals;
      tRev += tt.sellPrice; tMod += tt.modal; tProf += tt.profit;
      return '<tr>' +
        '<td><span class="mono">' + esc(u.code) + '</span></td>' +
        '<td><div class="cell-main">' + esc(u.name) + '</div><div class="cell-sub">' + esc(u.brand) + ' · terjual ' + fmtDate(u.soldAt) + '</div></td>' +
        '<td class="num" style="text-align:right">' + fmtRp(tt.purchase) + '</td>' +
        '<td class="num" style="text-align:right">' + fmtRp(tt.repair) + '</td>' +
        '<td class="num" style="text-align:right">' + fmtRp(tt.doc) + '</td>' +
        '<td class="num" style="text-align:right"><b>' + fmtRp(tt.modal) + '</b></td>' +
        '<td class="num" style="text-align:right">' + fmtRp(tt.sellPrice) + '</td>' +
        '<td style="text-align:right"><span class="profit-chip ' + (tt.profit >= 0 ? 'up' : 'down') + ' num">' +
          (tt.profit >= 0 ? '+' : '-') + fmtRp(Math.abs(tt.profit)).replace('Rp ', '') + '</span>' +
          '<div class="cell-sub num">' + tt.margin + '%</div></td>' +
        '</tr>';
    }).join('');

    $('#r-table').innerHTML =
      '<div class="table-wrap"><table class="data">' +
      '<thead><tr><th>Kode</th><th>Motor</th><th style="text-align:right">Pembelian</th><th style="text-align:right">Perbaikan</th>' +
      '<th style="text-align:right">Dokumen</th><th style="text-align:right">Total Modal</th><th style="text-align:right">Harga Jual</th><th style="text-align:right">Laba / Rugi</th></tr></thead>' +
      '<tbody>' + (trs || emptyRow(8)) + '</tbody>' +
      (rows.length ? '<tfoot><tr><td colspan="5">TOTAL (' + rows.length + ' unit)</td>' +
        '<td class="num" style="text-align:right">' + fmtRp(tMod) + '</td>' +
        '<td class="num" style="text-align:right">' + fmtRp(tRev) + '</td>' +
        '<td class="num" style="text-align:right;color:' + (tProf >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
        (tProf >= 0 ? '+' : '-') + fmtRp(Math.abs(tProf)).replace('Rp ', '') + '</td></tr></tfoot>' : '') +
      '</table></div>';
  }

  $('#r-month').addEventListener('change', renderTable);
  $('#r-clear').addEventListener('click', () => { $('#r-month').value = ''; renderTable(); });
  renderTable();
}

/* ============================================================
   Halaman: Manajemen Pengguna (admin)
============================================================ */
async function pageUsers() {
  const c = $('#content');
  if (!S.perm.manageUsers) {
    c.innerHTML = '<div class="card"><div class="alert error">Hanya admin yang dapat mengelola pengguna.</div></div>';
    return;
  }
  c.innerHTML = '<div class="empty-state"><p>Memuat pengguna…</p></div>';

  let users;
  try { users = await API.get('/users'); }
  catch (err) { c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>'; return; }

  c.innerHTML =
    '<div class="toolbar"><div class="search-box">' + ic('search') + '<input id="us-q" type="text" placeholder="Cari nama / username…"></div>' +
    '<button class="btn primary" id="btn-add-user">' + ic('plus', 16) + ' Tambah Pengguna</button></div>' +
    '<div id="us-table"></div>';

  function render() {
    const q = ($('#us-q').value || '').toLowerCase();
    let list = users;
    if (q) list = list.filter((u) => [u.name, u.username, u.role].join(' ').toLowerCase().includes(q));

    const rows = list.map((u) =>
      '<tr><td>' +
        '<div style="display:flex;align-items:center;gap:12px"><div class="avatar sm" style="background:var(--grad-hot)">' + initials(u.name) + '</div>' +
        '<div><div class="cell-main">' + esc(u.name) + (u.id === S.user.id ? ' <span class="mono" style="font-size:.72rem">(Anda)</span>' : '') + '</div>' +
        '<div class="cell-sub">@' + esc(u.username) + '</div></div></div></td>' +
      '<td><span class="badge role ' + esc(u.role) + '">' + (ROLE_LABEL[u.role] || u.role) + '</span></td>' +
      '<td>' + (u.active ? '<span class="badge tersedia">Aktif</span>' : '<span class="badge terjual">Nonaktif</span>') + '</td>' +
      '<td>' + fmtDate(u.createdAt) + '</td>' +
      '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + u.id + '" title="Ubah">' + ic('pencil', 16) + '</button>' +
        (u.id !== S.user.id ? '<button class="icon-btn red" data-act="del" data-id="' + u.id + '" title="Hapus">' + ic('trash', 16) + '</button>' : '') +
      '</div></td></tr>').join('');

    $('#us-table').innerHTML =
      '<div class="table-wrap"><table class="data">' +
      '<thead><tr><th>Nama</th><th>Role</th><th>Status</th><th>Dibuat</th><th style="text-align:right">Aksi</th></tr></thead>' +
      '<tbody>' + (rows || emptyRow(5)) + '</tbody></table></div>';

    $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const u = users.find((x) => x.id === b.dataset.id);
      if (!u) return;
      if (b.dataset.act === 'edit') userForm(u, render);
      else {
        if (!(await confirmDlg('Hapus Pengguna?', 'Pengguna <b>' + esc(u.name) + ' (@' + esc(u.username) + ')</b> akan dihapus permanen.'))) return;
        try { await API.del('/users/' + u.id); toast('Pengguna dihapus', 'ok'); pageUsers(); }
        catch (err) { toast(err.message, 'err'); }
      }
    }));
  }

  $('#us-q').addEventListener('input', render);
  $('#btn-add-user').addEventListener('click', () => userForm(null, render));
  render();
}

/* ---------- Form tambah / edit pengguna ---------- */
function userForm(user, onDone) {
  const isEdit = !!user;
  const ov = openModal(
    '<div class="m-head"><div><h3>' + (isEdit ? 'Edit Pengguna' : 'Tambah Pengguna') + '</h3>' +
    '<p class="m-sub">Atur akun login & role sesuai kebutuhan.</p></div>' +
    '<button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<form id="user-form"><div class="alert error hidden" id="us-err"></div>' +
    '<div class="form-grid">' +
      '<div><label>Nama Lengkap *</label><input name="name" value="' + esc(isEdit ? user.name : '') + '" placeholder="mis. Andi Pratama"></div>' +
      '<div><label>Username *</label><input name="username" value="' + esc(isEdit ? user.username : '') + '" placeholder="andi" autocomplete="off"></div>' +
    '</div>' +
    '<label>Role *</label>' +
    '<select name="role">' +
      ['admin', 'owner', 'sales', 'mekanik'].map((r) =>
        '<option value="' + r + '"' + (isEdit && user.role === r ? ' selected' : '') + '>' + (ROLE_LABEL[r] || r) + '</option>').join('') +
    '</select>' +
    '<div class="form-grid">' +
      '<div><label>Password ' + (isEdit ? '(kosongkan jika tidak diganti)' : '*') + '</label><input name="password" type="password" placeholder="min. 5 karakter" autocomplete="new-password"></div>' +
      '<div><label>Status Akun</label><select name="active">' +
        '<option value="1" ' + (isEdit && user.active === false ? '' : 'selected') + '>Aktif</option>' +
        '<option value="0" ' + (isEdit && user.active === false ? 'selected' : '') + '>Nonaktif</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="alert ok" style="margin-top:14px">Role <b>admin</b> akses penuh · <b>owner</b> laporan &amp; harga · <b>sales</b> jual &amp; invoice · <b>mekanik</b> hanya biaya perbaikan.</div>' +
    '<div class="m-actions">' +
      '<button type="button" class="btn ghost" data-close>Batal</button>' +
      '<button type="submit" class="btn primary">' + (isEdit ? 'Simpan Perubahan' : 'Tambah Pengguna') + '</button>' +
    '</div></form>'
  );

  $('#user-form', ov).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      name: f.name.value.trim(), username: f.username.value.trim(), role: f.role.value,
      active: !!parseInt(f.active.value, 10)
    };
    if (f.password.value) body.password = f.password.value;
    try {
      if (isEdit) await API.put('/users/' + user.id, body);
      else await API.post('/users', body);
      closeModal(ov);
      toast(isEdit ? 'Pengguna diperbarui' : 'Pengguna ditambahkan', 'ok');
      if (onDone) onDone();
    } catch (err) {
      showFieldErrors(ov, err.data && err.data.errors, $('#us-err', ov));
      if (!err.data || !err.data.errors) toast(err.message, 'err');
    }
  });
}

/* ============================================================
   Inisialisasi
============================================================ */
document.addEventListener('DOMContentLoaded', init);