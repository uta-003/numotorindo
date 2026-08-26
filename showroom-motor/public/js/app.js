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

/* ---------- Tema warna ---------- */
const THEMES = [
  { id: 'klasik', name: 'Klasik', c: ['#003049', '#D62828', '#F77F00', '#FCBF49'] },
  { id: 'hutan', name: 'Hutan', c: ['#04382b', '#0f9d76', '#2dd4bf', '#99f6e4'] },
  { id: 'galaksi', name: 'Galaksi', c: ['#241056', '#7c3aed', '#a855f7', '#e9d5ff'] },
  { id: 'samudra', name: 'Samudra', c: ['#082f49', '#0284c7', '#38bdf8', '#bae6fd'] },
  { id: 'senja', name: 'Senja', c: ['#431407', '#ea580c', '#f59e0b', '#fed7aa'] },
  { id: 'sakura', name: 'Sakura', c: ['#4c0519', '#e11d48', '#fb7185', '#fecdd3'] }
];

function applySavedTheme() {
  const t = localStorage.getItem('sm_color') || 'klasik';
  if (t && t !== 'klasik') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

function currentThemeName() {
  const t = localStorage.getItem('sm_color') || 'klasik';
  return (THEMES.find((x) => x.id === t) || THEMES[0]).name;
}

function openThemePicker() {
  const cur = localStorage.getItem('sm_color') || 'klasik';
  const ov = openModal(
    '<div class="m-head"><div><h3>Pilih Tema Warna</h3>' +
    '<p class="m-sub">Langsung diterapkan &amp; tersimpan di perangkat ini.</p></div>' +
    '<button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<div class="theme-grid">' +
    THEMES.map((t) => {
      const act = (t.id || 'klasik') === cur;
      return '<button type="button" class="theme-card' + (act ? ' active' : '') + '" data-th="' + t.id + '">' +
        '<span class="sw-row">' + t.c.map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>' +
        '<strong>' + (act ? ic('check', 13) : '') + t.name + '</strong>' +
        '</button>';
    }).join('') +
    '</div>');
  $$('.theme-card', ov).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.th || 'klasik';
    localStorage.setItem('sm_color', id);
    applySavedTheme();
    closeModal(ov);
    toast('Tema "' + currentThemeName() + '" diterapkan 🎨', 'ok');
  }));
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
  contact: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 4V2h8v2M9 11h6M12 8v6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r=".7" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r=".7" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r=".7" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.7-1.7h2c3 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2z"/>',
  filecheck: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
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
  { key: 'bastds', label: 'BASTD', icon: 'filecheck', show: () => S.user.role !== 'mekanik' },
  { key: 'customers', label: 'Pelanggan', icon: 'contact', show: () => S.user.role !== 'mekanik' },
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

  /* pemilih tema warna */
  const themeBtn = $('#btn-theme');
  themeBtn.innerHTML = ic('palette', 19);
  themeBtn.title = 'Pilih tema warna';
  applySavedTheme();
  themeBtn.addEventListener('click', () => openThemePicker());

  /* ubah password sendiri */
  const lockBtn = $('#btn-lock');
  lockBtn.innerHTML = ic('lock', 18);
  lockBtn.addEventListener('click', () => changePasswordModal());

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
    bastds: ['BASTD', 'Berita Acara Serah Terima Dokumen (STNK & BPKB)'],
    customers: ['Pelanggan', 'Database pembeli & riwayat transaksi'],
    reports: ['Laporan Laba Rugi', 'Performa penjualan & profitabilitas'],
    users: ['Manajemen Pengguna', 'Akun, role & hak akses']
  };
  const t = titles[page] || [page, ''];
  $('#pg-title').textContent = t[0];
  $('#pg-sub').textContent = t[1];
  closeSidebarMobile();
  const pages = { dashboard: pageDashboard, units: pageUnits, invoices: pageInvoices,
    bastds: pageBastds, customers: pageCustomers, reports: pageReports, users: pageUsers };
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

  /* kartu Status BPKB: ringkasan semua unit yang diproses + notifikasi urgensi */
  const tracked = S.units.filter((u) => u.bpkb);
  const orderMap = { terlambat: 0, kritis: 1, proses: 2, siap: 3 };
  tracked.sort((a, b) =>
    (orderMap[a.bpkb.status] - orderMap[b.bpkb.status]) ||
    ((a.bpkb.calLeft == null ? 999 : a.bpkb.calLeft) - (b.bpkb.calLeft == null ? 999 : b.bpkb.calLeft)));
  const cntB = { siap: 0, proses: 0, kritis: 0, terlambat: 0 };
  tracked.forEach((u) => { cntB[u.bpkb.status]++; });
  const urgentN = cntB.kritis + cntB.terlambat;
  let bpkbBanner = '';
  if (tracked.length) {
    const bsBox = (cls, n, lbl) =>
      '<div class="bs-box bs-' + cls + (n ? ' has' : ' zero') + '"><b class="num">' + n + '</b><span>' + lbl + '</span></div>';
    bpkbBanner =
      '<div class="card bpkb-status-card' + (urgentN ? ' has-urgent' : '') + '">' +
      '<h3>' + ic('doc', 18) + ' Status BPKB Unit</h3>' +
      '<div class="bpkb-stats">' +
        bsBox('siap', cntB.siap, 'Siap Diambil') +
        bsBox('proses', cntB.proses, 'Diproses') +
        bsBox('kritis', cntB.kritis, '≤ 7 Hari') +
        bsBox('terlambat', cntB.terlambat, 'Terlambat') +
      '</div>' +
      (urgentN ? '<p class="bpkb-urgent">🔔 ' + urgentN + ' unit memasuki minggu terakhir / terlambat — segera tindak lanjuti!</p>' : '') +
      '<div class="bpkb-list">' +
      tracked.map((u) => {
        const b = u.bpkb;
        const cls = bpkbClassOf(b.status);
        const late = b.status === 'terlambat';
        const sisa = b.status === 'siap'
          ? 'Diambil ' + fmtDate(b.readyAt)
          : late ? 'Terlambat ' + Math.abs(b.remainWork) + ' HK'
          : (b.remainWork === 0 ? 'Jatuh tempo HARI INI' : 'Sisa ' + b.remainWork + ' HK');
        return '<button type="button" class="bpkb-row st-' + cls + '" data-bpkb-unit="' + u.id + '">' +
          '<span class="mono">' + esc(u.code) + '</span>' +
          '<strong>' + esc(u.name) + '</strong>' +
          '<span class="bpkb-due ' + (late ? 'late' : (b.status === 'kritis' ? 'soon' : '')) + '">' +
            (b.status === 'siap' ? '✓ Siap' : 'Jtempo ' + fmtDate(b.due)) + '</span>' +
          '<span class="bpkb-sisa">' + sisa + '</span>' +
          '<span class="badge bpkb-' + cls + '">' + b.days + ' HK</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<p class="bpkb-hint">Hitungan hari kerja — Sabtu, Minggu &amp; libur nasional tidak dihitung. Muncul setiap hari sampai BPKB diambil. Klik baris untuk detail unit.</p>' +
      '</div>';
  }

  /* aksi cepat */
  let quick = '<div class="quick-actions">';
  if (S.perm.manageUnits) quick += '<button class="btn primary" data-qa="unit">' + ic('plus', 16) + ' Tambah Unit</button>';
  if (S.perm.sell) quick += '<button class="btn navy" data-qa="inv">' + ic('receipt', 16) + ' Buat Invoice</button>';
  if (S.perm.viewReports) quick += '<button class="btn ghost" data-qa="rep">' + ic('chart', 16) + ' Lihat Laporan</button>';
  if (S.perm.editRepairs) quick += '<span class="badge role mekanik">Mode Mekanik — input biaya perbaikan dari detail unit</span>';
  quick += '</div>';

  c.innerHTML =
    '<div class="hero-greet"><div class="hg-txt">' +
      '<h2><span class="greet-emoji">' + greetingEmoji() + '</span> ' + greeting() + ', ' + esc(S.user.name.split('(')[0].trim()) + ' 👋</h2>' +
      '<p>' + (ROLE_LABEL[S.user.role] || '') + ' · Berikut ringkasan showroom Anda.</p>' +
    '</div></div>' +
    bpkbBanner +
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
  $$('[data-bpkb-unit]').forEach((el) => el.addEventListener('click', () => unitDetail(el.dataset.bpkbUnit)));
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

/* ---------- BPKB helpers ---------- */
function bpkbClassOf(status) {
  return status === 'terlambat' ? 'terlambat' : (status === 'kritis' ? 'kritis' : 'proses');
}
function bpkbCellHTML(bp) {
  if (!bp) return '<span class="cell-sub">—</span>';
  if (bp.status === 'siap') {
    return '<span class="badge bpkb-siap">SIAP</span>' +
      '<div class="cell-sub">Diambil ' + fmtDate(bp.readyAt) + '</div>';
  }
  const cls = bpkbClassOf(bp.status);
  const sisa = bp.status === 'terlambat'
    ? 'Terlambat ' + Math.abs(bp.remainWork) + ' HK'
    : (bp.remainWork === 0 ? 'Jatuh tempo HARI INI' : 'Sisa ' + bp.remainWork + ' HK');
  return '<span class="badge bpkb-' + cls + '">' + bp.days + ' HK</span>' +
    '<div class="cell-sub ' + (cls !== 'proses' ? 'due-red' : '') + '">Jtempo ' + fmtDate(bp.due) + '</div>' +
    '<div class="cell-sub">' + sisa + '</div>';
}

function docChip(u, key, label) {
  const on = u.docs && u.docs[key];
  return '<button type="button" class="chip-doc' + (on ? ' on' : '') + '" data-doc="' + key + '">' + ic(on ? 'check' : 'x', 12) + ' ' + label + '</button>';
}

/* pajak jatuh tempo ≤ 30 hari -> peringatan */
function pajakNear(u) {
  if (!u.pajakDue) return false;
  const diff = Math.round((new Date(u.pajakDue + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
  return diff <= 30;
}

/* ---------- Galeri foto unit ---------- */
function renderFotoTab(ov, u, body) {
  const photos = u.photos || [];
  body.innerHTML =
    '<input type="file" id="ph-input" accept="image/jpeg,image/png,image/webp" multiple style="display:none">' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
      '<button class="btn primary sm" id="ph-add">' + ic('image', 15) + ' Unggah Foto</button>' +
      '<span class="cell-sub">JPG/PNG/WebP · maks 1 MB per foto · foto pertama menjadi sampul</span>' +
    '</div>' +
    (photos.length
      ? '<div class="photo-grid">' + photos.map((p) =>
          '<div class="photo-item">' +
            '<img src="' + esc(p.url) + '" alt="foto">' +
            '<span class="photo-cover-acts">' +
              (p.id !== photos[0].id ? '<button type="button" data-ph-cover="' + p.id + '" title="Jadikan sampul">' + ic('grid', 13) + '</button>' : '') +
              '<button type="button" data-ph-del="' + p.id + '" title="Hapus">' + ic('trash', 13) + '</button>' +
            '</span>' +
            (p.id === photos[0].id ? '<span class="badge bpkb-proses photo-badge">Sampul</span>' : '') +
          '</div>').join('') + '</div>'
      : '<div class="empty-state">' + ic('image', 40) + '<p>Belum ada foto unit.</p></div>');

  $('#ph-add', ov).addEventListener('click', () => $('#ph-input', ov).click());
  $('#ph-input', ov).addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) {
      if (!/image\/(jpeg|png|webp)/.test(f.type)) { toast(f.name + ': format tidak didukung', 'err'); continue; }
      if (f.size > 1024 * 1024) { toast(f.name + ': melebihi 1 MB', 'err'); continue; }
      const rd = new FileReader();
      await new Promise((res2) => { rd.onload = () => res2(); rd.readAsDataURL(f); });
      try {
        const r = await API.post('/units/' + u.id + '/photos', { filename: f.name, data: String(rd.result) });
        Object.assign(u, r.unit);
        toast('Foto diunggah 📷', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    }
    renderFotoTab(ov, u, body);
  });
  $$('[data-ph-del]', ov).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDlg('Hapus Foto?', 'Foto ini akan dihapus permanen.'))) return;
    try {
      const r = await API.del('/units/' + u.id + '/photos/' + b.dataset.phDel);
      Object.assign(u, r); renderFotoTab(ov, u, body); toast('Foto dihapus', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }));
  $$('[data-ph-cover]', ov).forEach((b) => b.addEventListener('click', async () => {
    try {
      const r = await API.post('/units/' + u.id + '/photos/cover', { photoId: b.dataset.phCover });
      Object.assign(u, r); renderFotoTab(ov, u, body); toast('Sampul diperbarui', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }));
}

/* ============================================================
   Halaman: Data Unit
============================================================ */
async function pageUnits() {
  const c = $('#content');
  c.innerHTML = '<div class="empty-state"><p>Memuat data…</p></div>';
  try {
    S.units = await API.get('/units' + (S.unitsArch ? '?archived=' + S.unitsArch : ''));
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
      '<select id="u-arch" class="filter"><option value="">Aktif</option><option value="1"' + (S.unitsArch === '1' ? ' selected' : '') + '>Arsip</option><option value="all"' + (S.unitsArch === 'all' ? ' selected' : '') + '>Semua</option></select>' +
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
    head += '<th>BPKB</th><th>Status</th>';
    if (showFin) head += '<th style="text-align:right">Laba / Rugi</th>';
    head += '<th style="text-align:right">Aksi</th></tr>';

    const rows = list.map((u) => {
      const t = u.totals || {};
      let row = '<tr data-detail="' + u.id + '" style="cursor:pointer' + (u.archived ? ';opacity:.55' : '') + '">' +
        '<td><span class="mono">' + esc(u.code) + '</span></td>' +
        '<td><div class="cell-main">' + esc(u.name) + '</div><div class="cell-sub">' + esc(u.brand) + ' · ' + u.year + ' · ' + u.cc + 'cc · ' + (u.km || 0).toLocaleString('id-ID') + ' km</div></td>' +
        '<td>' + esc(u.nopol || '—') + (pajakNear(u) ? '<div class="cell-sub due-red">Pajak ' + fmtDate(u.pajakDue) + '</div>' : '') + '</td>';
      if (showFin) {
        row += '<td style="text-align:right" class="num"><b>' + fmtRp(t.modal) + '</b>' +
          '<div class="cell-sub num">Beli ' + fmtRp(t.purchase) + ' + Perbaikan ' + fmtRp(t.repair) + ' + Dokumen ' + fmtRp(t.doc) + '</div></td>' +
          '<td style="text-align:right" class="num"><b>' + (t.sellPrice != null ? fmtRp(t.sellPrice) : '•••') + '</b></td>';
      }
      row += '<td>' + statusBadge(u.status) + '</td>' +
        '<td>' + bpkbCellHTML(u.bpkb) + '</td>';
      if (showFin) {
        const cls = t.profit >= 0 ? 'up' : 'down';
        const sign = t.profit >= 0 ? '+' : '';
        row += '<td style="text-align:right" title="Rumus: Harga jual ' + fmtRp(t.sellPrice) + ' − (Pembelian ' + fmtRp(t.purchase) + ' + Perbaikan ' + fmtRp(t.repair) + ' + Dokumen ' + fmtRp(t.doc) + ') = ' + (t.profit >= 0 ? 'Laba ' : 'Rugi ') + fmtRp(Math.abs(t.profit)) + '"><span class="profit-chip ' + cls + ' num">' + sign + fmtRp(Math.abs(t.profit)).replace('Rp ', '') +
          '</span><div class="cell-sub num">' + (t.margin != null ? t.margin + '% margin' : '') + '</div></td>';
      }
      row += '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="detail" data-id="' + u.id + '" title="Detail">' + ic('eye', 17) + '</button>' +
        (S.perm.manageUnits ? '<button class="icon-btn" data-act="edit" data-id="' + u.id + '" title="Edit">' + ic('pencil', 16) + '</button>' +
        '<button class="icon-btn" data-act="dup" data-id="' + u.id + '" title="Duplikat unit">' + ic('copy', 16) + '</button>' +
        '<button class="icon-btn" data-act="arch" data-id="' + u.id + '" title="' + (u.archived ? 'Keluarkan dari arsip' : 'Arsipkan unit') + '">' + ic(u.archived ? 'eye' : 'doc', 16) + '</button>' +
        '<button class="icon-btn red" data-act="del" data-id="' + u.id + '" title="Hapus">' + ic('trash', 16) + '</button>' : '') +
        '</div></td></tr>';
      return row;
    }).join('');

    $('#u-table').innerHTML =
      '<div class="table-wrap"><table class="data"><thead>' + head + '</thead><tbody>' +
      (rows || emptyRow(showFin ? 8 : 5)) + '</tbody></table></div>';

    $$('tr[data-detail]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      unitDetail(tr.dataset.detail);
    }));
    $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.id, act = b.dataset.act;
      const u = S.units.find((x) => x.id === id);
      if (act === 'detail') unitDetail(id);
      if (act === 'edit') unitForm(u);
      if (act === 'dup') {
        if (!(await confirmDlg('Duplikat Unit?', 'Salinan <b>' + esc(u.code) + '</b> akan dibuat sebagai unit baru (status Tersedia, tanpa nopol).'))) return;
        try { const r2 = await API.post('/units/' + u.id + '/duplicate'); toast('Diduplikasi menjadi ' + r2.code, 'ok'); pageUnits(); }
        catch (err) { toast(err.message, 'err'); }
      }
      if (act === 'arch') {
        try { await API.patch('/units/' + u.id, { archived: !u.archived }); toast(u.archived ? 'Dikeluarkan dari arsip' : 'Unit diarsipkan', 'ok'); pageUnits(); }
        catch (err) { toast(err.message, 'err'); }
      }
      if (act === 'del') {
        if (!(await confirmDlg('Hapus Unit?', 'Unit <b>' + esc(u.code) + ' — ' + esc(u.name) + '</b> beserta catatan biayanya akan dihapus permanen.'))) return;
        try { await API.del('/units/' + id); toast('Unit dihapus', 'ok'); pageUnits(); }
        catch (err) { toast(err.message, 'err'); }
      }
    }));
  }

  $('#u-q').addEventListener('input', render);
  $('#u-status').addEventListener('change', render);
  $('#u-arch').addEventListener('change', () => { S.unitsArch = $('#u-arch').value; pageUnits(); });
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
      '<div><label>No. Rangka</label><input name="noRangka" value="' + esc(isEdit ? (unit.noRangka || '') : '') + '" placeholder="MHLCX…" style="text-transform:uppercase"></div>' +
      '<div><label>No. Mesin</label><input name="noMesin" value="' + esc(isEdit ? (unit.noMesin || '') : '') + '" placeholder="JC39E…" style="text-transform:uppercase"></div>' +
      '<div><label>Pajak Jatuh Tempo</label><input type="date" name="pajakDue" value="' + esc(isEdit ? (unit.pajakDue || '') : '') + '"></div>' +
      '<div><label>&nbsp;</label><span class="cell-sub">Sesuai BPKB/STNK</span></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div><label>Harga Jual Rencana (Rp)</label><input name="sellPrice" class="rp" inputmode="numeric" value="' + (isEdit && unit.sellPrice != null ? Number(unit.sellPrice).toLocaleString('id-ID') : '') + '" placeholder="0"></div>' +
      '<div><label>Status Unit</label><select name="status">' +
        '<option value="tersedia"' + ((!isEdit || unit.status === 'tersedia') ? ' selected' : '') + '>Tersedia</option>' +
        '<option value="booking"' + (isEdit && unit.status === 'booking' ? ' selected' : '') + '>Booking</option>' +
        '<option value="terjual"' + (isEdit && unit.status === 'terjual' ? ' selected' : '') + '>Terjual</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div><label>Proses BPKB</label><select name="bpkbDays">' +
        '<option value="0"' + (!isEdit || !unit.bpkbDays ? ' selected' : '') + '>— Belum diproses —</option>' +
        [7, 14, 21, 28].map((d) => '<option value="' + d + '"' + (isEdit && unit.bpkbDays === d ? ' selected' : '') + '>' + d + ' Hari Kerja</option>').join('') +
      '</select></div>' +
      '<div><label>Mulai Proses BPKB</label><input type="date" name="bpkbStart" value="' + (isEdit ? (unit.bpkbStart || unit.purchaseDate || todayISO()) : todayISO()) + '"></div>' +
    '</div>' +
    '<p class="hint-bpkb">' + ic('info', 13) + ' Hitungan hari kerja — Sabtu, Minggu &amp; libur nasional tidak dihitung. Notifikasi muncul otomatis saat memasuki minggu terakhir / terlambat.</p>' +
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
      bpkbDays: parseInt(f.bpkbDays.value, 10) || 0,
      bpkbStart: f.bpkbStart.value,
      noRangka: f.noRangka.value.trim(), noMesin: f.noMesin.value.trim(), pajakDue: f.pajakDue.value,
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
    tabsDef.push({ key: 'foto', label: 'Foto' });
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
        (!isMek ? infoItem('No. Rangka', esc(u.noRangka || '—')) : '') +
        (!isMek ? infoItem('No. Mesin', esc(u.noMesin || '—')) : '') +
        (!isMek ? infoItem('Pajak Jatuh Tempo', u.pajakDue ? fmtDate(u.pajakDue) : '—') : '') +
        (!isMek ? infoItem('Tanggal Beli', fmtDate(u.purchaseDate)) : '') +
        (!isMek && u.status === 'terjual' ? infoItem('Terjual', fmtDate(u.soldAt)) : '') +
        (u.bpkb
          ? infoItem('BPKB', '<span class="badge bpkb-' + bpkbClassOf(u.bpkb.status) + '" style="font-size:.8rem">' + u.bpkb.days + ' HK</span>') +
            infoItem('BPKB Mulai Proses', fmtDate(u.bpkb.start)) +
            infoItem('BPKB Jatuh Tempo', '<span class="' + (u.bpkb.status !== 'proses' ? 'due-red' : '') + '">' + fmtDate(u.bpkb.due) + '</span>') +
            infoItem('Posisi BPKB', u.bpkb.status === 'terlambat'
              ? '<span class="due-red">Terlambat ' + Math.abs(u.bpkb.remainWork) + ' HK</span>'
              : (u.bpkb.remainWork === 0 ? '<span class="due-red">Jatuh tempo hari ini</span>' : 'Sisa ' + u.bpkb.remainWork + ' HK'))
          : infoItem('BPKB', '—')) +
        '</div>' +
                (u.notes ? '<label style="margin-top:18px">Catatan</label><p style="font-size:.9rem;color:var(--muted);line-height:1.6">' + esc(u.notes) + '</p>' : '') +
        (!isMek ? '<label style="margin-top:16px">Kelengkapan Dokumen</label><div class="docs-row">' +
          docChip(u, 'stnk', 'STNK') + docChip(u, 'faktur', 'Faktur') + docChip(u, 'formA', 'Form A') +
        '</div>' : '') +
        (u.bpkb && S.user.role !== 'mekanik' ? '<div class="m-actions" style="margin-top:18px">' +
          (u.bpkb.status === 'siap'
            ? '<span class="badge bpkb-siap" style="font-size:.85rem;padding:8px 16px;border-radius:999px">BPKB SIAP · Diambil ' + fmtDate(u.bpkb.readyAt) + '</span>' +
              '<button class="btn ghost sm" id="ud-bpkb-ready" title="Kembalikan ke proses">Batalkan</button>'
            : '<button class="btn primary sm" id="ud-bpkb-ready">' + ic('check', 15) + ' BPKB Sudah Diambil — Tandai Siap</button>') +
        '</div>' : '') +
        (S.perm.manageUnits ? '<div class="m-actions"><button class="btn navy sm" id="ud-edit">' + ic('pencil', 15) + ' Edit Data Unit</button></div>' : '');
      if (S.perm.manageUnits) $('#ud-edit', ov).addEventListener('click', () => { closeModal(ov); unitForm(u); });
      const bpBtn = $('#ud-bpkb-ready', ov);
      if (bpBtn) bpBtn.addEventListener('click', async () => {
        try {
          const upd = await API.patch('/units/' + u.id, { bpkbReady: u.bpkb.status !== 'siap' });
          Object.assign(u, upd);
          /* sinkronkan juga cache daftar unit agar tabel/dashboard langsung berubah */
          const su = S.units.find((x) => x.id === u.id);
          if (su) Object.assign(su, upd);
          toast(u.bpkb && u.bpkb.status === 'siap' ? 'BPKB ditandai SIAP 🎉 Notifikasi berhenti.' : 'Status BPKB dikembalikan ke proses.', 'ok');
          renderTab('info');
          /* segarkan halaman di belakang modal tanpa menutupnya */
          try { go(S.page); } catch (e2) {}
        } catch (err) { toast(err.message, 'err'); }
      });
      /* toggle kelengkapan dokumen */
      $$('[data-doc]', body).forEach((btn) => btn.addEventListener('click', async () => {
        const k = btn.dataset.doc;
        const nv = !(u.docs && u.docs[k]);
        try {
          await API.patch('/units/' + u.id, { docs: Object.assign({}, u.docs || {}, (function(){const o={};o[k]=nv;return o;})()) });
          u.docs = Object.assign({}, u.docs || {}, (function(){const o={};o[k]=nv;return o;})());
          btn.classList.toggle('on');
          btn.innerHTML = ic(nv ? 'check' : 'x', 12) + ' ' + btn.textContent.trim();
          toast('Kelengkapan dokumen diperbarui', 'ok');
        } catch (err) { toast(err.message, 'err'); }
      }));
      return;
    }

    if (key === 'repair' || key === 'doc') renderCostTab(ov, u, key, body, canRepair, canDocs, (r) => Object.assign(u, r));
    else if (key === 'foto') renderFotoTab(ov, u, body);
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
      '<td style="text-align:right"><b class="num">' + fmtRp(i.total) + '</b>' +
        (i.lunas ? '<div class="cell-sub profit-chip up">✓ LUNAS</div>' : '<div class="cell-sub due-red num">Sisa ' + fmtRp(i.sisa) + '</div>') + '</td>' +
      '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="pay" data-id="' + i.id + '" title="Kelola pembayaran/cicilan">' + ic('wallet', 17) + '</button>' +
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
      else if (b.dataset.act === 'pay') paymentsManager(inv.id);
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
  let units, customers = [];
  try {
    const r = await Promise.all([API.get('/units'), API.get('/customers').catch(() => [])]);
    units = r[0]; customers = r[1];
  } catch (err) { toast(err.message, 'err'); return; }

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
    '<label>Pelanggan Terdaftar</label>' +
    '<select name="customerId"><option value="">— Pelanggan baru / isi manual —</option>' +
      customers.map((cu) => '<option value="' + cu.id + '">' + esc(cu.name + (cu.phone ? ' · ' + cu.phone : '')) + '</option>').join('') + '</select>' +
    '<div class="form-grid">' +
      '<div><label>Nama Pembeli *</label><input name="buyerName" placeholder="Nama lengkap"></div>' +
      '<div><label>No. Telepon</label><input name="buyerPhone" placeholder="08xx-xxxx-xxxx"></div>' +
    '</div>' +
    '<label>Alamat Pembeli</label><textarea name="buyerAddress" placeholder="Alamat pembeli…"></textarea>' +
    '<div class="form-grid">' +
      '<div><label>Harga Jual (Rp)</label><input name="sellPrice" class="rp" inputmode="numeric" placeholder="0"></div>' +
      '<div><label>Diskon (Rp)</label><input name="discount" class="rp" inputmode="numeric" placeholder="0"></div>' +
      '<div><label>DP Diterima (Rp)</label><input name="dpAmount" class="rp" inputmode="numeric" placeholder="0"></div>' +
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
        customerId: f.customerId.value,
        buyerName: f.buyerName.value.trim(),
        buyerPhone: f.buyerPhone.value.trim(),
        buyerAddress: f.buyerAddress.value.trim(),
        sellPrice: parseRp(f.sellPrice.value),
        discount: parseRp(f.discount.value),
        dpAmount: parseRp(f.dpAmount.value),
        paymentMethod: f.paymentMethod.value,
        date: f.date.value,
        note: f.note.value.trim()
      });
      closeModal(ov);
      toast('Invoice ' + r.invoice.number + ' dibuat — unit terjual!', 'ok');
      go(S.page);
      setTimeout(() => paymentsManager(r.invoice.id), 350);
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
      '<div style="display:flex;gap:30px;margin-top:12px;font-size:.86rem">' +
        '<span>Dibayar: <b class="num">' + fmtRp(inv.paid != null ? inv.paid : inv.total) + '</b></span>' +
        ((inv.sisa != null ? inv.sisa : 0) > 0
          ? '<span>Sisa tagihan: <b class="num" style="color:var(--red)">' + fmtRp(inv.sisa) + '</b></span>'
          : '<span style="color:var(--green);font-weight:800">LUNAS ✓</span>') +
      '</div>' +
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
      '<p class="sub">Hover angka laba untuk melihat rumus lengkapnya</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn ghost sm" id="exp-units">' + ic('download', 14) + ' Stok</button>' +
        '<button class="btn ghost sm" id="exp-inv">' + ic('download', 14) + ' Invoice</button>' +
        '<button class="btn ghost sm" id="exp-profit">' + ic('download', 14) + ' Laba/Rugi</button>' +
        '<input type="month" id="r-month" class="filter" value="">' +
        '<button class="btn ghost sm" id="r-clear">Semua Periode</button>' +
      '</div></div>' +
    '<div id="r-table"></div>' +
    '<div class="card" style="margin-top:18px"><h3 style="display:flex;align-items:center;gap:8px">' + ic('wallet', 18) +
      ' Komisi &amp; Target Sales <select id="cm-month" class="filter" style="margin-left:auto;width:auto"></select></h3>' +
      '<div id="cm-body"><p style="color:var(--muted);font-size:.86rem">Memuat…</p></div></div>';

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

  /* ekspor CSV */
  $('#exp-units').addEventListener('click', () => downloadCsv('/export/units.csv', 'stok-unit.csv'));
  $('#exp-inv').addEventListener('click', () => downloadCsv('/export/invoices.csv', 'invoice.csv'));
  $('#exp-profit').addEventListener('click', () => {
    const mv = $('#r-month').value;
    const q = mv ? ('?from=' + mv + '-01&to=' + mv + '-31') : '';
    downloadCsv('/export/profit.csv' + q, 'laba-rugi.csv');
  });

  /* komisi & target sales */
  const cmSel = $('#cm-month');
  const nowM = isoMonth(new Date());
  for (let k = 5; k >= 0; k--) {
    const d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() - k);
    const key = isoMonth(d0);
    cmSel.insertAdjacentHTML('beforeend',
      '<option value="' + key + '"' + (key === nowM ? ' selected' : '') + '>' + monthLabel(key) + '</option>');
  }
  async function loadComm() {
    const mm = cmSel.value || nowM;
    try {
      const r = await API.get('/reports/commissions?month=' + mm);
      const bodyEl = $('#cm-body');
      if (!r.rows.length) {
        bodyEl.innerHTML = '<p style="color:var(--muted);font-size:.86rem">Belum ada penjualan pada ' + monthLabel(mm) + '.</p>';
        return;
      }
      bodyEl.innerHTML =
        '<div class="table-wrap" style="box-shadow:none;border:none"><table class="data" style="min-width:520px">' +
        '<thead><tr><th>Sales</th><th style="text-align:right">Unit</th><th style="text-align:right">Omzet</th>' +
        '<th style="text-align:right">Laba</th><th style="text-align:right">Target</th><th>Capaian</th><th style="text-align:right">Komisi</th></tr></thead><tbody>' +
        r.rows.map((a) => {
          const pctTxt = a.pct == null ? '—' : a.pct + '%';
          const col = a.pct != null && a.pct >= 100 ? 'var(--green)' : (a.pct != null && a.pct >= 70 ? 'var(--orange)' : 'var(--red)');
          return '<tr><td><div class="cell-main">' + esc(a.name) + '</div><div class="cell-sub">' + esc(a.role) +
            ' · komisi ' + a.komisiPersen + '% dari laba</div></td>' +
            '<td class="num" style="text-align:right">' + a.count + '</td>' +
            '<td class="num" style="text-align:right">' + fmtRp(a.omzet) + '</td>' +
            '<td class="num" style="text-align:right;color:' + (a.laba >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtRp(a.laba) + '</td>' +
            '<td class="num" style="text-align:right">' + (a.target ? fmtRp(a.target) : '—') + '</td>' +
            '<td style="min-width:120px"><div class="track"><div class="fill hot" style="width:' +
              (a.pct == null ? 0 : Math.min(100, a.pct)) + '%"></div></div>' +
            '<div class="cell-sub num" style="color:' + col + '">' + pctTxt + ' capaian</div></td>' +
            '<td class="num" style="text-align:right"><b>' + fmtRp(a.komisi) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>';
    } catch (err) { $('#cm-body').innerHTML = '<p class="due-red">' + esc(err.message) + '</p>'; }
  }
  cmSel.addEventListener('change', loadComm);
  loadComm();
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
      '<div><label>Komisi dari Laba (%)</label><input type="number" name="komisiPersen" min="0" max="100" value="' + (isEdit && user.komisiPersen != null ? user.komisiPersen : 0) + '"></div>' +
      '<div><label>Target Omzet / Bulan (Rp)</label><input name="targetBulanan" class="rp" inputmode="numeric" value="' + (isEdit && user.targetBulanan ? Number(user.targetBulanan).toLocaleString('id-ID') : '0') + '"></div>' +
    '</div>' +
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
      komisiPersen: parseInt(f.komisiPersen.value, 10) || 0,
      targetBulanan: parseRp(f.targetBulanan.value),
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

/* ---------- Pelanggan ---------- */
async function pageCustomers() {
  if (S.user.role === 'mekanik') { $('#content').innerHTML = '<div class="card"><div class="alert error">Tidak diizinkan.</div></div>'; return; }
  const c = $('#content');
  c.innerHTML = '<div class="empty-state"><p>Memuat pelanggan…</p></div>';
  let list;
  try { list = await API.get('/customers'); }
  catch (err) { c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>'; return; }

  c.innerHTML =
    '<div class="toolbar"><div class="search-box">' + ic('search') + '<input id="c-q" type="text" placeholder="Cari nama / telepon…"></div>' +
    '<button class="btn primary" id="btn-add-cust">' + ic('plus', 16) + ' Tambah Pelanggan</button></div>' +
    '<div id="c-table"></div>';

  function render() {
    const q = ($('#c-q').value || '').toLowerCase();
    let rows = list;
    if (q) rows = rows.filter((x) => [x.name, x.phone, x.address].join(' ').toLowerCase().includes(q));
    const trs = rows.map((cu) =>
      '<tr data-cust="' + cu.id + '" style="cursor:pointer">' +
      '<td><div class="cell-main">' + esc(cu.name) + '</div><div class="cell-sub">' + esc(cu.phone || '—') + '</div></td>' +
      '<td>' + esc(cu.address || '—') + '</td>' +
      '<td style="text-align:right" class="num">' + (cu.totalTransaksi || 0) + 'x</td>' +
      '<td style="text-align:right" class="num"><b>' + fmtRp(cu.omzet || 0) + '</b></td>' +
      '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + cu.id + '" title="Ubah">' + ic('pencil', 16) + '</button>' +
        '<button class="icon-btn red" data-act="del" data-id="' + cu.id + '" title="Hapus">' + ic('trash', 16) + '</button>' +
      '</div></td></tr>').join('');
    $('#c-table').innerHTML = '<div class="table-wrap"><table class="data">' +
      '<thead><tr><th>Nama</th><th>Alamat</th><th style="text-align:right">Transaksi</th><th style="text-align:right">Total Belanja</th><th style="text-align:right">Aksi</th></tr></thead>' +
      '<tbody>' + (trs || emptyRow(5)) + '</tbody></table></div>';
    $$('tr[data-cust]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      const cu = list.find((x) => x.id === tr.dataset.cust); if (cu) customerDetail(cu.id);
    }));
    $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const cu = list.find((x) => x.id === b.dataset.id); if (!cu) return;
      if (b.dataset.act === 'edit') customerForm(cu, () => pageCustomers());
      else {
        if (!(await confirmDlg('Hapus Pelanggan?', '<b>' + esc(cu.name) + '</b> akan dihapus permanen.'))) return;
        try { await API.del('/customers/' + cu.id); toast('Pelanggan dihapus', 'ok'); pageCustomers(); }
        catch (err) { toast(err.message, 'err'); }
      }
    }));
  }
  $('#c-q').addEventListener('input', render);
  $('#btn-add-cust').addEventListener('click', () => customerForm(null, () => pageCustomers()));
  render();
}

