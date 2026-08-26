/* ============================================================
   NuMotorindo Admin — logika dashboard
   (dijalankan dari halaman /admin yang disajikan backend)
============================================================ */
'use strict';

var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmtIDR(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function fmtKM(n) { return Number(n || 0).toLocaleString('id-ID') + ' km'; }
function fmtDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso || '-'; }
}

var COND_LABEL = { 'like-new': 'Like New', 'bagus': 'Bagus', 'muluz': 'Mulus' };
var STATUS_LABEL = { 'baru': 'Baru', 'dihubungi': 'Dihubungi', 'nego': 'Nego', 'deal': 'Deal', 'batal': 'Batal' };

/* ---------- Pembungkus fetch ---------- */
function api(path, opt) {
  opt = opt || {};
  opt.headers = Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {});
  return fetch(path, opt).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (data) {
      if (!r.ok) {
        var err = new Error(data.message || ('HTTP ' + r.status));
        err.fields = data.errors || null;
        err.status = r.status;
        throw err;
      }
      return data;
    });
  });
}

function showMsg(elId, text, type) {
  var el = document.getElementById(elId);
  el.hidden = false;
  el.className = 'msg ' + (type === 'error' ? 'error' : 'success');
  el.textContent = text;
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.hidden = true; }, 4200);
}

/* ---------- Statistik ---------- */
function loadStats() {
  return api('/api/stats').then(function (s) {
    $('#stats').innerHTML =
      '<div class="stat-card"><div class="num">' + s.totalBikes + '</div><div class="lbl">Motor di katalog</div></div>' +
      '<div class="stat-card"><div class="num">' + (s.byBrand.Honda || 0) + '</div><div class="lbl">Honda</div></div>' +
      '<div class="stat-card"><div class="num">' + ((s.byBrand.Yamaha || 0)) + '</div><div class="lbl">Yamaha</div></div>' +
      '<div class="stat-card accent"><div class="num">' + s.newRequests + '</div><div class="lbl">Permintaan baru</div></div>';
    $('#cntMotor').textContent = s.totalBikes;
    $('#cntReq').textContent = s.totalRequests;
  }).catch(function () {});
}

/* ---------- Katalog motor ---------- */
var lastBikes = [];

function renderBikes(list) {
  lastBikes = list;
  var tbody = $('#tbodyMotor');
  if (!list.length) {
    tbody.innerHTML = '<tr class="row-empty"><td colspan="8">Belum ada motor. Klik "＋ Tambah Motor" untuk mengisi katalog.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function (b) {
    return '<tr>' +
      '<td><strong>' + esc(b.name) + '</strong><br><small>' + esc(b.id) + '</small></td>' +
      '<td>' + esc(b.brand) + '</td>' +
      '<td><span class="chip">' + esc(b.typeName || b.type) + '</span></td>' +
      '<td>' + esc(b.year) + '</td>' +
      '<td>' + fmtKM(b.km) + '</td>' +
      '<td><strong style="color:var(--red)">' + fmtIDR(b.price) + '</strong></td>' +
      '<td><span class="badge-cond ' + esc(b.cond) + '">' + (COND_LABEL[b.cond] || esc(b.cond)) + '</span></td>' +
      '<td class="actions">' +
        '<button class="btn ghost sm" data-edit="' + esc(b.id) + '">✏️ Edit</button> ' +
        '<button class="btn danger sm" data-del="' + esc(b.id) + '">🗑️</button>' +
      '</td></tr>';
  }).join('');
}

function loadBikes() {
  return api('/api/bikes').then(renderBikes).catch(function (e) {
    showMsg('msgMotor', 'Gagal memuat katalog: ' + e.message, 'error');
  });
}

/* ---------- Form tambah/edit motor ---------- */
function openForm(bike) {
  $('#drawerTitle').textContent = bike ? 'Edit Motor' : 'Tambah Motor';
  $('#btnSave').textContent = bike ? '💾 Update Motor' : '💾 Simpan Motor';
  $('#fId').value = bike ? bike.id : '';
  $('#fNama').value = bike ? bike.name : '';
  $('#fMerek').value = bike ? bike.brand : 'Honda';
  $('#fType').value = bike ? bike.type : 'matic';
  $('#fTahun').value = bike ? bike.year : '';
  $('#fKm').value = bike ? bike.km : '';
  $('#fCc').value = bike ? bike.cc : '';
  $('#fTrans').value = bike ? bike.trans : '';
  $('#fCond').value = bike ? bike.cond : 'bagus';
  $('#fHarga').value = bike ? bike.price : '';
  $('#fOldPrice').value = bike && bike.oldPrice ? bike.oldPrice : '';
  $('#fWarna').value = bike ? (bike.color || '') : '';
  $('#fImg').value = bike ? (bike.img || '') : '';
  $('#fDesc').value = bike ? (bike.desc || '') : '';
  $('#overlay').classList.remove('hidden');
  setTimeout(function () { $('#fNama').focus(); }, 60);
}

function closeForm() { $('#overlay').classList.add('hidden'); }

