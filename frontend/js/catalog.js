/* ===== Katalog: render, filter, sort, favorit & modal detail ===== */
'use strict';

var GRADS = { matic: 'g-matic', sport: 'g-sport', bebek: 'g-bebek', retro: 'g-retro' };
var HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
var WA_SVG = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

var favs = new Set();

function fmtIDR(n) { return 'Rp ' + n.toLocaleString('id-ID'); }
function fmtKM(n) { return n.toLocaleString('id-ID') + ' km'; }
function grad(t) { return GRADS[t] || 'g-sport'; }
function waLink(msg) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg); }

function cardHTML(b) {
  return '' +
    '<article class="card bike" data-id="' + b.id + '">' +
      '<div class="card-media ' + grad(b.type) + '">' +
        '<img src="' + b.img + '" alt="' + b.name + '" loading="lazy">' +
        '<span class="badge badge-cond ' + b.cond + '">' + COND_LABELS[b.cond] + '</span>' +
        '<span class="badge badge-year">' + b.year + '</span>' +
        '<button class="fav-btn' + (favs.has(b.id) ? ' on' : '') + '" data-action="fav" aria-label="Simpan ke favorit">' + HEART + '</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<span class="card-brand">' + b.brand.toUpperCase() + ' • ' + b.typeName.toUpperCase() + '</span>' +
        '<h3>' + b.name + '</h3>' +
        '<ul class="spec-chips">' +
          '<li>🗓️ ' + b.year + '</li><li>🛣️ ' + fmtKM(b.km) + '</li><li>⚙️ ' + b.trans + '</li><li>⛽ ' + b.cc + ' cc</li>' +
        '</ul>' +
        '<div class="card-foot">' +
          '<div class="price"><strong>' + fmtIDR(b.price) + '</strong>' + (b.oldPrice ? '<s>' + fmtIDR(b.oldPrice) + '</s>' : '') + '</div>' +
          '<div class="card-actions">' +
            '<button class="btn btn-primary btn-sm" data-action="detail">Detail</button>' +
            '<a class="btn-icon wa" target="_blank" rel="noopener" aria-label="Chat WhatsApp" href="' +
              waLink('Halo NuMotorindo! Saya tertarik dengan *' + b.name + '* (' + b.year + ') seharga ' + fmtIDR(b.price) + '. Masih tersedia?') +
              '">' + WA_SVG + '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
}