function customerForm(cust, onDone) {
  const isEdit = !!cust;
  const ov = openModal(
    '<div class="m-head"><h3>' + (isEdit ? 'Ubah Pelanggan' : 'Tambah Pelanggan') + '</h3><button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<form id="cf-form"><div class="alert error hidden" id="cf-err"></div>' +
    '<label>Nama *</label><input name="name" value="' + esc(isEdit ? cust.name : '') + '" placeholder="Nama lengkap">' +
    '<label>Telepon</label><input name="phone" value="' + esc(isEdit ? (cust.phone || '') : '') + '" placeholder="08xx…">' +
    '<label>Alamat</label><textarea name="address">' + esc(isEdit ? (cust.address || '') : '') + '</textarea>' +
    '<label>Catatan</label><textarea name="notes" placeholder="minat, riwayat…">' + esc(isEdit ? (cust.notes || '') : '') + '</textarea>' +
    '<div class="m-actions"><button type="button" class="btn ghost" data-close>Batal</button><button type="submit" class="btn primary">Simpan</button></div></form>');
  $('#cf-form', ov).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = { name: f.name.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(), notes: f.notes.value.trim() };
    try {
      if (isEdit) await API.put('/customers/' + cust.id, body);
      else await API.post('/customers', body);
      closeModal(ov); toast('Pelanggan tersimpan', 'ok'); if (onDone) onDone();
    } catch (err) { showFieldErrors(ov, err.data && err.data.errors, $('#cf-err', ov)); if (!err.data || !err.data.errors) toast(err.message, 'err'); }
  });
}

