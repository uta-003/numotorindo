/* ============================================================
   NuMotorindo Finance — Frontend SPA
   Login → Dashboard → Stok Motor (+biaya) → Laba Rugi
   → Invoice (cetak) → Pengaturan
============================================================ */
'use strict';

(() => {

  /* ================= Util dasar ================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0));
  const rp = (n) => 'Rp ' + fmtNum(n);
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d.getTime()) ? String(iso)
      : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const parseRp = (v) => {
    const n = Number(String(v == null ? '' : v).replace(/\D/g, ''));
    return isFinite(n) ? n : NaN;
  };

  /* Input rupiah: format titik ribuan sambil mengetik */
  function bindMoneyInputs(root) {
    $$('.rp', root || document).forEach((inp) => {
      if (inp.dataset.rpBound) return;
      inp.dataset.rpBound = '1';
      inp.setAttribute('inputmode', 'numeric');
      inp.addEventListener('input', () => {
        const digits = inp.value.replace(/\D/g, '').slice(0, 15);
        inp.value = digits ? fmtNum(digits) : '';
      });
    });
  }

  /* ================= Toast ================= */
  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    $('#toastRoot').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 3400);
  }

  /* ================= Dialog konfirmasi ================= */
  function confirmDlg(title, msg, danger) {
    return new Promise((resolve) => {
      openOverlay(`
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-head"><h3>${esc(title)}</h3></div>
          <div class="modal-body"><p class="confirm-text">${msg}</p></div>
          <div class="modal-foot">
            <button class="btn outline" data-act="no">Batal</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">Ya, Lanjutkan</button>
          </div>
        </div>`, true);
      $('#overlayRoot').addEventListener('click', handler);
      function handler(e) {
        const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
        if (!act && e.target.id !== 'overlayRoot') return;
        $('#overlayRoot').removeEventListener('click', handler);
        closeOverlay();
        resolve(act === 'yes');
      }
    });
  }

  /* ================= Overlay helper ================= */
  function openOverlay(innerHtml, center) {
    const root = $('#overlayRoot');
    root.innerHTML = `<div class="overlay${center ? ' center' : ''}">${innerHtml}</div>`;
    document.body.style.overflow = 'hidden';
    $$('.close-x', root).forEach((b) => b.addEventListener('click', closeOverlay));
    $$('.overlay', root).forEach((ov) => ov.addEventListener('mousedown', (e) => {
      if (center && e.target === ov) closeOverlay();
    }));
    return root;
  }
  function closeOverlay() {
    $('#overlayRoot').innerHTML = '';
    document.body.style.overflow = '';
  }

  /* ================= API client ================= */
  let TOKEN = localStorage.getItem('nmfin_token') || '';

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* respons kosong */ }
    if (!res.ok) {
      if (res.status === 401 && TOKEN) { TOKEN = ''; localStorage.removeItem('nmfin_token'); showLogin(); }
      const err = new Error(data.message || ('HTTP ' + res.status));
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ================= State & elemen ================= */
  const state = {
    user: null,
    settings: {},
    stok: { q: '', status: '' },
    opex: { month: '', category: '', last: null },
    report: { preset: 'bulan-ini', from: '', to: '' }
  };
  const LOGO_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="14" fill="url(#lgm3)"/><defs><linearGradient id="lgm3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D62828"/><stop offset=".6" stop-color="#F77F00"/><stop offset="1" stop-color="#FCBF49"/></linearGradient></defs><circle cx="17" cy="31" r="7.5" fill="none" stroke="#fff" stroke-width="3.5"/><circle cx="34" cy="31" r="7.5" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M8 18h14l4-5h8" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="34" cy="31" r="2.4" fill="#fff"/></svg>`;

  const view = () => $('#view');

  /* ================= Tampilan login / app ================= */
  function showLogin() {
    closeOverlay();
    $('#appShell').hidden = true;
    $('#authView').hidden = false;
    $('#liErr').hidden = true;
    $('#liUser').focus();
  }

  function enterApp() {
    $('#authView').hidden = true;
    $('#appShell').hidden = false;
    $('#uName').textContent = state.user.name;
    $('#uRole').textContent = state.user.role === 'admin' ? 'Administrator' : 'Staf Showroom';
    $('#uAvatar').textContent = (state.user.name || '?').charAt(0).toUpperCase();
    $('#navPengguna').hidden = !isAdmin();
    if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
    api('/settings').then((s) => { state.settings = s; }).catch(() => {});
    route();
  }

  /* ================= Router ================= */
  const ROUTES = {
    '#/dashboard': { title: '📊 Dashboard Laba Rugi', render: renderDashboard },
    '#/stok': { title: '🏍️ Stok Motor & Biaya', render: renderStok },
    '#/opex': { title: '💸 Biaya Operasional', render: renderOpex },
    '#/laba-rugi': { title: '💰 Laporan Laba Rugi', render: renderLabaRugi },
    '#/invoice': { title: '🧾 Daftar Invoice', render: renderInvoiceList },
    '#/pengaturan': { title: '⚙️ Pengaturan Showroom', render: renderPengaturan },
    '#/pengguna': { title: '👥 Pengguna Showroom', render: renderUsers }
  };

  function route() {
    let h = location.hash || '#/dashboard';
    if (!ROUTES[h]) h = '#/dashboard';
    $$('#sideNav a').forEach((a) => a.classList.toggle('active', a.dataset.route === h));
    $('#pageTitle').textContent = ROUTES[h].title;
    $('#sidebar').classList.remove('open');
    ROUTES[h].render();
  }

  /* ================= Cetak elemen ================= */
  function printTarget(el) {
    el.classList.add('print-target');
    document.body.classList.add('printing');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      document.body.classList.remove('printing');
      el.classList.remove('print-target');
      window.removeEventListener('afterprint', finish);
    };
    window.addEventListener('afterprint', finish);
    setTimeout(finish, 2500); // jaring pengaman bila afterprint tidak terpicu
    window.print();
  }

  /* ================= Helper tambahan ================= */
  const isAdmin = () => !!state.user && state.user.role === 'admin';

  /* umur stok dalam hari sejak tanggal beli */
  const stockDays = (u) => {
    if (!u.purchase || !u.purchase.date) return 0;
    return Math.floor((Date.now() - new Date(u.purchase.date + 'T00:00:00').getTime()) / 864e5);
  };

  /* unduh array-of-array sebagai CSV (BOM + pemisah ; agar rapi di Excel ID) */
  function downloadCsv(filename, rows) {
    const escCsv = (v) => {
      v = String(v == null ? '' : v);
      return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const csv = '\uFEFF' + rows.map((r) => r.map(escCsv).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ================= Halaman: Dashboard ================= */
  async function renderDashboard() {
    view().innerHTML = '<p class="empty"><span class="big">⏳</span>Memuat data dashboard…</p>';
    let s;
    try { s = await api('/stats'); }
    catch (err) { return renderError(err); }

    const maxBar = Math.max(1, ...s.monthly.map((m) => Math.abs(m.profit)));
    const bars = s.monthly.map((m) => {
      const h = Math.max(4, Math.round(Math.abs(m.profit) / maxBar * 130));
      return `<div class="bar-col" title="${esc(m.label)}: ${rp(m.revenue)} · modal ${rp(m.cost)}">
        <span class="bar-val">${m.profit ? fmtNum(m.profit / 1000) + 'rb' : '—'}</span>
        <div class="bar${m.profit ? '' : ' zero'}" style="height:${h}px"></div>
        <span class="bar-lbl">${esc(m.label)}</span>
        <span class="bar-sub">laba bersih</span>
      </div>`;
    }).join('');

    const agingHtml = s.aging && s.aging.length
      ? s.aging.slice(0, 6).map((a) => `
          <div class="cost-item">
            <span class="ci-main"><b>${esc(a.name)}</b><small>${esc(a.code)}${a.plate ? ' · ' + esc(a.plate) : ''} · modal ${rp(a.modal)}</small></span>
            <span class="badge ${a.days >= 60 ? 'loss' : 'warn'}">${a.days} hari</span>
          </div>`).join('')
      : '<p class="empty" style="padding:10px">Semua stok sehat (≤ 30 hari). 👍</p>';

    const netAfter = s.netProfit - s.opexTotal;
    const taxHtml = s.taxDue && s.taxDue.length
      ? s.taxDue.map((x) => `
          <div class="cost-item">
            <span class="ci-main"><b>${esc(x.name)}</b><small>${esc(x.code)}${x.plate ? ' · ' + esc(x.plate) : ''} · ${fmtDate(x.dueDate)}</small></span>
            <span class="badge ${x.days <= 0 ? 'loss' : 'warn'}">${x.days <= 0 ? 'Lewat ' + Math.abs(x.days) + ' hr' : x.days + ' hr lagi'}</span>
          </div>`).join('')
      : '<p class="empty" style="padding:10px">Tidak ada pajak jatuh tempo ≤ 30 hari 👍</p>';

    const creditHtml = s.credits && s.credits.length
      ? s.credits.map((c) => `
          <div class="cost-item">
            <span class="ci-main"><b>${esc(c.buyerName)}</b><small>${esc(c.code)} · ${esc(c.leasing) || 'leasing'} · ${c.paid}/${c.tenor || '?'}x · sisa ${rp(c.remaining)}</small></span>
            <span style="display:flex;gap:6px;align-items:center">
              ${c.arrears > 0 ? `<span class="badge loss">Telat ${c.arrears} bln</span>` : '<span class="badge profit">Lancar</span>'}
              <button class="icon-btn orange" title="Tandai bayar 1 angsuran" data-pay="${esc(c.id)}" data-paid="${c.paid}">＋1</button>
            </span>
          </div>`).join('')
      : '<p class="empty" style="padding:10px">Belum ada penjualan kredit berjalan.</p>';

    const recent = s.recentInvoices.length
      ? s.recentInvoices.map((i) => `
          <div class="cost-item" style="cursor:pointer" data-inv="${esc(i.no)}">
            <span style="font-size:20px">🧾</span>
            <span class="ci-main"><b>${esc(i.name)}</b><small>${esc(i.no)} · ${fmtDate(i.date)} · ${esc(i.code)}</small></span>
            <span class="ci-amt">${rp(i.price)}</span>
          </div>`).join('')
      : '<p class="empty">Belum ada penjualan.</p>';

    view().innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-icon navy">🏍️</span><span><span class="stat-val">${s.availableCount}<small style="font-size:13px;color:var(--muted)">/${s.totalUnits}</small></span><span class="stat-lbl">Unit Tersedia</span></span></div>
        <div class="stat-card"><span class="stat-icon red">🏷️</span><span><span class="stat-val">${s.soldCount}</span><span class="stat-lbl">Unit Terjual</span></span></div>
        <div class="stat-card"><span class="stat-icon yellow">💼</span><span><span class="stat-val">${rp(s.investedAvailable)}</span><span class="stat-lbl">Modal Tertanam (stok)</span></span></div>
        <div class="stat-card"><span class="stat-icon orange">💸</span><span><span class="stat-val">${rp(s.opexMonth)}</span><span class="stat-lbl">OPEX Bulan Ini</span></span></div>
        <div class="stat-card"><span class="stat-icon ${netAfter >= 0 ? 'orange' : 'red'}">${netAfter >= 0 ? '📈' : '📉'}</span><span><span class="stat-val ${netAfter >= 0 ? 'pos' : 'neg'}">${rp(netAfter)}</span><span class="stat-lbl">Laba Bersih Setelah OPEX</span><span class="stat-sub">laba kotor ${rp(s.netProfit)}</span></span></div>
      </div>

      <div class="dash-cols">
        <div>
          <div class="card">
            <div class="card-head"><h3>Laba 6 Bulan Terakhir</h3><span class="hint">berdasarkan tanggal jual · dalam ribuan Rp</span></div>
            <div class="bars">${bars}</div>
          </div>

          <div class="card">
            <div class="card-head"><h3>Rincian Biaya Unit Terjual</h3></div>
            <div class="money-grid">
              <div class="money-box buy"><small>Pembelian</small><b>${rp(s.purchaseSold)}</b></div>
              <div class="money-box repair"><small>Perbaikan</small><b>${rp(s.repairSold)}</b></div>
              <div class="money-box doc"><small>Dokumen</small><b>${rp(s.docSold)}</b></div>
              <div class="money-box total"><small>Total Modal</small><b>${rp(s.modalSold)}</b></div>
              <div class="money-box profitbox"><small>Pendapatan</small><b>${rp(s.revenue)}</b></div>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-head"><h3>Aksi Cepat</h3></div>
            <div style="display:flex;flex-direction:column;gap:9px">
              <button class="btn primary block" data-go="#/stok" data-add>➕ Tambah Unit Baru</button>
              <button class="btn warn block" data-go="#/laba-rugi">💰 Lihat Laba Rugi</button>
              <button class="btn outline block" data-go="#/invoice">🧾 Daftar Invoice</button>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h3>📅 Pajak & STNK Jatuh Tempo</h3><span class="hint">unit tersedia, ≤ 30 hari</span></div>
            <div class="cost-list">${taxHtml}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>💳 Angsuran Kredit</h3><span class="hint">＋1 = tandai 1 angsuran dibayar</span></div>
            <div class="cost-list" id="creditList">${creditHtml}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>⏳ Stok Mengendap</h3><span class="hint">tersedia ≥ 30 hari${s.agingModal ? ' · total modal ' + rp(s.agingModal) : ''}</span></div>
            <div class="cost-list">${agingHtml}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Invoice Terbaru</h3><button class="btn outline sm" data-go="#/invoice">Semua →</button></div>
            <div class="cost-list" id="recentInv">${recent}</div>
          </div>
        </div>
      </div>`;

    $$('#recentInv [data-inv]', view()).forEach((el) =>
      el.addEventListener('click', () => showInvoice(el.dataset.inv)));

    /* tombol cepat tandai angsuran dibayar */
    $$('#creditList [data-pay]', view()).forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await api('/units/' + btn.dataset.pay + '/sale', {
          method: 'PATCH',
          body: { installmentsPaid: Number(btn.dataset.paid) + 1 }
        });
        toast('1 angsuran ditandai dibayar', 'ok');
        renderDashboard();
      } catch (err) { toast(err.message, 'err'); }
    }));
  }

  function renderError(err) {
    view().innerHTML = `<div class="card"><p class="empty"><span class="big">⚠️</span>${esc(err.message || 'Terjadi kesalahan')}</p></div>`;
  }

  /* ================= Halaman: Stok Motor ================= */
  async function renderStok() {
    view().innerHTML = `
      <div class="toolbar">
        <span class="search"><input id="stokQ" placeholder="Cari nama, merek, plat, kode…" value="${esc(state.stok.q)}"></span>
        <select id="stokStatus">
          <option value="">Semua Status</option>
          <option value="tersedia"${state.stok.status === 'tersedia' ? ' selected' : ''}>Tersedia</option>
          <option value="terjual"${state.stok.status === 'terjual' ? ' selected' : ''}>Terjual</option>
        </select>
        <button class="btn outline sm" id="btnStokCsv">⬇️ CSV</button>
        <span class="spacer"></span>
        <button class="btn primary" id="btnAddUnit">＋ Tambah Unit</button>
      </div>
      <div class="card" style="padding:14px 16px">
        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>Motor</th><th>Status</th><th class="num">Pembelian</th><th class="num">Perbaikan</th>
            <th class="num">Dokumen</th><th class="num">Total Modal</th><th class="num">Harga Jual</th><th class="num">Laba / Rugi</th><th></th>
          </tr></thead>
          <tbody id="tbodyStok"></tbody>
        </table></div>
      </div>`;

    $('#stokQ').addEventListener('input', debounce(loadStokRows, 320));
    $('#stokStatus').addEventListener('change', loadStokRows);
    $('#btnAddUnit').addEventListener('click', () => openUnitForm(null));
    $('#btnStokCsv').addEventListener('click', exportStokCsv);
    await loadStokRows();
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  async function loadStokRows() {
    state.stok.q = $('#stokQ') ? $('#stokQ').value : '';
    state.stok.status = $('#stokStatus') ? $('#stokStatus').value : '';
    const qs = new URLSearchParams();
    if (state.stok.q) qs.set('q', state.stok.q);
    if (state.stok.status) qs.set('status', state.stok.status);

    let units;
    try { units = await api('/units' + (qs.toString() ? '?' + qs : '')); }
    catch (err) { return renderError(err); }
    state.stok.last = units;

    const tbody = $('#tbodyStok');
    if (!units.length) {
      tbody.innerHTML = '<tr><td colspan="9"><p class="empty"><span class="big">🏍️</span>Tidak ada unit yang cocok.</p></td></tr>';
      return;
    }
    tbody.innerHTML = units.map((u) => {
      const t = u._totals || {};
      const profitCls = t.profit == null ? '' : t.profit >= 0 ? 'pos' : 'neg';
      return `<tr data-id="${u.id}">
        <td><span class="cell-main">${esc(u.name)}</span><span class="cell-sub">${esc(u.brand)} ${u.year} · ${esc(u.code)}${u.plate ? ' · ' + esc(u.plate) : ''}${u.status === 'tersedia' ? ' · ' + stockDays(u) + ' hari di stok' : ''}</span></td>
        <td><span class="badge ${u.status}">${u.status === 'terjual' ? 'Terjual' : 'Tersedia'}</span></td>
        <td class="num">${rp(t.purchase)}</td>
        <td class="num">${rp(t.repair)}</td>
        <td class="num">${rp(t.doc)}</td>
        <td class="num"><b>${rp(t.modal)}</b></td>
        <td class="num">${t.price != null ? rp(t.price) : '—'}</td>
        <td class="num ${profitCls}">${t.profit == null ? '—' : rp(t.profit)}</td>
        <td><span class="row-actions">
          <button class="icon-btn blue" title="Detail & biaya" data-act="detail">📋</button>
          <button class="icon-btn orange" title="Edit unit" data-act="edit">✏️</button>
          ${isAdmin() ? '<button class="icon-btn red" title="Hapus unit" data-act="del">🗑️</button>' : ''}
        </span></td>
      </tr>`;
    }).join('');

    $$('tr[data-id]', tbody).forEach((tr) => tr.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      e.stopPropagation();
      const id = tr.dataset.id;
      if (btn.dataset.act === 'detail') openUnitDetail(id);
      if (btn.dataset.act === 'edit') openUnitForm(id);
      if (btn.dataset.act === 'del') deleteUnit(id);
    }));
  }

  async function deleteUnit(id) {
    let name = id;
    try { name = (await api('/units/' + id)).name; } catch (e) { /* pakai id bila gagal */ }
    const ok = await confirmDlg('Hapus Unit',
      `Yakin menghapus <b>${esc(name)}</b>?<br>Semua riwayat biaya & invoice-nya ikut terhapus permanen.`, true);
    if (!ok) return;
    try {
      const r = await api('/units/' + id, { method: 'DELETE' });
      toast(r.message, 'ok');
      loadStokRows();
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ================= Form Tambah/Edit Unit ================= */
  async function openUnitForm(id) {
    let unit = null;
    if (id) {
      try { unit = await api('/units/' + id); }
      catch (err) { return toast(err.message, 'err'); }
    }
    const p = unit ? unit.purchase : {};
    openOverlay(`
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${unit ? '✏️ Edit Unit — ' + esc(unit.code) : '➕ Tambah Unit Motor'}</h3>
          <button class="close-x" aria-label="Tutup">✕</button></div>
        <form id="unitForm" novalidate><div class="modal-body">
          <label>Nama Motor *<input name="name" placeholder="mis. Honda Vario 160 ABS" value="${esc(unit && unit.name)}" required></label>
          <div class="grid2">
            <label>Merek *<input name="brand" placeholder="Honda / Yamaha / …" value="${esc(unit && unit.brand)}" required></label>
            <label>Tahun *<input name="year" type="number" min="1990" max="${new Date().getFullYear() + 1}" value="${unit ? unit.year : ''}" required></label>
          </div>
          <div class="grid3">
            <label>KM *<input name="km" type="number" min="0" placeholder="mis. 12000" value="${unit ? unit.km : ''}" required></label>
            <label>No. Polisi<input name="plate" placeholder="B 1234 XYZ" value="${esc(unit && unit.plate)}"></label>
            <label>Warna<input name="color" placeholder="Hitam Doff" value="${esc(unit && unit.color)}"></label>
          </div>
          <div class="section-title" style="margin-top:6px">Biaya Pembelian</div>
          <div class="grid2">
            <label>Harga Beli *<input name="price" class="rp" placeholder="mis. 25.000.000" value="${p.price ? fmtNum(p.price) : ''}" required></label>
            <label>Tanggal Beli *<input name="date" type="date" value="${esc(p.date || todayISO())}" required></label>
          </div>
          <div class="grid2">
            <label>Nama Penjual / Takeler<input name="seller" placeholder="opsional" value="${esc(p.seller)}"></label>
            <label>Catatan Pembelian<input name="note" placeholder="opsional" value="${esc(p.note)}"></label>
          </div>
          <div class="section-title">Pajak & Foto</div>
          <div class="grid2">
            <label>Jatuh Tempo Pajak Berikutnya
              <input name="taxDueDate" type="date" value="${esc((unit && unit.taxDueDate) || '')}">
            </label>
            <label>Foto Unit (opsional)
              <input name="photoFile" type="file" accept="image/png,image/jpeg,image/webp">
            </label>
          </div>
          <div id="photoWrap"${(unit && unit.photo) ? '' : ' hidden'}>
            <img id="photoPrev" src="${(unit && unit.photo) || ''}" alt="Foto unit"
                 style="max-width:180px;max-height:130px;border-radius:12px;border:1px solid var(--border);display:block;margin-bottom:8px">
            <button type="button" class="btn outline sm" id="btnDelPhoto">✕ Hapus Foto</button>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn outline" data-cancel>Batal</button>
          <button type="submit" class="btn primary">${unit ? 'Simpan Perubahan' : 'Tambah Unit'}</button>
        </div></form>
      </div>`, true);
    bindMoneyInputs($('#overlayRoot'));

    /* pratinjau & kelola foto (disimpan sebagai data URL) */
    let photoData = unit ? (unit.photo || '') : '';
    const photoWrap = $('#photoWrap', $('#overlayRoot'));
    const photoPrev = $('#photoPrev', $('#overlayRoot'));
    $('input[name="photoFile"]', $('#overlayRoot')).addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 480000) return toast('Ukuran foto maksimal ±450KB — kompres dulu ya', 'err');
      const reader = new FileReader();
      reader.onload = () => {
        photoData = String(reader.result);
        photoPrev.src = photoData;
        photoWrap.hidden = false;
      };
      reader.readAsDataURL(file);
    });
    $('#btnDelPhoto').addEventListener('click', () => {
      photoData = '';
      photoPrev.src = '';
      photoWrap.hidden = true;
      $('input[name="photoFile"]', $('#overlayRoot')).value = '';
    });

    $('[data-cancel]', $('#overlayRoot')).addEventListener('click', closeOverlay);
    $('#unitForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = {
        name: f.name.value, brand: f.brand.value,
        year: f.year.value, km: f.km.value,
        plate: f.plate.value, color: f.color.value,
        taxDueDate: f.taxDueDate.value || '',
        photo: photoData,
        purchase: { price: parseRp(f.price.value), date: f.date.value, seller: f.seller.value, note: f.note.value }
      };
      try {
        const saved = unit
          ? await api('/units/' + unit.id, { method: 'PUT', body })
          : await api('/units', { method: 'POST', body });
        toast(unit ? 'Perubahan tersimpan' : 'Unit ' + saved.code + ' ditambahkan', 'ok');
        closeOverlay();
        loadStokRows();
      } catch (err) {
        const errs = err.data && err.data.errors;
        toast(errs ? Object.values(errs)[0] : err.message, 'err');
      }
    });
  }

  /* ================= Drawer Detail Unit ================= */
  async function openUnitDetail(id) {
    let u;
    try { u = await api('/units/' + id); }
    catch (err) { return toast(err.message, 'err'); }

    const t = u._totals;
    openOverlay(`
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <span class="code-chip">${esc(u.code)}</span>
          <h3>${esc(u.name)}</h3>
          <span class="badge ${u.status}" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:${u.status === 'terjual' ? 'var(--yellow)' : '#9fe8bd'}">
            ${u.status === 'terjual' ? 'TERJUAL' : 'TERSEDIA'}</span>
          <button class="close-x" aria-label="Tutup">✕</button>
        </div>
        <div class="drawer-body">

          <div class="section-title">Informasi Unit</div>
          ${u.photo ? `<img src="${u.photo}" alt="Foto ${esc(u.name)}" style="max-width:230px;max-height:160px;border-radius:14px;border:1px solid var(--border);display:block;margin-bottom:10px">` : ''}
          <div class="info-grid">
            <div class="info-box"><small>Merek</small><b>${esc(u.brand)}</b></div>
            <div class="info-box"><small>Tahun</small><b>${esc(u.year)}</b></div>
            <div class="info-box"><small>Kilometer</small><b>${fmtNum(u.km)} km</b></div>
            <div class="info-box"><small>No. Polisi</small><b>${esc(u.plate) || '—'}</b></div>
            <div class="info-box"><small>Warna</small><b>${esc(u.color) || '—'}</b></div>
            <div class="info-box"><small>Dibeli dari</small><b>${esc(u.purchase.seller) || '—'}</b></div>
            <div class="info-box"><small>Tanggal Beli</small><b>${fmtDate(u.purchase.date)}</b></div>
            ${(u.taxDueDate && u.status === 'tersedia')
              ? (() => {
                  const dd = Math.ceil((new Date(u.taxDueDate + 'T00:00:00').getTime() - Date.now()) / 864e5);
                  return `<div class="info-box"><small>Jatuh Tempo Pajak</small><b>${fmtDate(u.taxDueDate)}</b><br>
                    <span class="badge ${dd <= 0 ? 'loss' : dd <= 30 ? 'warn' : 'tersedia'}" style="margin-top:4px">${dd <= 0 ? 'Lewat ' + Math.abs(dd) + ' hari' : dd + ' hari lagi'}</span></div>`;
                })()
              : ''}
            ${u.purchase.note ? `<div class="info-box"><small>Catatan</small><b>${esc(u.purchase.note)}</b></div>` : ''}
          </div>

          <div class="section-title">Ringkasan Finansial</div>
          <div class="money-grid">
            <div class="money-box buy"><small>Biaya Pembelian</small><b>${rp(t.purchase)}</b></div>
            <div class="money-box repair"><small>Perbaikan (${(u.repairs || []).length})</small><b>${rp(t.repair)}</b></div>
            <div class="money-box doc"><small>Dokumen (${(u.documents || []).length})</small><b>${rp(t.doc)}</b></div>
            <div class="money-box total"><small>Total Modal</small><b>${rp(t.modal)}</b></div>
            ${t.price != null
              ? `<div class="money-box buy"><small>Harga Jual</small><b>${rp(t.price)}</b></div>
                 <div class="money-box profitbox"><small>Laba / Rugi</small><b class="${t.profit >= 0 ? 'pos' : 'neg'}">${rp(t.profit)}</b></div>`
              : ''}
          </div>

          <div class="section-title">🔧 Biaya Perbaikan
            ${u.status === 'tersedia' ? '<button class="btn outline sm" id="btnAddRepair">＋ Tambah</button>' : ''}
          </div>
          <div class="cost-list" id="listRepairs"></div>
          <form class="inline-form" id="formRepair" hidden>
            <label>Keterangan<input name="desc" placeholder="mis. Ganti rantai & gir"></label>
            <label>Biaya (Rp)<input name="cost" class="rp" placeholder="500.000"></label>
            <label>Tanggal<input name="date" type="date" value="${todayISO()}"></label>
            <button class="btn warn sm" type="submit">Simpan</button>
          </form>

          <div class="section-title">📄 Biaya Dokumen
            ${u.status === 'tersedia' ? '<button class="btn outline sm" id="btnAddDoc">＋ Tambah</button>' : ''}
          </div>
          <div class="cost-list" id="listDocs"></div>
          <form class="inline-form" id="formDoc" hidden>
            <label>Keterangan<input name="desc" placeholder="mis. Balik nama Samsat"></label>
            <label>Biaya (Rp)<input name="cost" class="rp" placeholder="750.000"></label>
            <label>Tanggal<input name="date" type="date" value="${todayISO()}"></label>
            <button class="btn warn sm" type="submit">Simpan</button>
          </form>

          <div class="section-title">🏷️ Penjualan</div>
          <div id="saleArea"></div>

          <div style="display:flex;gap:10px;margin-top:26px;flex-wrap:wrap">
            <button class="btn outline" data-edit-unit="${u.id}">✏️ Edit Data Unit</button>
            ${isAdmin() ? `<button class="btn danger" data-del-unit="${u.id}">🗑️ Hapus Unit</button>` : ''}
          </div>
        </div>
      </div>`, false);

    bindMoneyInputs($('#overlayRoot'));
    renderCostLists(u);
    renderSaleArea(u);

    $('[data-edit-unit]').addEventListener('click', () => { closeOverlay(); openUnitForm(u.id); });
    const delBtn = $('[data-del-unit]');
    if (delBtn) delBtn.addEventListener('click', async () => {
      const ok = await confirmDlg('Hapus Unit',
        `Yakin menghapus <b>${esc(u.name)}</b>?<br>Semua riwayat biaya & invoice-nya ikut terhapus permanen.`, true);
      if (!ok) return;
      try {
        const r = await api('/units/' + u.id, { method: 'DELETE' });
        toast(r.message, 'ok');
        loadStokRows();
      } catch (err) { toast(err.message, 'err'); }
    });

    [['btnAddRepair', 'formRepair'], ['btnAddDoc', 'formDoc']].forEach(([btnId, formId]) => {
      const btn = $('#' + btnId);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const f = $('#' + formId);
        f.hidden = !f.hidden;
        if (!f.hidden) $('input[name="desc"]', f).focus();
      });
    });

    $('#formRepair').addEventListener('submit', (e) => addCost(e, u, 'perbaikan'));
    $('#formDoc').addEventListener('submit', (e) => addCost(e, u, 'dokumen'));
  }

  /* ---- Render daftar biaya di drawer ---- */
  function renderCostLists(u) {
    const rep = $('#listRepairs');
    const doc = $('#listDocs');
    if (!rep || !doc) return;

    rep.innerHTML = (u.repairs || []).length
      ? u.repairs.map((c) => costItemHtml(c)).join('')
      : '<p class="empty" style="padding:14px">Belum ada biaya perbaikan.</p>';
    doc.innerHTML = (u.documents || []).length
      ? u.documents.map((c) => costItemHtml(c)).join('')
      : '<p class="empty" style="padding:14px">Belum ada biaya dokumen.</p>';

    $$('.icon-btn[data-cid]', $('#overlayRoot')).forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDlg('Hapus Biaya', `Hapus <b>${esc(btn.dataset.cdesc)}</b>?`, true);
      if (!ok) return;
      try {
        await api('/units/' + u.id + '/costs/' + btn.dataset.cid, { method: 'DELETE' });
        toast('Biaya dihapus', 'ok');
        openUnitDetail(u.id); // muat ulang drawer dengan total terbaru
      } catch (err) { toast(err.message, 'err'); }
    }));

    $$('.icon-btn[data-cedit]', $('#overlayRoot')).forEach((btn) => btn.addEventListener('click', () => {
      const c = [].concat(u.repairs || [], u.documents || []).find((x) => x.id === btn.dataset.cedit);
      if (c) openCostForm(u, c);
    }));
  }

  function costItemHtml(c) {
    return `<div class="cost-item">
      <span class="ci-main"><b>${esc(c.desc)}</b><small>${fmtDate(c.date)}</small></span>
      <span class="ci-amt">${rp(c.cost)}</span>
      <button class="icon-btn orange" title="Edit biaya" data-cedit="${esc(c.id)}">✏️</button>
      <button class="icon-btn red" title="Hapus biaya" data-cid="${esc(c.id)}" data-cdesc="${esc(c.desc)}">🗑️</button>
    </div>`;
  }

  /* ---- Modal edit satu item biaya ---- */
  function openCostForm(u, c) {
    openOverlay(`
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>✏️ Edit Biaya</h3><button class="close-x" aria-label="Tutup">✕</button></div>
        <form id="costEditForm" novalidate><div class="modal-body">
          <label>Keterangan<input name="desc" value="${esc(c.desc)}" required></label>
          <div class="grid2">
            <label>Biaya (Rp)<input name="cost" class="rp" value="${fmtNum(c.cost)}" required></label>
            <label>Tanggal<input name="date" type="date" value="${esc(c.date)}"></label>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn outline" data-cancel>Batal</button>
          <button type="submit" class="btn primary">Simpan Perubahan</button>
        </div></form>
      </div>`, true);

    bindMoneyInputs($('#overlayRoot'));
    $('[data-cancel]', $('#overlayRoot')).addEventListener('click', closeOverlay);
    $('#costEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('/units/' + u.id + '/costs/' + c.id, {
          method: 'PATCH',
          body: { desc: f.desc.value, cost: parseRp(f.cost.value), date: f.date.value }
        });
        toast('Biaya diperbarui', 'ok');
        loadStokRows();
        openUnitDetail(u.id);
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  async function addCost(e, u, kind) {
    e.preventDefault();
    const f = e.target;
    const body = { kind, desc: f.desc.value, cost: parseRp(f.cost.value), date: f.date.value };
    if (!body.desc.trim() || !(body.cost > 0)) {
      return toast('Lengkapi keterangan dan biaya (> 0)', 'err');
    }
    try {
      await api('/units/' + u.id + '/costs', { method: 'POST', body });
      toast('Biaya ' + kind + ' tersimpan', 'ok');
      loadStokRows();
      openUnitDetail(u.id);
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ---- Area penjualan di drawer ---- */
  function renderSaleArea(u) {
    const area = $('#saleArea');
    if (!area) return;

    if (u.sale) {
      const s = u.sale;
      const t = u._totals;
      const margin = t.modal ? Math.round(t.profit / t.modal * 1000) / 10 : 0;
      const paid = Number(s.installmentsPaid) || 0;
      const monthsElapsed = Math.max(0,
        Math.floor((Date.now() - new Date(s.date + 'T00:00:00').getTime()) / (30 * 864e5)));
      const arrears = Math.max(0, monthsElapsed - paid);
      const sisaPiutang = Math.max(0, (Number(s.tenor) || 0) - paid) * (Number(s.installment) || 0);
      area.innerHTML = `
        <div class="info-grid">
          <div class="info-box"><small>Harga Jual</small><b>${rp(s.price)}</b></div>
          <div class="info-box"><small>Tanggal Jual</small><b>${fmtDate(s.date)}</b></div>
          <div class="info-box"><small>Metode</small><b>${s.payment === 'kredit' ? 'Kredit' : 'Cash'}${s.dp ? ' · DP ' + rp(s.dp) : ''}</b></div>
          <div class="info-box"><small>Pembeli</small><b>${esc(s.buyerName)}</b></div>
          <div class="info-box"><small>No. Invoice</small><b>${esc(s.invoiceNo)}</b></div>
          <div class="info-box"><small>Laba / Rugi</small><b class="${t.profit >= 0 ? 'pos' : 'neg'}">${rp(t.profit)} (${margin}%)</b></div>
          ${(s.payment === 'kredit')
            ? `<div class="info-box"><small>Leasing</small><b>${esc(s.leasing) || '—'}</b></div>
               <div class="info-box"><small>Tenor</small><b>${s.tenor ? s.tenor + ' bulan' : '—'}</b></div>
               <div class="info-box"><small>Angsuran</small><b>${s.installment ? rp(s.installment) + ' / bulan' : '—'}</b></div>
               <div class="info-box"><small>Sudah Dibayar</small><b>${paid}${s.tenor ? ' / ' + s.tenor : ''}x</b></div>
               <div class="info-box"><small>Sisa Piutang</small><b>${rp(sisaPiutang)}</b></div>
               <div class="info-box"><small>Kolektibilitas</small><br><span class="badge ${arrears > 0 ? 'loss' : 'profit'}" style="margin-top:4px">${arrears > 0 ? 'Telat ' + arrears + ' bulan' : 'Lancar'}</span></div>`
            : ''}
        </div>
        ${s.note ? `<p class="cell-sub" style="margin-top:9px">📝 ${esc(s.note)}</p>` : ''}
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
          <button class="btn navy sm" id="btnViewInv">🧾 Lihat & Cetak Invoice</button>
          ${s.payment === 'kredit' && s.tenor ? '<button class="btn warn sm" id="btnPayInst">＋ Bayar 1x Angsuran</button>' : ''}
          <button class="btn outline sm" id="btnEditSale">✏️ Koreksi Data</button>
          ${isAdmin() ? '<button class="btn outline sm" id="btnCancelSale">↩ Batalkan Penjualan</button>' : ''}
        </div>`;
      $('#btnViewInv').addEventListener('click', () => showInvoice(s.invoiceNo));
      const payBtn = $('#btnPayInst');
      if (payBtn) payBtn.addEventListener('click', async () => {
        try {
          await api('/units/' + u.id + '/sale', { method: 'PATCH', body: { installmentsPaid: paid + 1 } });
          toast('Angsuran ke-' + (paid + 1) + ' ditandai dibayar', 'ok');
          loadStokRows();
          openUnitDetail(u.id);
        } catch (err) { toast(err.message, 'err'); }
      });
      $('#btnEditSale').addEventListener('click', () => openSaleEdit(u));
      const cancelBtn = $('#btnCancelSale');
      if (cancelBtn) cancelBtn.addEventListener('click', async () => {
        const ok = await confirmDlg('Batalkan Penjualan',
          'Status motor kembali menjadi <b>tersedia</b> dan invoice dinonaktifkan. Lanjutkan?', true);
        if (!ok) return;
        try {
          const r = await api('/units/' + u.id + '/sale', { method: 'DELETE' });
          toast(r.message, 'ok');
          loadStokRows();
          openUnitDetail(u.id);
        } catch (err) { toast(err.message, 'err'); }
      });
      return;
    }

    renderSellForm(u, area);
  }

  /* ---- Modal koreksi data penjualan ---- */
  function openSaleEdit(u) {
    const s = u.sale;
    openOverlay(`
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>✏️ Koreksi Penjualan — ${esc(u.code)}</h3><button class="close-x" aria-label="Tutup">✕</button></div>
        <form id="saleEditForm" novalidate><div class="modal-body">
          <div class="grid2">
            <label>Harga Jual *<input name="price" class="rp" value="${fmtNum(s.price)}" required></label>
            <label>Tanggal Jual *<input name="date" type="date" value="${esc(s.date)}" required></label>
          </div>
          <div class="grid2">
            <label>Nama Pembeli *<input name="buyerName" value="${esc(s.buyerName)}" required></label>
            <label>Metode Bayar *
              <select name="payment">
                <option value="cash"${s.payment === 'cash' ? ' selected' : ''}>Cash</option>
                <option value="kredit"${s.payment === 'kredit' ? ' selected' : ''}>Kredit (DP)</option>
              </select>
            </label>
          </div>
          <div id="creditWrap"${s.payment === 'kredit' ? '' : ' hidden'}>
            <div class="grid2">
              <label>Uang Muka / DP<input name="dp" class="rp" value="${s.dp ? fmtNum(s.dp) : ''}"></label>
              <label>Angsuran / bulan<input name="installment" class="rp" value="${s.installment ? fmtNum(s.installment) : ''}"></label>
            </div>
            <div class="grid2">
              <label>Perusahaan Leasing<input name="leasing" value="${esc(s.leasing || '')}"></label>
              <label>Tenor (bulan)<input name="tenor" type="number" min="0" value="${s.tenor || ''}"></label>
            </div>
            <div class="grid2">
              <label>Angsuran Sudah Dibayar (kali)<input name="installmentsPaid" type="number" min="0" value="${Number(s.installmentsPaid) || 0}"></label>
              <span></span>
            </div>
          </div>
          <div class="grid2">
            <label>Telepon Pembeli<input name="buyerPhone" value="${esc(s.buyerPhone || '')}"></label>
            <label>Alamat Pembeli<input name="buyerAddress" value="${esc(s.buyerAddress || '')}"></label>
          </div>
          <label>Catatan<input name="note" value="${esc(s.note || '')}"></label>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn outline" data-cancel>Batal</button>
          <button type="submit" class="btn primary">Simpan Koreksi</button>
        </div></form>
      </div>`, true);

    bindMoneyInputs($('#overlayRoot'));
    $('select[name="payment"]', $('#overlayRoot')).addEventListener('change', (e) => {
      $('#creditWrap', $('#overlayRoot')).hidden = e.target.value !== 'kredit';
    });
    $('[data-cancel]', $('#overlayRoot')).addEventListener('click', closeOverlay);
    $('#saleEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const kredit = f.payment.value === 'kredit';
      try {
        await api('/units/' + u.id + '/sale', {
          method: 'PATCH',
          body: {
            price: parseRp(f.price.value),
            date: f.date.value,
            buyerName: f.buyerName.value,
            payment: f.payment.value,
            dp: kredit && f.dp.value ? parseRp(f.dp.value) : null,
            leasing: kredit ? f.leasing.value : '',
            tenor: kredit && f.tenor.value ? parseInt(f.tenor.value, 10) : null,
            installment: kredit && f.installment.value ? parseRp(f.installment.value) : null,
            installmentsPaid: kredit ? (parseInt(f.installmentsPaid.value, 10) || 0) : 0,
            buyerPhone: f.buyerPhone.value,
            buyerAddress: f.buyerAddress.value,
            note: f.note.value
          }
        });
        toast('Data penjualan dikoreksi', 'ok');
        loadStokRows();
        openUnitDetail(u.id);
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  /* ---- Form catat penjualan untuk unit tersedia ---- */
  function renderSellForm(u, area) {
    const t = u._totals;
    area.innerHTML = `
      <form id="sellForm">
        <div class="grid2">
          <label>Harga Jual *<input name="price" class="rp" placeholder="${fmtNum(t.modal)}" required></label>
          <label>Tanggal Jual *<input name="date" type="date" value="${todayISO()}" required></label>
        </div>
        <div class="grid2">
          <label>Nama Pembeli *<input name="buyerName" placeholder="mis. Budi Santoso" required></label>
          <label>Metode Bayar *
            <select name="payment"><option value="cash">Cash</option><option value="kredit">Kredit (DP)</option></select>
          </label>
        </div>
        <div id="creditWrap" hidden>
          <div class="grid2">
            <label>Uang Muka / DP<input name="dp" class="rp" placeholder="mis. 5.000.000"></label>
            <label>Angsuran / bulan<input name="installment" class="rp" placeholder="mis. 1.250.000"></label>
          </div>
          <div class="grid2">
            <label>Perusahaan Leasing<input name="leasing" placeholder="mis. Adira Finance (opsional)"></label>
            <label>Tenor (bulan)<input name="tenor" type="number" min="0" placeholder="mis. 24"></label>
          </div>
        </div>
        <div class="grid2">
          <label>Telepon Pembeli<input name="buyerPhone" placeholder="opsional"></label>
          <label>Alamat Pembeli<input name="buyerAddress" placeholder="opsional"></label>
        </div>
        <label>Catatan<input name="note" placeholder="mis. bonus helm, kelengkapan…"></label>
        <div style="display:flex;gap:12px;align-items:center;background:#fff6e3;border:1px solid #f4dfae;border-radius:13px;padding:10px 14px;margin-bottom:14px">
          <span class="cell-sub">Estimasi laba pada harga isian: <b id="estProfit" class="pos">—</b>
          <small>(total modal ${rp(t.modal)})</small></span>
        </div>
        <button class="btn primary block lg" type="submit">💰 Simpan Penjualan & Buat Invoice</button>
      </form>`;

    bindMoneyInputs(area);
    const priceInp = $('input[name="price"]', area);
    const estEl = $('#estProfit', area);
    priceInp.addEventListener('input', () => {
      const v = parseRp(priceInp.value);
      const est = v - t.modal;
      estEl.textContent = isNaN(v) ? '—' : rp(est);
      estEl.className = isNaN(v) || est >= 0 ? 'pos' : 'neg';
    });
    $('select[name="payment"]', area).addEventListener('change', (e) => {
      $('#creditWrap', area).hidden = e.target.value !== 'kredit';
    });

    $('#sellForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = {
        price: parseRp(f.price.value),
        date: f.date.value,
        buyerName: f.buyerName.value,
        payment: f.payment.value,
        dp: f.payment.value === 'kredit' && f.dp.value ? parseRp(f.dp.value) : null,
        leasing: f.payment.value === 'kredit' ? f.leasing.value : '',
        tenor: f.payment.value === 'kredit' && f.tenor.value ? parseInt(f.tenor.value, 10) : null,
        installment: f.payment.value === 'kredit' && f.installment.value ? parseRp(f.installment.value) : null,
        buyerPhone: f.buyerPhone.value,
        buyerAddress: f.buyerAddress.value,
        note: f.note.value
      };
      try {
        const saved = await api('/units/' + u.id + '/sell', { method: 'POST', body });
        toast('Terjual! Invoice ' + saved.sale.invoiceNo + ' dibuat', 'ok');
        loadStokRows();
        openUnitDetail(u.id);
      } catch (err) {
        const errs = err.data && err.data.errors;
        toast(errs ? Object.values(errs)[0] : err.message, 'err');
      }
    });
  }

  /* ================= Halaman: Biaya Operasional ================= */
  async function renderOpex() {
    view().innerHTML = `
      <div class="toolbar">
        <input type="month" id="oxMonth" title="Filter bulan" value="${esc(state.opex.month)}">
        <select id="oxCat">
          <option value="">Semua Kategori</option>
          <option value="gaji"${state.opex.category === 'gaji' ? ' selected' : ''}>Gaji</option>
          <option value="sewa"${state.opex.category === 'sewa' ? ' selected' : ''}>Sewa Tempat</option>
          <option value="listrik-air"${state.opex.category === 'listrik-air' ? ' selected' : ''}>Listrik & Air</option>
          <option value="marketing"${state.opex.category === 'marketing' ? ' selected' : ''}>Marketing / Iklan</option>
          <option value="lainnya"${state.opex.category === 'lainnya' ? ' selected' : ''}>Lainnya</option>
        </select>
        <span class="spacer"></span>
        <button class="btn primary" id="btnAddOpex">＋ Tambah Biaya</button>
      </div>
      <div class="card" style="padding:14px 16px">
        <div class="table-wrap"><table class="tbl" style="min-width:640px">
          <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="num">Jumlah</th><th></th></tr></thead>
          <tbody id="tbodyOpex"></tbody>
          <tfoot id="tfootOpex"></tfoot>
        </table></div>
      </div>`;

    $('#oxMonth').addEventListener('change', loadOpexRows);
    $('#oxCat').addEventListener('change', () => { state.opex.category = $('#oxCat').value; loadOpexRows(); });
    $('#btnAddOpex').addEventListener('click', () => openOpexForm(null));
    await loadOpexRows();
  }

  async function loadOpexRows() {
    state.opex.month = $('#oxMonth') ? $('#oxMonth').value : '';
    const qs = new URLSearchParams();
    if (state.opex.month) {
      qs.set('from', state.opex.month + '-01');
      const [y, m] = state.opex.month.split('-').map(Number);
      qs.set('to', new Date(y, m, 0).toISOString().slice(0, 10));
    }
    if (state.opex.category) qs.set('category', state.opex.category);

    let rep;
    try { rep = await api('/opex' + (qs.toString() ? '?' + qs : '')); }
    catch (err) { return renderError(err); }
    state.opex.last = rep;

    const tbody = $('#tbodyOpex');
    const CAT_LABEL = { gaji: 'Gaji', sewa: 'Sewa', 'listrik-air': 'Listrik & Air', marketing: 'Marketing', lainnya: 'Lainnya' };
    if (!rep.items.length) {
      tbody.innerHTML = '<tr><td colspan="5"><p class="empty"><span class="big">💸</span>Belum ada biaya operasional pada filter ini.</p></td></tr>';
      $('#tfootOpex').innerHTML = '';
      return;
    }
    tbody.innerHTML = rep.items.map((o) => `
      <tr>
        <td>${fmtDate(o.date)}</td>
        <td><span class="badge info">${esc(CAT_LABEL[o.category] || o.category)}</span></td>
        <td>${esc(o.desc)}</td>
        <td class="num"><b>${rp(o.amount)}</b></td>
        <td><span class="row-actions">
          <button class="icon-btn orange" title="Edit" data-ox="edit" data-oid="${esc(o.id)}">✏️</button>
          ${isAdmin() ? `<button class="icon-btn red" title="Hapus" data-ox="del" data-oid="${esc(o.id)}" data-odesc="${esc(o.desc)}">🗑️</button>` : ''}
        </span></td>
      </tr>`).join('');
    $('#tfootOpex').innerHTML = `
      <tr><td colspan="3">TOTAL (${rep.totals.count} item)</td><td class="num">${rp(rep.totals.amount)}</td><td></td></tr>`;

    $$('#tbodyOpex [data-ox]').forEach((btn) => btn.addEventListener('click', async () => {
      const item = rep.items.find((x) => x.id === btn.dataset.oid);
      if (!item) return;
      if (btn.dataset.ox === 'edit') return openOpexForm(item);
      const ok = await confirmDlg('Hapus Biaya Operasional',
        `Hapus <b>${esc(btn.dataset.odesc)}</b>?`, true);
      if (!ok) return;
      try {
        const r = await api('/opex/' + item.id, { method: 'DELETE' });
        toast(r.message, 'ok');
        loadOpexRows();
      } catch (err) { toast(err.message, 'err'); }
    }));
  }

  /* ---- Modal tambah/edit biaya operasional ---- */
  function openOpexForm(item) {
    openOverlay(`
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${item ? '✏️ Edit Biaya Operasional' : '➕ Tambah Biaya Operasional'}</h3><button class="close-x" aria-label="Tutup">✕</button></div>
        <form id="opexForm" novalidate><div class="modal-body">
          <label>Kategori *
            <select name="category">
              <option value="gaji"${item && item.category === 'gaji' ? ' selected' : ''}>Gaji</option>
              <option value="sewa"${item && item.category === 'sewa' ? ' selected' : ''}>Sewa Tempat</option>
              <option value="listrik-air"${item && item.category === 'listrik-air' ? ' selected' : ''}>Listrik & Air</option>
              <option value="marketing"${item && item.category === 'marketing' ? ' selected' : ''}>Marketing / Iklan</option>
              <option value="lainnya"${item && item.category === 'lainnya' ? ' selected' : ''}>Lainnya</option>
            </select>
          </label>
          <label>Keterangan *<input name="desc" placeholder="mis. Sewa tempat September" value="${item ? esc(item.desc) : ''}" required></label>
          <div class="grid2">
            <label>Jumlah (Rp) *<input name="amount" class="rp" value="${item ? fmtNum(item.amount) : ''}" required></label>
            <label>Tanggal *<input name="date" type="date" value="${item ? esc(item.date) : todayISO()}" required></label>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn outline" data-cancel>Batal</button>
          <button type="submit" class="btn primary">Simpan</button>
        </div></form>
      </div>`, true);

    bindMoneyInputs($('#overlayRoot'));
    $('[data-cancel]', $('#overlayRoot')).addEventListener('click', closeOverlay);
    $('#opexForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = { category: f.category.value, desc: f.desc.value, amount: parseRp(f.amount.value), date: f.date.value };
      try {
        if (item) {
          await api('/opex/' + item.id, { method: 'PATCH', body });
          toast('Biaya operasional diperbarui', 'ok');
        } else {
          await api('/opex', { method: 'POST', body });
          toast('Biaya operasional tersimpan', 'ok');
        }
        closeOverlay();
        loadOpexRows();
      } catch (err) {
        const errs = err.data && err.data.errors;
        toast(errs ? Object.values(errs)[0] : err.message, 'err');
      }
    });
  }

  /* ================= Halaman: Laba Rugi ================= */
  function computeRange() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    switch (state.report.preset) {
      case 'bulan-ini': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
      case 'bulan-lalu': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
      case '3-bulan': return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
      case 'tahun-ini': return { from: y + '-01-01', to: y + '-12-31' };
      case 'custom': return { from: state.report.from, to: state.report.to };
      default: return { from: '', to: '' };
    }
  }

  async function renderLabaRugi() {
    view().innerHTML = `
      <div class="toolbar">
        <select id="lrPreset">
          <option value="bulan-ini">Bulan Ini</option>
          <option value="bulan-lalu">Bulan Lalu</option>
          <option value="3-bulan">3 Bulan Terakhir</option>
          <option value="tahun-ini">Tahun Ini</option>
          <option value="semua">Semua Periode</option>
          <option value="custom">Kustom…</option>
        </select>
        <input type="date" id="lrFrom" hidden title="Dari tanggal">
        <input type="date" id="lrTo" hidden title="Sampai tanggal">
        <button class="btn outline sm" id="btnLrReload">⟳ Muat Ulang</button>
        <button class="btn outline sm" id="btnLrCsv">⬇️ CSV</button>
        <span class="spacer"></span>
        <button class="btn navy" id="btnLrPrint">🖨️ Cetak Laporan</button>
      </div>
      <div class="card" id="lrCard">
        <div class="print-kop">
          <div>
            <h2>${esc(state.settings.name || 'Showroom Motor Bekas')}</h2>
            <p>${esc(state.settings.address || '')}${state.settings.phone ? ' · ' + esc(state.settings.phone) : ''}</p>
          </div>
          <div class="kop-right">
            <b>Laporan Laba Rugi</b>
            <small>Dicetak ${fmtDate(todayISO())} oleh ${esc(state.user.name)} · <span id="lrPeriod"></span></small>
          </div>
        </div>
        <div id="lrSummary" class="money-grid" style="margin-bottom:15px"></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>Motor</th><th>Tgl Jual</th><th class="num">Pembelian</th><th class="num">Perbaikan</th><th class="num">Dokumen</th>
            <th class="num">Total Modal</th><th class="num">Harga Jual</th><th class="num">Laba / Rugi</th><th class="num">Margin</th>
          </tr></thead>
          <tbody id="tbodyLr"></tbody>
          <tfoot id="tfootLr"></tfoot>
        </table></div>
        <div class="print-only">
          <div class="sign-cell-lr">Disusun oleh,<div class="sign-line">${esc(state.user.name)}</div></div>
          <div class="sign-cell-lr">Mengetahui,<div class="sign-line">Pemilik Showroom</div></div>
        </div>
      </div>`;

    $('#lrPreset').value = state.report.preset;
    $('#lrFrom').value = state.report.from;
    $('#lrTo').value = state.report.to;

    const syncCustom = () => {
      const custom = $('#lrPreset').value === 'custom';
      $('#lrFrom').hidden = !custom;
      $('#lrTo').hidden = !custom;
    };
    syncCustom();

    $('#lrPreset').addEventListener('change', () => {
      state.report.preset = $('#lrPreset').value;
      syncCustom();
      loadLabaRugi();
    });
    ['#lrFrom', '#lrTo'].forEach((s) => $(s).addEventListener('change', () => {
      state.report.from = $('#lrFrom').value;
      state.report.to = $('#lrTo').value;
      loadLabaRugi();
    }));
    $('#btnLrReload').addEventListener('click', loadLabaRugi);
    $('#btnLrPrint').addEventListener('click', () => printTarget($('#lrCard')));
    $('#btnLrCsv').addEventListener('click', exportLabaRugiCsv);

    await loadLabaRugi();
  }

  async function loadLabaRugi() {
    const r = computeRange();
    const qs = new URLSearchParams();
    if (r.from) qs.set('from', r.from);
    if (r.to) qs.set('to', r.to);

    let rep;
    try { rep = await api('/report/laba-rugi' + (qs.toString() ? '?' + qs : '')); }
    catch (err) { return renderError(err); }
    state.report.last = rep;

    $('#lrPeriod').textContent =
      (r.from || r.to)
        ? 'Periode ' + fmtDate(r.from || '…') + ' — ' + fmtDate(r.to || '…')
        : 'Semua periode';

    $('#lrSummary').innerHTML = `
      <div class="money-box buy"><small>Total Pembelian</small><b>${rp(rep.totals.purchase)}</b></div>
      <div class="money-box repair"><small>Total Perbaikan</small><b>${rp(rep.totals.repair)}</b></div>
      <div class="money-box doc"><small>Total Dokumen</small><b>${rp(rep.totals.doc)}</b></div>
      <div class="money-box total"><small>Total Modal</small><b>${rp(rep.totals.modal)}</b></div>
      <div class="money-box buy"><small>Pendapatan</small><b>${rp(rep.totals.revenue)}</b></div>
      <div class="money-box profitbox"><small>Laba Kotor</small><b class="${rep.totals.profit >= 0 ? 'pos' : 'neg'}">${rp(rep.totals.profit)}</b></div>
      <div class="money-box repair"><small>Biaya Operasional</small><b>${rp(rep.operational)}</b></div>
      <div class="money-box profitbox"><small>Laba Bersih Setelah OPEX</small><b class="${rep.netAfterOpex >= 0 ? 'pos' : 'neg'}">${rp(rep.netAfterOpex)}</b></div>`;

    const tbody = $('#tbodyLr');
    if (!rep.rows.length) {
      tbody.innerHTML = '<tr><td colspan="9"><p class="empty"><span class="big">📉</span>Tidak ada penjualan pada periode ini.</p></td></tr>';
      $('#tfootLr').innerHTML = '';
      return;
    }
    tbody.innerHTML = rep.rows.map((row) => `
      <tr>
        <td><span class="cell-main">${esc(row.name)}</span><span class="cell-sub">${esc(row.code)} · ${esc(row.brand)} ${row.year}${row.plate ? ' · ' + esc(row.plate) : ''}</span></td>
        <td>${fmtDate(row.saleDate)}</td>
        <td class="num">${rp(row.purchasePrice)}</td>
        <td class="num">${rp(row.repairTotal)}</td>
        <td class="num">${rp(row.docTotal)}</td>
        <td class="num">${rp(row.totalModal)}</td>
        <td class="num">${rp(row.salePrice)}<br><span class="cell-sub" style="font-size:10.5px">${esc(row.invoiceNo)}</span></td>
        <td class="num ${row.profit >= 0 ? 'pos' : 'neg'}">${rp(row.profit)}</td>
        <td class="num"><span class="badge ${row.profit >= 0 ? 'profit' : 'loss'}">${row.marginPct}%</span></td>
      </tr>`).join('');

    $('#tfootLr').innerHTML = `
      <tr>
        <td colspan="2">TOTAL (${rep.totals.count} unit)</td>
        <td class="num">${rp(rep.totals.purchase)}</td>
        <td class="num">${rp(rep.totals.repair)}</td>
        <td class="num">${rp(rep.totals.doc)}</td>
        <td class="num">${rp(rep.totals.modal)}</td>
        <td class="num">${rp(rep.totals.revenue)}</td>
        <td class="num ${rep.totals.profit >= 0 ? 'pos' : 'neg'}">${rp(rep.totals.profit)}</td>
        <td class="num">${rep.totals.marginPct}%</td>
      </tr>`;
  }

  /* ---- Export CSV: Laba Rugi & Stok ---- */
  function exportLabaRugiCsv() {
    const rep = state.report.last;
    if (!rep) return toast('Belum ada data laporan untuk diekspor', 'err');
    const r = computeRange();
    const rows = [
      ['Laporan Laba Rugi — ' + (state.settings.name || 'Showroom')],
      ['Periode', (r.from || 'semua') + ' s/d ' + (r.to || 'sekarang')],
      [],
      ['Kode', 'Motor', 'Plat', 'Tgl Jual', 'Invoice', 'Pembelian', 'Perbaikan', 'Dokumen', 'Total Modal', 'Harga Jual', 'Laba/Rugi', 'Margin %']
    ];
    rep.rows.forEach((x) => rows.push([
      x.code, x.name, x.plate, x.saleDate, x.invoiceNo,
      x.purchasePrice, x.repairTotal, x.docTotal, x.totalModal, x.salePrice, x.profit, x.marginPct
    ]));
    rows.push(['TOTAL', rep.totals.count + ' unit', '', '', '',
      rep.totals.purchase, rep.totals.repair, rep.totals.doc, rep.totals.modal,
      rep.totals.revenue, rep.totals.profit, rep.totals.marginPct]);
    rows.push([]);
    rows.push(['BIAYA OPERASIONAL', '', '', '', '', '', '', '', '', '', rep.operational, '']);
    rows.push(['LABA BERSIH SETELAH OPEX', '', '', '', '', '', '', '', '', '', rep.netAfterOpex, '']);
    downloadCsv('laba-rugi-' + (r.from || 'semua') + (r.to ? '_' + r.to : '') + '.csv', rows);
    toast('CSV laba rugi diunduh', 'ok');
  }

  function exportStokCsv() {
    const units = state.stok.last || [];
    if (!units.length) return toast('Belum ada data stok untuk diekspor', 'err');
    const rows = [['Kode', 'Motor', 'Merek', 'Tahun', 'KM', 'Plat', 'Warna', 'Status',
      'Umur Stok (hari)', 'Tgl Beli', 'Harga Beli', 'Perbaikan', 'Dokumen', 'Total Modal', 'Harga Jual', 'Laba/Rugi']];
    units.forEach((u) => {
      const t = u._totals || {};
      rows.push([u.code, u.name, u.brand, u.year, u.km, u.plate, u.color, u.status,
        u.status === 'tersedia' ? stockDays(u) : '', u.purchase.date,
        t.purchase, t.repair, t.doc, t.modal, t.price != null ? t.price : '', t.profit != null ? t.profit : '']);
    });
    downloadCsv('stok-motor.csv', rows);
    toast('CSV stok motor diunduh', 'ok');
  }

  /* ================= Halaman: Daftar Invoice ================= */
  async function renderInvoiceList() {
    view().innerHTML = '<p class="empty"><span class="big">⏳</span>Memuat daftar invoice…</p>';
    let list;
    try { list = await api('/invoices'); }
    catch (err) { return renderError(err); }

    state.invLast = list;

    const drawCards = (items) => {
      $('#invGrid').innerHTML = items.length ? items.map((i) => `
          <div class="card" style="margin:0;cursor:pointer" data-inv="${esc(i.no)}">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <span class="stat-icon orange" style="width:42px;height:42px;font-size:18px">🧾</span>
              <span><b style="color:var(--navy);font-size:14.5px">${esc(i.no)}</b><br>
              <small class="cell-sub">${fmtDate(i.date)} · ${i.payment === 'kredit' ? 'Kredit' : 'Cash'}</small></span>
            </div>
            <b class="cell-main">${esc(i.name)}</b>
            <div class="cell-sub">${esc(i.code)} · Pembeli: ${esc(i.buyerName)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:11px">
              <b style="color:var(--red)">${rp(i.price)}</b>
              <span class="badge info">Lihat & Cetak →</span>
            </div>
          </div>`).join('')
        : '<p class="empty">Tidak ada invoice yang cocok dengan pencarian.</p>';
      $$('#invGrid [data-inv]').forEach((el) => el.addEventListener('click', () => showInvoice(el.dataset.inv)));
    };

    view().innerHTML = `
      <div class="toolbar">
        <span class="search"><input id="invQ" placeholder="Cari no. invoice / motor / pembeli…"></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:15px" id="invGrid"></div>`;

    $('#invQ').addEventListener('input', debounce(() => {
      const q = $('#invQ').value.trim().toLowerCase();
      drawCards(!q ? state.invLast : state.invLast.filter((i) =>
        [i.no, i.name, i.code, i.buyerName].join(' ').toLowerCase().indexOf(q) !== -1));
    }, 200));
    drawCards(list);
  }

  /* ---- Preview & cetak satu invoice ---- */
  async function showInvoice(no) {
    let p;
    try { p = await api('/invoices/' + encodeURIComponent(no)); }
    catch (err) { return toast(err.message, 'err'); }

    openOverlay(`
      <div class="modal-card wide invoice-wrap" role="dialog" aria-modal="true">
        <div class="modal-head print-hide"><h3>🧾 Preview Invoice — ${esc(p.invoice.invoiceNo)}</h3>
          <button class="close-x" aria-label="Tutup">✕</button></div>
        <div style="padding:16px 20px 24px">
          <div class="inv-tools print-hide">
            <label class="chk"><input type="checkbox" id="chkInternal"> Sertakan rincian biaya internal (arsip)</label>
            <span style="flex:1"></span>
            <button class="btn outline sm" data-close-inv>Tutup</button>
            <button class="btn primary sm" id="btnPrintInv">🖨️ Cetak Invoice</button>
          </div>
          ${buildSheetHtml(p)}
        </div>
      </div>`, true);

    const sheet = $('.sheet', $('#overlayRoot'));
    $('#btnPrintInv').addEventListener('click', () => printTarget(sheet));
    $('[data-close-inv]').addEventListener('click', closeOverlay);
    $('#chkInternal').addEventListener('change', (e) => {
      const blk = $('.internal-block', sheet);
      if (blk) blk.hidden = !e.target.checked;
    });
  }

  /* ---- Bangun HTML lembar invoice (siap cetak A4) ---- */
  function buildSheetHtml(p) {
    const s = p.settings, inv = p.invoice, u = p.unit, br = p.breakdown;
    const remaining = inv.dp ? Math.max(0, inv.price - inv.dp) : null;
    const spec = [u.brand, u.year, fmtNum(u.km) + ' km', u.color, u.plate].filter(Boolean).join(' · ');

    const internalRows = [
      ['Harga pembelian', rp(br.purchasePrice)]
    ].concat(
      br.repairs.map((c) => ['Perbaikan: ' + c.desc, rp(c.cost)]),
      br.documents.map((c) => ['Dokumen: ' + c.desc, rp(c.cost)])
    );

    return `
      <div class="sheet">
        <div class="sheet-head">
          <div class="sheet-brand">${LOGO_SVG}
            <div><h2>${esc(s.name || 'Showroom Motor')}</h2><p>${esc(s.address || '')}<br>${esc(s.phone || '')}${s.email ? ' · ' + esc(s.email) : ''}</p></div>
          </div>
          <div class="inv-tag"><h1>INVOICE</h1><span class="no">No. ${esc(inv.invoiceNo)}</span></div>
        </div>
        <div class="sheet-rule"></div>

        <div class="sheet-meta">
          <div>
            <h4>Kepada Yth.</h4>
            <p><b>${esc(inv.buyerName)}</b><br>${esc(inv.buyerAddress || '—')}${inv.buyerPhone ? '<br>' + esc(inv.buyerPhone) : ''}</p>
          </div>
          <div style="text-align:right">
            <h4>Informasi Transaksi</h4>
            <p>Tanggal: <b>${fmtDate(inv.date)}</b><br>Pembayaran: <b>${inv.payment === 'kredit' ? 'KREDIT' : 'CASH'}</b>${inv.leasing ? '<br>Leasing: <b>' + esc(inv.leasing) + '</b>' : ''}${inv.tenor ? '<br>Tenor: <b>' + inv.tenor + ' bulan</b>' : ''}${inv.installment ? '<br>Angsuran: <b>' + rp(inv.installment) + ' / bulan</b>' : ''}${inv.dp ? '<br>Uang muka: <b>' + rp(inv.dp) + '</b>' : ''}${remaining != null ? '<br>Sisa: <b>' + rp(remaining) + '</b>' : ''}</p>
          </div>
        </div>

        <table class="tbl-inv">
          <thead><tr><th style="width:36px">No</th><th>Deskripsi Kendaraan</th><th>No. Polisi</th><th class="num">Jumlah</th></tr></thead>
          <tbody>
            <tr><td>1</td><td><b>${esc(u.name)}</b><br><small style="color:#64748b">${esc(spec)}</small></td><td>${esc(u.plate || '—')}</td><td class="num"><b>${rp(inv.price)}</b></td></tr>
          </tbody>
        </table>

        <div class="totals-box">
          ${inv.dp ? `<div class="trow"><span>Harga kendaraan</span><span>${rp(inv.price)}</span></div>
                     <div class="trow"><span>Uang muka (DP)</span><span>− ${rp(inv.dp)}</span></div>` : ''}
          <div class="trow grand"><span>TOTAL TAGIHAN</span><span>${rp(remaining != null ? remaining : inv.price)}</span></div>
        </div>

        ${inv.note ? `<p style="margin-top:14px;font-size:12.5px"><b>Catatan:</b> ${esc(inv.note)}</p>` : ''}

        <div class="internal-block" hidden>
          <h4>Rincian Biaya Internal — Arsip Showroom</h4>
          <table>
            ${internalRows.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`).join('')}
            <tr><td><b>Total modal</b></td><td class="num"><b>${rp(br.totalModal)}</b></td></tr>
            <tr class="grand"><td>Laba / Rugi unit ini</td><td class="num">${rp(br.profit)}</td></tr>
          </table>
        </div>

        <div class="sign-row">
          <div class="sign-cell"><p>Penerima,</p><p class="name">${esc(inv.buyerName)}</p></div>
          <div class="sign-cell"><p>Hormat kami,</p><p class="name">${esc(s.name || 'Showroom')}</p></div>
        </div>

        <div class="sheet-foot">${esc(s.footerNote || '')}</div>
      </div>`;
  }

  /* ================= Halaman: Pengguna (khusus admin) ================= */
  async function renderUsers() {
    if (!isAdmin()) {
      view().innerHTML = '<div class="card"><p class="empty"><span class="big">🔒</span>Halaman ini khusus admin.</p></div>';
      return;
    }
    view().innerHTML = `
      <div class="toolbar">
        <span class="spacer"></span>
        <button class="btn primary" id="btnAddUser">＋ Tambah Pengguna</button>
      </div>
      <div class="card" style="padding:14px 16px">
        <div class="table-wrap"><table class="tbl" style="min-width:560px">
          <thead><tr><th>Pengguna</th><th>Peran</th><th>Dibuat</th><th></th></tr></thead>
          <tbody id="tbodyUsers"></tbody>
        </table></div>
      </div>
      <div class="card" style="padding:14px 16px">
        <div class="card-head" style="margin-bottom:10px"><h3>📜 Aktivitas Terakhir</h3><span class="hint">100 kejadian terakhir</span></div>
        <div class="table-wrap"><table class="tbl" style="min-width:560px">
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody id="tbodyAudit"></tbody>
        </table></div>
      </div>`;
    $('#btnAddUser').addEventListener('click', () => openUserForm(null));
    await loadUsers();
    await loadAudit();
  }

  async function loadAudit() {
    let logs;
    try { logs = await api('/audit'); }
    catch (err) { return; }
    const tb = $('#tbodyAudit');
    if (!tb) return;
    tb.innerHTML = logs.length ? logs.map((l) => `
      <tr>
        <td style="white-space:nowrap">${fmtDate(l.at)}<br><small class="cell-sub">${new Date(l.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small></td>
        <td><b>${esc(l.name)}</b><br><small class="cell-sub">@${esc(l.username)}</small></td>
        <td><span class="badge info">${esc(l.action)}</span></td>
        <td>${esc(l.detail)}</td>
      </tr>`).join('')
      : '<tr><td colspan="4"><p class="empty">Belum ada aktivitas tercatat.</p></td></tr>';
  }

  async function loadUsers() {
    let users;
    try { users = await api('/users'); }
    catch (err) { return renderError(err); }

    const tbody = $('#tbodyUsers');
    if (!tbody) return;
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td><span class="cell-main">${esc(u.name)}</span><span class="cell-sub">@${esc(u.username)}</span></td>
        <td><span class="badge ${u.role === 'admin' ? 'role-admin' : 'role-staff'}">${u.role === 'admin' ? 'Admin' : 'Staf'}</span>${u.username === state.user.username ? ' <span class="badge profit">Anda</span>' : ''}</td>
        <td>${fmtDate(u.createdAt)}</td>
        <td><span class="row-actions">
          <button class="icon-btn orange" title="Edit / reset password" data-uact="edit" data-uid="${esc(u.id)}">✏️</button>
          ${u.username !== state.user.username ? `<button class="icon-btn red" title="Hapus pengguna" data-uact="del" data-uid="${esc(u.id)}">🗑️</button>` : ''}
        </span></td>
      </tr>`).join('');

    $$('#tbodyUsers [data-uact]').forEach((btn) => btn.addEventListener('click', () => {
      const usr = users.find((x) => x.id === btn.dataset.uid);
      if (!usr) return;
      if (btn.dataset.uact === 'edit') openUserForm(usr);
      if (btn.dataset.uact === 'del') deleteUser(usr);
    }));
  }

  function openUserForm(u) {
    openOverlay(`
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${u ? '✏️ Edit Pengguna — @' + esc(u.username) : '➕ Tambah Pengguna'}</h3><button class="close-x" aria-label="Tutup">✕</button></div>
        <form id="userForm" novalidate><div class="modal-body">
          ${u ? '' : '<label>Username *<input name="username" placeholder="huruf kecil / angka / titik"></label>'}
          <label>Nama Lengkap *<input name="name" value="${u ? esc(u.name) : ''}" required></label>
          <div class="grid2">
            <label>Peran *
              <select name="role">
                <option value="staff"${u && u.role === 'staff' ? ' selected' : ''}>Staf Showroom</option>
                <option value="admin"${u && u.role === 'admin' ? ' selected' : ''}>Administrator</option>
              </select>
            </label>
            <label>${u ? 'Password Baru <small>(opsional)</small>' : 'Password *'}<input type="password" name="password" ${u ? '' : 'required'} placeholder="${u ? 'kosongkan jika tidak diubah' : 'min. 6 karakter'}"></label>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn outline" data-cancel>Batal</button>
          <button type="submit" class="btn primary">${u ? 'Simpan Perubahan' : 'Tambah Pengguna'}</button>
        </div></form>
      </div>`, true);

    $('[data-cancel]', $('#overlayRoot')).addEventListener('click', closeOverlay);
    $('#userForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        if (u) {
          const body = { name: f.name.value, role: f.role.value };
          if (f.password.value) body.newPassword = f.password.value;
          const r = await api('/users/' + u.id, { method: 'PATCH', body });
          toast('Pengguna ' + r.username + ' diperbarui', 'ok');
        } else {
          await api('/users', {
            method: 'POST',
            body: { username: f.username.value, name: f.name.value, role: f.role.value, password: f.password.value }
          });
          toast('Pengguna baru ditambahkan', 'ok');
        }
        closeOverlay();
        loadUsers();
      } catch (err) {
        const errs = err.data && err.data.errors;
        toast(errs ? Object.values(errs)[0] : err.message, 'err');
      }
    });
  }

  async function deleteUser(u) {
    const ok = await confirmDlg('Hapus Pengguna',
      `Yakin menghapus akun <b>@${esc(u.username)}</b> (${esc(u.name)})?<br>Sesi aktifnya akan langsung diputus.`, true);
    if (!ok) return;
    try {
      const r = await api('/users/' + u.id, { method: 'DELETE' });
      toast(r.message, 'ok');
      loadUsers();
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ================= Halaman: Pengaturan ================= */
  async function renderPengaturan() {
    view().innerHTML = '<p class="empty"><span class="big">⏳</span>Memuat pengaturan…</p>';
    let s;
    try { s = await api('/settings'); }
    catch (err) { return renderError(err); }
    state.settings = s;

    view().innerHTML = `
      <div class="dash-cols">
        <div>
          <div class="card">
            <div class="card-head"><h3>🏢 Profil Showroom</h3><span class="hint">tampil di header & footer invoice</span></div>
            <form id="setForm" novalidate>
              <label>Nama Showroom *<input name="name" value="${esc(s.name)}" required></label>
              <label>Alamat<input name="address" value="${esc(s.address || '')}"></label>
              <div class="grid2">
                <label>Telepon / WA<input name="phone" value="${esc(s.phone || '')}"></label>
                <label>Email<input name="email" value="${esc(s.email || '')}"></label>
              </div>
              <label>Catatan Footer Invoice<textarea name="footerNote">${esc(s.footerNote || '')}</textarea></label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:600;color:var(--text)">
                <input type="checkbox" name="showLoginHint" ${s.showLoginHint ? 'checked' : ''} style="width:auto;margin:0;accent-color:var(--orange)">
                Tampilkan hint akun demo di halaman login
              </label>
              <button class="btn primary" type="submit">💾 Simpan Pengaturan</button>
            </form>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-head"><h3>👤 Akun Aktif</h3></div>
            <div class="info-grid">
              <div class="info-box"><small>Nama</small><b>${esc(state.user.name)}</b></div>
              <div class="info-box"><small>Username</small><b>${esc(state.user.username)}</b></div>
              <div class="info-box"><small>Peran</small><b>${state.user.role === 'admin' ? 'Administrator' : 'Staf'}</b></div>
            </div>
            <p class="cell-sub" style="margin-top:12px">Aplikasi ini menyimpan data di
              <code>aplikasi/data/db.json</code> — hapus file tersebut untuk mengembalikan data awal (seed).</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>🔑 Ganti Password</h3></div>
            <form id="pwForm" novalidate>
              <label>Password Lama<input type="password" name="old" required></label>
              <div class="grid2">
                <label>Password Baru<input type="password" name="new" minlength="6" required></label>
                <label>Ulangi Password Baru<input type="password" name="confirm" required></label>
              </div>
              <button class="btn warn" type="submit">Ganti Password</button>
            </form>
          </div>
          <div class="card">
            <div class="card-head"><h3>ℹ️ Tentang Aplikasi</h3></div>
            <p class="cell-sub">NuMotorindo Finance — pencatatan pembelian, perbaikan, dokumen,
            laba rugi & invoice showroom motor bekas. Dibangun tanpa dependensi eksternal
            (Node.js murni + vanilla JS).</p>
          </div>
        </div>
      </div>`;

    $('#setForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const saved = await api('/settings', {
          method: 'PUT',
          body: {
            name: f.name.value, address: f.address.value, phone: f.phone.value,
            email: f.email.value, footerNote: f.footerNote.value,
            showLoginHint: f.showLoginHint.checked
          }
        });
        state.settings = saved;
        toast('Pengaturan disimpan — invoice berikutnya memakai profil baru', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });

    /* staf hanya boleh melihat, tidak mengubah profil */
    if (!isAdmin()) {
      $$('#setForm input, #setForm textarea').forEach((el) => { el.disabled = true; });
      $('#setForm button[type="submit"]').hidden = true;
      const note = document.createElement('p');
      note.className = 'cell-sub';
      note.textContent = '🔒 Hanya admin yang dapat mengubah profil showroom.';
      $('#setForm').appendChild(note);
    }

    $('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.new.value !== f.confirm.value) return toast('Konfirmasi password baru tidak sama', 'err');
      try {
        const r = await api('/auth/change-password', {
          method: 'POST',
          body: { oldPassword: f.old.value, newPassword: f.new.value }
        });
        toast(r.message, 'ok');
        f.reset();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  /* ================= Inisialisasi & event global ================= */
  function initClock() {
    const el = $('#clock');
    const tick = () => {
      const d = new Date();
      el.textContent = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    setInterval(tick, 30000);
  }

  function bindGlobalEvents() {
    /* login */
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.disabled = true;
      $('#liErr').hidden = true;
      try {
        const r = await api('/auth/login', {
          method: 'POST',
          body: { username: $('#liUser').value, password: $('#liPass').value }
        });
        TOKEN = r.token;
        localStorage.setItem('nmfin_token', TOKEN);
        state.user = r.user;
        toast('Selamat datang, ' + r.user.name + '!', 'ok');
        enterApp();
      } catch (err) {
        const el = $('#liErr');
        el.textContent = err.message || 'Login gagal';
        el.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });

    /* logout */
    $('#btnLogout').addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* abaikan */ }
      TOKEN = '';
      localStorage.removeItem('nmfin_token');
      state.user = null;
      showLogin();
      toast('Anda telah keluar. Sampai jumpa!', 'ok');
    });

    /* navigasi */
    window.addEventListener('hashchange', () => { if (state.user) route(); });
    $$('#sideNav a').forEach((a) => a.addEventListener('click', () => $('#sidebar').classList.remove('open')));
    $('#btnBurger').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

    /* tombol aksi cepat dashboard */
    view().addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) location.hash = go.dataset.go;
      if (go && go.hasAttribute('data-add')) setTimeout(() => openUnitForm(null), 60);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOverlay();
    });
  }

  async function boot() {
    bindGlobalEvents();
    initClock();

    /* tampilkan hint akun demo hanya bila diizinkan pengaturan */
    fetch('/api/public/hint').then((r) => r.json()).then((j) => {
      if (j.showHint) $('#authHint').hidden = false;
    }).catch(() => {});

    if (!TOKEN) return showLogin();
    try {
      state.user = await api('/auth/me'); // sesi tersimpan masih valid?
      enterApp();
    } catch (err) {
      showLogin();
    }
  }

  boot();

})();