function submitForm(e) {
  e.preventDefault();
  var id = $('#fId').value;
  var payload = {
    name: $('#fNama').value.trim(),
    brand: $('#fMerek').value,
    type: $('#fType').value,
    year: $('#fTahun').value,
    km: $('#fKm').value,
    cc: $('#fCc').value,
    trans: $('#fTrans').value.trim(),
    cond: $('#fCond').value,
    price: $('#fHarga').value,
    oldPrice: $('#fOldPrice').value,
    color: $('#fWarna').value.trim(),
    img: $('#fImg').value.trim(),
    desc: $('#fDesc').value.trim()
  };
  var btn = $('#btnSave');
  btn.disabled = true;
  var call = id
    ? api('/api/bikes/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(payload) })
    : api('/api/bikes', { method: 'POST', body: JSON.stringify(payload) });

  call.then(function () {
    closeForm();
    showMsg('msgMotor', id
      ? 'Motor berhasil diupdate ✔'
      : 'Motor baru masuk katalog ✔ — website otomatis menampilkan unit ini');
    loadBikes();
    loadStats();
  }).catch(function (err) {
    var extra = err.fields
      ? ' → ' + Object.keys(err.fields).map(function (k) { return k + ': ' + err.fields[k]; }).join('; ')
      : '';
    showMsg('msgMotor', 'Gagal menyimpan: ' + err.message + extra, 'error');
  }).finally(function () { btn.disabled = false; });
}

/* ---------- Permintaan jual ---------- */
function renderRequests(list) {
  var tbody = $('#tbodyReq');
  if (!list.length) {
    tbody.innerHTML = '<tr class="row-empty"><td colspan="7">Belum ada pengajuan. Form "Jual Motor" di website akan mengirim data ke sini.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function (r) {
    var options = Object.keys(STATUS_LABEL).map(function (k) {
      return '<option value="' + k + '"' + (r.status === k ? ' selected' : '') + '>' + STATUS_LABEL[k] + '</option>';
    }).join('');
    var waLink = 'https://wa.me/' + esc(String(r.wa).replace(/^0/, '62'));
    return '<tr>' +
      '<td><small>' + fmtDate(r.createdAt) + '</small></td>' +
      '<td><strong>' + esc(r.nama) + '</strong><br><a href="' + waLink + '" target="_blank" rel="noopener"><small>📱 ' + esc(r.wa) + '</small></a></td>' +
      '<td>' + esc(r.merk) + ' ' + esc(r.model) + '<br><small>Catatan: ' + esc(r.catatan || '—') + '</small></td>' +
      '<td><strong style="color:var(--red)">' + fmtIDR(r.harga) + '</strong></td>' +
      '<td><small>' + esc((r.kelengkapan && r.kelengkapan.length) ? r.kelengkapan.join(', ') : '—') + '</small></td>' +
      '<td><select class="chip" data-status-id="' + esc(r.id) + '">' + options + '</select></td>' +
      '<td class="actions"><button class="btn danger sm" data-del-req="' + esc(r.id) + '">🗑️</button></td>' +
      '</tr>';
  }).join('');
}

function loadRequests() {
  return api('/api/sell-requests').then(renderRequests).catch(function (e) {
    showMsg('msgReq', 'Gagal memuat permintaan: ' + e.message, 'error');
  });
}

/* ---------- Event delegation: tabel motor ---------- */
$('#tbodyMotor').addEventListener('click', function (e) {
  var editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    var bike = lastBikes.find(function (b) { return b.id === editBtn.getAttribute('data-edit'); });
    if (bike) openForm(bike);
    return;
  }
  var delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    var id = delBtn.getAttribute('data-del');
    var target = lastBikes.find(function (b) { return b.id === id; });
    if (!confirm('Hapus motor "' + (target ? target.name : id) + '" dari katalog?')) return;
    api('/api/bikes/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function (res) { showMsg('msgMotor', res.message); loadBikes(); loadStats(); })
      .catch(function (err) { showMsg('msgMotor', 'Gagal menghapus: ' + err.message, 'error'); });
  }
});

/* ---------- Event delegation: tabel permintaan ---------- */
$('#tbodyReq').addEventListener('change', function (e) {
  var sel = e.target.closest('[data-status-id]');
  if (!sel) return;
  api('/api/sell-requests/' + encodeURIComponent(sel.getAttribute('data-status-id')), {
    method: 'PATCH',
    body: JSON.stringify({ status: sel.value })
  }).then(function () {
    showMsg('msgReq', 'Status diperbarui menjadi "' + STATUS_LABEL[sel.value] + '"');
    loadStats();
  }).catch(function (err) {
    showMsg('msgReq', 'Gagal update status: ' + err.message, 'error');
    loadRequests();
  });
});

$('#tbodyReq').addEventListener('click', function (e) {
  var delBtn = e.target.closest('[data-del-req]');
  if (!delBtn) return;
  if (!confirm('Hapus permintaan ini secara permanen?')) return;
  api('/api/sell-requests/' + encodeURIComponent(delBtn.getAttribute('data-del-req')), { method: 'DELETE' })
    .then(function () { showMsg('msgReq', 'Permintaan dihapus'); loadRequests(); loadStats(); })
    .catch(function (err) { showMsg('msgReq', 'Gagal menghapus: ' + err.message, 'error'); });
});

/* ---------- Tab ---------- */
$$('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    $$('.tab').forEach(function (x) { x.classList.toggle('active', x === t); });
    $('#tab-motor').hidden = t.dataset.tab !== 'motor';
    $('#tab-permintaan').hidden = t.dataset.tab !== 'permintaan';
  });
});

/* ---------- Form drawer ---------- */
$('#btnAdd').addEventListener('click', function () { openForm(null); });
$('#btnCloseDrawer').addEventListener('click', closeForm);
$('#btnCancel').addEventListener('click', closeForm);
$('#overlay').addEventListener('click', function (e) { if (e.target === this) closeForm(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeForm(); });
$('#bikeForm').addEventListener('submit', submitForm);
$('#btnReloadReq').addEventListener('click', loadRequests);

/* ---------- Init ---------- */
api('/api/health')
  .then(function () {
    $('#apiStatus .dot').className = 'dot online';
    $('#apiText').textContent = 'API Online';
  })
  .catch(function () {
    $('#apiStatus .dot').className = 'dot offline';
    $('#apiText').textContent = 'API Offline';
  });

loadStats();
loadBikes();
loadRequests();