async function customerDetail(id) {
  let all;
  try { all = await Promise.all([API.get('/customers'), API.get('/invoices')]); }
  catch (err) { toast(err.message, 'err'); return; }
  const cu = all[0].find((x) => x.id === id);
  if (!cu) { toast('Pelanggan tidak ditemukan', 'err'); return; }
  const invs = all[1].filter((i) => i.customerId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const omzet = invs.reduce((s, i) => s + i.total, 0);
  openModal(
    '<div class="m-head"><div><h3>' + esc(cu.name) + '</h3><p class="m-sub">' + esc(cu.phone || '—') + ' · ' + esc(cu.address || '—') + '</p></div><button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<div class="info-grid" style="margin-top:12px">' +
      infoItem('Transaksi', invs.length + 'x') +
      infoItem('Total Belanja', fmtRp(omzet)) +
      (cu.notes ? infoItem('Catatan', esc(cu.notes)) : '') +
    '</div>' +
    '<label style="margin-top:18px">Riwayat Invoice</label>' +
    (invs.length
      ? '<div class="cost-list">' + invs.map((i) =>
          '<div class="cost-row"><span class="mono">' + esc(i.number) + '</span>' +
          '<div class="cost-info"><strong>' + esc(i.snapshot.name) + '</strong><span>' + fmtDate(i.date) + '</span></div>' +
          '<span class="' + (i.lunas ? '' : 'due-red') + '" style="font-weight:800;font-size:.8rem">' + (i.lunas ? 'LUNAS' : 'Sisa ' + fmtRp(i.sisa)) + '</span>' +
          '<button class="icon-btn" data-print-inv="' + i.id + '" title="Cetak">' + ic('printer', 16) + '</button></div>').join('') + '</div>'
      : '<p style="color:var(--muted);font-size:.88rem;padding:8px 0">Belum ada transaksi.</p>'),
    { wide: true });
  $$('[data-print-inv]').forEach((b) => b.addEventListener('click', () => {
    const i = invs.find((x) => x.id === b.dataset.printInv);
    if (i) printInvoice(i);
  }));
}

/* ---------- Pembayaran invoice ---------- */
async function paymentsManager(invId) {
  let r;
  try { r = await API.get('/invoices/' + invId); } catch (err) { toast(err.message, 'err'); return; }
  const inv = r.invoice;
  const canPay = S.user.role === 'admin' || S.user.role === 'sales';
  const pct = Math.min(100, Math.round(inv.paid / Math.max(1, inv.total) * 100));
  const rows = inv.payments.map((p) =>
    '<div class="cost-row"><div class="cost-ico doc">' + ic('wallet', 15) + '</div>' +
    '<div class="cost-info"><strong class="num">' + fmtRp(p.amount) + '</strong>' +
    '<span>' + fmtDate(p.date) + ' · ' + p.method + (p.note ? ' · ' + esc(p.note) : '') + '</span></div>' +
    (canPay ? '<button class="icon-btn red" data-pay-del="' + p.id + '">' + ic('trash', 15) + '</button>' : '') +
    '</div>').join('');

  const ov = openModal(
    '<div class="m-head"><div><h3>Pembayaran</h3><p class="m-sub mono">' + esc(inv.number) + '</p></div>' +
    '<button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<p style="font-size:.9rem;margin-bottom:10px"><b>' + esc(inv.buyer.name) + '</b> · ' + esc(inv.snapshot.name) + '</p>' +
    '<div class="sum-bars" style="margin:0 0 6px">' +
      sbar('Dibayar ' + fmtRp(inv.paid), inv.paid, pct, 'hot') +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:8px">' +
      '<span class="' + (inv.lunas ? 'profit-chip up' : 'due-red') + '">' + (inv.lunas ? '✓ LUNAS' : 'Sisa ' + fmtRp(inv.sisa)) + '</span>' +
      '<b class="num">Total ' + fmtRp(inv.total) + '</b></div>' +
    '<div class="cost-list">' + (rows || '<p style="color:var(--muted);font-size:.86rem;padding:6px 0">Belum ada pembayaran dicatat.</p>') + '</div>' +
    (canPay && !inv.lunas ?
      '<form class="cost-add-form" id="pay-form" style="margin-top:14px">' +
      '<input type="date" name="date" value="' + todayISO() + '">' +
      '<input type="text" class="rp" name="amount" inputmode="numeric" placeholder="Nominal Rp">' +
      '<select name="method"><option value="tunai">Tunai</option><option value="transfer">Transfer</option><option value="dp">DP</option><option value="kredit">Kredit</option></select>' +
      '<input type="text" name="note" placeholder="Catatan" style="grid-column:1/-1;margin-top:2px">' +
      '<button type="submit" class="btn primary sm" style="grid-column:1/-1">' + ic('plus', 14) + ' Catat Pembayaran</button>' +
      '</form>' : '') +
    '<div class="m-actions"><button class="btn yellow sm" id="pay-print">' + ic('printer', 15) + ' Cetak Invoice</button></div>',
    { wide: true });

  $('#pay-print', ov).addEventListener('click', () => printInvoice(inv));
  $$('[data-pay-del]', ov).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDlg('Hapus Pembayaran?', 'Catatan pembayaran ini akan dihapus dari invoice.'))) return;
    try {
      await API.del('/invoices/' + invId + '/payments/' + b.dataset.payDel);
      toast('Pembayaran dihapus', 'ok');
      closeModal(ov); paymentsManager(invId); go(S.page);
    } catch (err) { toast(err.message, 'err'); }
  }));
  const form = $('#pay-form', ov);
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.post('/invoices/' + invId + '/payments',
        { date: form.date.value, amount: parseRp(form.amount.value), method: form.method.value, note: form.note.value.trim() });
      toast('Pembayaran tercatat 🎉', 'ok');
      closeModal(ov); paymentsManager(invId); go(S.page);
    } catch (err) { toast(err.message, 'err'); }
  });
}