(function () {
  var grid = document.getElementById('bikeGrid');
  var emptyEl = document.getElementById('emptyState');
  var countEl = document.getElementById('resultCount');
  var searchInput = document.getElementById('searchInput');
  var sortSel = document.getElementById('sortSel');
  var pillsWrap = document.getElementById('brandPills');

  var state = { q: '', brand: 'Semua', sort: 'new' };

  function getList() {
    var q = state.q.trim().toLowerCase();
    var list = BIKES.filter(function (b) {
      var okQ = !q || (b.name + ' ' + b.brand + ' ' + b.typeName).toLowerCase().indexOf(q) !== -1;
      var okB = state.brand === 'Semua' || b.brand === state.brand;
      return okQ && okB;
    });
    var s = state.sort;
    list.sort(function (a, b) {
      if (s === 'price-asc') return a.price - b.price;
      if (s === 'price-desc') return b.price - a.price;
      if (s === 'km-asc') return a.km - b.km;
      return b.year - a.year || a.price - b.price; /* terbaru */
    });
    return list;
  }

  function apply() {
    var list = getList();
    grid.innerHTML = list.map(cardHTML).join('');
    countEl.textContent = 'Menampilkan ' + list.length + ' dari ' + BIKES.length + ' unit';
    emptyEl.classList.toggle('show', list.length === 0);
  }

  /* ---------- Modal detail ---------- */
  var modal = document.getElementById('bikeModal');
  var mediaBox = document.getElementById('modalMedia');
  var mImg = document.getElementById('modalImg');
  var mBadges = document.getElementById('mediaBadges');
  var mBrandLine = document.getElementById('modalBrandLine');
  var mName = document.getElementById('modalName');
  var mPrice = document.getElementById('modalPrice');
  var mSpecs = document.getElementById('modalSpecs');
  var mDesc = document.getElementById('modalDesc');
  var mWaBuy = document.getElementById('modalWaBuy');
  var mWaTest = document.getElementById('modalWaTest');
  var lastFocus = null;

  function openModal(id) {
    var b = BIKES.find(function (x) { return x.id === id; });
    if (!b) return;
    lastFocus = document.activeElement;
    mediaBox.className = 'modal-media ' + grad(b.type);
    mImg.src = b.img; mImg.alt = b.name;
    mBadges.innerHTML = '<span class="badge badge-cond ' + b.cond + '">' + COND_LABELS[b.cond] + '</span>' +
                        '<span class="badge badge-year">' + b.year + '</span>';
    mBrandLine.textContent = b.brand + ' • ' + b.typeName + ' • ' + b.trans;
    mName.textContent = b.name;
    mPrice.innerHTML = '<div><strong>' + fmtIDR(b.price) + '</strong>' + (b.oldPrice ? '<s>' + fmtIDR(b.oldPrice) + '</s>' : '') + '</div>' +
                       '<span class="dp-hint">DP mulai ' + fmtIDR(Math.round(b.price * 0.15)) + '</span>';
    var specs = [
      ['Tahun', b.year], ['Odometer', fmtKM(b.km)], ['Mesin', b.cc + ' cc'],
      ['Transmisi', b.trans], ['Warna', b.color], ['Kondisi', COND_LABELS[b.cond]]
    ];
    mSpecs.innerHTML = specs.map(function (p) {
      return '<div class="spec"><dt>' + p[0] + '</dt><dd>' + p[1] + '</dd></div>';
    }).join('');
    mDesc.textContent = b.desc;
    mWaBuy.href = waLink('Halo NuMotorindo! Saya mau tanya ketersediaan *' + b.name + '* (' + b.year + ') — ' + fmtIDR(b.price) + '. Bisa dijadwalkan lihat unit?');
    mWaTest.href = waLink('Halo NuMotorindo! Saya ingin jadwal test ride *' + b.name + '* (' + b.year + '). Kapan waktu yang pas?');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    modal.querySelector('.modal-close').focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- Events ---------- */
  var deb;
  searchInput.addEventListener('input', function () {
    clearTimeout(deb);
    deb = setTimeout(function () { state.q = searchInput.value; apply(); }, 140);
  });

  sortSel.addEventListener('change', function () {
    state.sort = sortSel.value;
    apply();
  });

  pillsWrap.addEventListener('click', function (e) {
    var pill = e.target.closest('.pill');
    if (!pill) return;
    pillsWrap.querySelectorAll('.pill').forEach(function (p) { p.classList.remove('active'); });
    pill.classList.add('active');
    state.brand = pill.dataset.brand;
    apply();
  });

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.bike');
    if (!card) return;
    var id = card.dataset.id;
    var act = e.target.closest('[data-action]');
    if (!act) { openModal(id); return; }
    if (act.dataset.action === 'detail') { openModal(id); return; }
    if (act.dataset.action === 'fav') {
      if (favs.has(id)) {
        favs.delete(id); act.classList.remove('on');
        showToast('Dihapus dari daftar favorit');
      } else {
        favs.add(id); act.classList.add('on');
        showToast('Ditambahkan ke favorit ❤️');
      }
    }
  });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  /* API kecil untuk pencarian dari hero */
  window.Catalog = {
    search: function (q, brand) {
      state.q = q || '';
      state.brand = brand && brand !== 'Semua' ? brand : 'Semua';
      searchInput.value = state.q;
      pillsWrap.querySelectorAll('.pill').forEach(function (p) {
        p.classList.toggle('active', p.dataset.brand === state.brand);
      });
      apply();
    }
  };

  /* ---------- Sinkronisasi dengan backend ---------- */
  /* Jika backend aktif, katalog mengambil data terkini dari API.
     Jika tidak, tetap pakai data demo lokal (BIKES).            */
  function sinkronBackend() {
    if (!window.fetch || typeof NUMO_API_BASE === 'undefined') return;
    fetch(NUMO_API_BASE + '/api/bikes')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) return;
        BIKES.splice.apply(BIKES, [0, BIKES.length].concat(list));
        apply();
        console.log('[katalog] ' + list.length + ' unit dimuat dari backend');
      })
      .catch(function () {
        /* Backend nonaktif → diam-diam pakai data lokal */
        console.log('[katalog] Backend tidak aktif, memakai data lokal');
      });
  }

  sinkronBackend();
  apply();
})();