/* ---------- Ubah password sendiri ---------- */
function changePasswordModal() {
  const ov = openModal(
    '<div class="m-head"><h3>Ubah Password Saya</h3><button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<form id="pw-form"><div class="alert error hidden" id="pw-err"></div>' +
    '<label>Password Lama *</label><input type="password" name="old" autocomplete="current-password">' +
    '<label>Password Baru *</label><input type="password" name="nw" autocomplete="new-password" placeholder="min. 5 karakter">' +
    '<label>Ulangi Password Baru *</label><input type="password" name="nw2" autocomplete="new-password">' +
    '<div class="m-actions"><button type="button" class="btn ghost" data-close>Batal</button><button type="submit" class="btn primary">Simpan Password</button></div></form>');
  $('#pw-form', ov).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const errBox = $('#pw-err', ov);
    if (f.nw.value !== f.nw2.value) {
      errBox.textContent = 'Konfirmasi password baru tidak sama'; errBox.classList.remove('hidden'); return;
    }
    try {
      await API.post('/auth/change-password', { oldPassword: f.old.value, newPassword: f.nw.value });
      closeModal(ov); toast('Password berhasil diganti 🔒', 'ok');
    } catch (err) { showFieldErrors(ov, err.data && err.data.errors, $('#pw-err', ov)); }
  });
}

/* ---------- Ekspor CSV ---------- */
async function downloadCsv(path, filename) {
  /* Mode demo (Netlify/statis): generate CSV di browser */
  if (API.mode === 'demo') {
    try {
      const r = await API.get(path);
      const blob = new Blob([r.__csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('File diunduh: ' + filename, 'ok');
    } catch (err) { toast(err.message, 'err'); }
    return;
  }
  try {
    const res = await fetch('/api' + path, { headers: API.token ? { Authorization: 'Bearer ' + API.token } : {} });
    if (!res.ok) { toast('Ekspor gagal (' + res.status + ')', 'err'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('File diunduh: ' + filename, 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

/* ---------- BASTD (Berita Acara Serah Terima Dokumen) ---------- */
const DOC_LIST = [['stnk','STNK'],['bpkb','BPKB'],['faktur','Faktur'],['formA','Form A'],['ktp','KTP'],['lainnya','Lainnya']];
const DOC_LABEL = {}; DOC_LIST.forEach(([k, l]) => { DOC_LABEL[k] = l; });

function docBadge(key) {
  const cls = key === 'bpkb' ? 'terlambat' : 'proses';
  return '<span class="badge bpkb-' + cls + '" style="font-size:.66rem">' + (DOC_LABEL[key] || key) + '</span>';
}

async function pageBastds() {
  if (S.user.role === 'mekanik') { $('#content').innerHTML = '<div class="card"><div class="alert error">Tidak diizinkan.</div></div>'; return; }
  const c = $('#content');
  c.innerHTML = '<div class="empty-state"><p>Memuat BASTD…</p></div>';
  let list;
  try { list = await API.get('/bastds'); }
  catch (err) { c.innerHTML = '<div class="card"><div class="alert error">' + esc(err.message) + '</div></div>'; return; }

  c.innerHTML =
    '<div class="toolbar"><div class="search-box">' + ic('search') +
      '<input id="b-q" type="text" placeholder="Cari no BASTD / unit / pembeli…"></div>' +
    '<button class="btn primary" id="btn-add-bastd">' + ic('plus', 16) + ' Buat BASTD</button></div>' +
    '<div id="b-table"></div>';

  function render() {
    const q = ($('#b-q').value || '').toLowerCase();
    let rows = list;
    if (q) rows = rows.filter((x) => [x.number, x.snapshot && x.snapshot.unitName, x.snapshot && x.snapshot.buyerName]
      .join(' ').toLowerCase().includes(q));
    const trs = rows.map((d) =>
      '<tr data-bastd="' + d.id + '" style="cursor:pointer">' +
      '<td><span class="mono">' + esc(d.number) + '</span><div class="cell-sub">' + fmtDate(d.date) + '</div></td>' +
      '<td><div class="cell-main">' + esc(d.snapshot.unitName) + '</div>' +
        '<div class="cell-sub">' + esc(d.snapshot.nopol || d.snapshot.unitCode) + '</div></td>' +
      '<td><div class="cell-main">' + esc(d.snapshot.buyerName) + '</div>' +
        '<div class="cell-sub">' + esc(d.snapshot.buyerPhone || '') + '</div></td>' +
      '<td><div class="bastd-docs">' + d.type.map(docBadge).join('') + '</div></td>' +
      '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(d.createdBy || '—') + '</td>' +
      '<td><div class="cell-actions">' +
        '<button class="icon-btn" data-act="print" data-id="' + d.id + '" title="Cetak">' + ic('printer', 17) + '</button>' +
        (S.perm.manageUsers ? '<button class="icon-btn red" data-act="del" data-id="' + d.id + '" title="Hapus (admin)">' + ic('trash', 16) + '</button>' : '') +
      '</div></td></tr>').join('');
    $('#b-table').innerHTML = '<div class="table-wrap"><table class="data">' +
      '<thead><tr><th>No. BASTD</th><th>Unit</th><th>Pembeli</th><th>Dokumen Diserahkan</th><th>Dibuat Oleh</th><th style="text-align:right">Aksi</th></tr></thead>' +
      '<tbody>' + (trs || emptyRow(6)) + '</tbody></table></div>';
    $$('tr[data-bastd]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      const d = list.find((x) => x.id === tr.dataset.bastd); if (d) printBastd(d);
    }));
    $$('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const d = list.find((x) => x.id === b.dataset.id); if (!d) return;
      if (b.dataset.act === 'print') printBastd(d);
      else {
        if (!(await confirmDlg('Hapus BASTD?', 'Dokumen <b>' + esc(d.number) + '</b> akan dihapus permanen.'))) return;
        try { await API.del('/bastds/' + d.id); toast('BASTD dihapus', 'ok'); pageBastds(); }
        catch (err) { toast(err.message, 'err'); }
      }
    }));
  }
  $('#b-q').addEventListener('input', render);
  $('#btn-add-bastd').addEventListener('click', () => bastdForm());
  render();
}

/* ---------- Form BASTD ---------- */
function bastdDocRow() {
  return '<div class="doc-grid-row">' +
    '<select class="bf-key">' + DOC_LIST.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select>' +
    '<input type="text" class="bf-num" placeholder="Nomor dokumen (sesuai fisik)">' +
    '<button type="button" class="icon-btn red" data-dr-del title="Hapus baris">' + ic('trash', 15) + '</button>' +
  '</div>';
}

async function bastdForm() {
  let units;
  try { units = await API.get('/units'); }
  catch (err) { toast(err.message, 'err'); return; }

  const sold = units.filter((u) => u.invoiceId);
  if (!sold.length) { toast('Belum ada unit terjual — buat invoice terlebih dahulu', 'err'); return; }

  const ov = openModal(
    '<div class="m-head"><div><h3>Buat BASTD</h3>' +
    '<p class="m-sub">Berita Acara Serah Terima Dokumen — centang dokumen yang diserahkan ke pembeli beserta nomornya.</p></div>' +
    '<button class="icon-btn" data-close>' + ic('x') + '</button></div>' +
    '<form id="bf-form"><div class="alert error hidden" id="bf-err"></div>' +
    '<label>Unit Terjual *</label>' +
    '<select name="unitId">' +
      sold.map((u) => '<option value="' + u.id + '">' + esc(u.code + ' · ' + u.name + ' (' + u.year + ')') + '</option>').join('') +
    '</select>' +
    '<div id="bf-buyer" class="alert ok" style="margin-top:10px"></div>' +
    '<div class="form-grid">' +
      '<div><label>Tanggal Serah Terima *</label><input type="date" name="date" value="' + todayISO() + '"></div>' +
    '</div>' +
    '<label style="margin-top:16px">Dokumen yang Diserahkan *</label>' +
    '<div id="bf-docs"></div>' +
    '<button type="button" class="btn ghost sm" id="bf-add" style="margin-top:8px">' + ic('plus', 13) + ' Tambah Dokumen</button>' +
    '<label style="margin-top:14px">Catatan</label>' +
    '<input type="text" name="note" placeholder="Catatan opsional…">' +
    '<div class="m-actions">' +
      '<button type="button" class="btn ghost" data-close>Batal</button>' +
      '<button type="submit" class="btn primary">' + ic('check', 15) + ' Simpan &amp; Cetak</button>' +
    '</div></form>',
    { wide: true }
  );

  const body = $('#bf-docs', ov);
  function addRow() {
    body.insertAdjacentHTML('beforeend', bastdDocRow());
    const row = body.lastElementChild;
    row.querySelector('[data-dr-del]').addEventListener('click', () => {
      row.remove();
      if (!body.children.length) addRow();
    });
  }
  $('#bf-add', ov).addEventListener('click', addRow);
  addRow();

  /* preview pembeli saat unit dipilih */
  const buyerBox = $('#bf-buyer', ov);
  function showBuyer() {
    const sel = $('[name="unitId"]', f0());
    const u = units.find((x) => x.id === sel.value);
    if (!u) { buyerBox.textContent = 'Pembeli: —'; return; }
    const inv = invoices.find((i) => i.unitId === u.id);
    buyerBox.textContent = 'Pembeli: ' + (inv && inv.buyer ? inv.buyer.name : '—') +
      (inv && inv.date ? ' · Tgl jual ' + fmtDate(inv.date) : '');
  }
  const f0 = () => $('#bf-form', ov);
  f0().unitId.addEventListener('change', showBuyer);
  showBuyer();

  $('#bf-form', ov).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const items = Array.from(body.querySelectorAll('.doc-grid-row')).map((r) => ({
      key: r.querySelector('.bf-key').value,
      number: r.querySelector('.bf-num').value.trim()
    })).filter((x) => x.number || DOC_LIST.some(([k]) => k === x.key));
    try {
      const r = await API.post('/bastds', { unitId: f.unitId.value, date: f.date.value, items, note: f.note.value.trim() });
      closeModal(ov);
      toast('BASTD ' + r.bastd.number + ' tersimpan' +
        (r.bastd.type.includes('bpkb') ? ' — status BPKB otomatis SIAP ✅' : ''), 'ok');
      go(S.page);
      setTimeout(() => printBastd(r.bastd), 350);
    } catch (err) {
      showFieldErrors(ov, err.data && err.data.errors, $('#bf-err', ov));
      if (!err.data || !err.data.errors) toast(err.message, 'err');
    }
  });
}

/* ---------- Cetak BASTD ---------- */
function printBastd(d) {
  const s = d.snapshot;
  const itemRows = d.items.map((it, idx) =>
    '<tr><td style="text-align:center;width:46px">' + (idx + 1) + '</td>' +
    '<td><b>' + esc(DOC_LABEL[it.key] || it.key) + '</b></td>' +
    '<td class="num">' + esc(it.number || '—') + '</td></tr>').join('');

  const ov = document.createElement('div');
  ov.id = 'print-overlay';
  ov.innerHTML =
    '<div class="print-bar">' +
      '<button class="btn yellow sm" id="pb-print">' + ic('printer', 15) + ' Cetak</button>' +
      '<button class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.3)" id="pb-close">' + ic('x', 15) + ' Tutup</button>' +
    '</div>' +
    '<div class="invoice-sheet bastd-sheet">' +
      '<div class="inv-head">' +
        '<div class="inv-brand"><div class="logo-badge">' + LOGO_SVG + '</div><div>' +
          '<h4>' + esc(SHOP.name) + '</h4><p>' + esc(SHOP.tagline) + '<br>' + esc(SHOP.addr) + '<br>' + esc(SHOP.phone) + '</p></div></div>' +
        '<div class="inv-title"><div class="word">BASTD</div>' +
          '<div class="no">' + esc(d.number) + '</div>' +
          '<div class="dt">Tanggal: ' + fmtDate(d.date || d.createdAt) + '</div></div>' +
      '</div>' +
      '<div class="inv-strip"></div>' +
      '<div class="bastd-title">' +
        '<h2>BERITA ACARA SERAH TERIMA DOKUMEN</h2>' +
        '<p>Pada hari ini tanggal sebagaimana tercantum di atas, kami yang bertanda tangan di bawah ini<br>' +
        'menyatakan telah melakukan serah terima dokumen kepemilikan kendaraan dengan rincian sebagai berikut:</p>' +
      '</div>' +
      '<div class="inv-meta" style="margin-top:18px">' +
        '<div class="blk"><div class="h">Pihak Pertama (Menyerahkan)</div><div class="n">' + esc(SHOP.name) + '</div>' +
          '<p>' + esc(SHOP.addr) + '<br>' + esc(SHOP.phone) + '<br>Perwakilan: <b>' + esc(d.createdBy || '—') + '</b></p></div>' +
        '<div class="blk"><div class="h">Pihak Kedua (Menerima)</div><div class="n">' + esc(s.buyerName) + '</div>' +
          '<p>' + esc(s.buyerAddress || '—') + (s.buyerPhone ? '<br>Telp: ' + esc(s.buyerPhone) : '') + '</p></div>' +
      '</div>' +
      '<table class="inv-items" style="margin-top:6px">' +
        '<thead><tr><th colspan="2">Identitas Kendaraan</th></tr></thead><tbody>' +
        '<tr><td style="width:42%">Merek / Type</td><td><b>' + esc(s.brand) + '</b> / ' + esc(s.unitName) + '</td></tr>' +
        '<tr><td>Tahun &amp; Warna</td><td>' + s.year + ' · ' + esc(s.color || '-') + '</td></tr>' +
        '<tr><td>Nomor Polisi</td><td><b>' + esc(s.nopol || '—') + '</b></td></tr>' +
        '<tr><td>Nomor Rangka</td><td class="num">' + esc(s.noRangka || '—') + '</td></tr>' +
        '<tr><td>Nomor Mesin</td><td class="num">' + esc(s.noMesin || '—') + '</td></tr>' +
      '</tbody></table>' +
      '<label style="margin-top:20px;color:#33475b;font-weight:800;font-size:.85rem">DOKUMEN YANG DISERAHKAN:</label>' +
      '<table class="inv-items"><thead><tr><th style="width:46px;text-align:center">No</th><th>Jenis Dokumen</th><th>Nomor / Keterangan</th></tr></thead>' +
      '<tbody>' + itemRows + '</tbody></table>' +
      '<div class="inv-note" style="margin-top:18px;line-height:1.7">Demikian Berita Acara Serah Terima Dokumen ini dibuat dengan sebenarnya, ' +
        'dokumen diserahkan dalam keadaan <b>lengkap dan baik</b> serta tanpa paksaan dari pihak manapun.' +
        (d.note ? '<br>Catatan: ' + esc(d.note) : '') + '</div>' +
      '<div class="inv-signs">' +
        '<div class="sg"><small>Pihak Pertama — Menyerahkan,</small><div class="line">( ' + esc(d.createdBy || SHOP.name) + ' )</div></div>' +
        '<div class="sg"><small>Pihak Kedua — Menerima,</small><div class="line">( ' + esc(s.buyerName) + ' )</div></div>' +
      '</div>' +
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
document.addEventListener('DOMContentLoaded', init);