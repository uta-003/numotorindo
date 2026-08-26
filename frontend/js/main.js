/* ===== UI global: toast, nav, animasi, form, FAQ ===== */
'use strict';

/* ---------- Toast ---------- */
var toastWrap = document.getElementById('toastWrap');
function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  toastWrap.appendChild(el);
  setTimeout(function () {
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 320);
  }, 2600);
}
window.showToast = showToast;

/* ---------- Header scroll + tombol ke atas ---------- */
var header = document.getElementById('navbar');
var toTop = document.getElementById('toTop');
function onScroll() {
  header.classList.toggle('scrolled', window.scrollY > 24);
  toTop.classList.toggle('show', window.scrollY > 620);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
toTop.addEventListener('click', function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- Menu mobile ---------- */
var burger = document.getElementById('burger');
var navLinks = document.getElementById('navLinks');
burger.addEventListener('click', function () {
  var open = header.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});
navLinks.addEventListener('click', function (e) {
  if (e.target.tagName === 'A') {
    header.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- Scrollspy: highlight menu aktif ---------- */
var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
var spySections = spyLinks
  .map(function (a) { return document.querySelector(a.hash); })
  .filter(Boolean);
if ('IntersectionObserver' in window && spySections.length) {
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      spyLinks.forEach(function (a) {
        a.classList.toggle('active', a.hash === '#' + en.target.id);
      });
    });
  }, { rootMargin: '-40% 0px -55%' });
  spySections.forEach(function (s) { spy.observe(s); });
}

/* ---------- Reveal saat scroll ---------- */
if ('IntersectionObserver' in window) {
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        revealIO.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });
} else {
  document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
}

/* ---------- Statistik: animasi angka ---------- */
function fmtNum(v, dec) {
  return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('id-ID');
}
function countUp(el) {
  var target = parseFloat(el.dataset.count);
  var dec = parseInt(el.dataset.decimals || '0', 10);
  var suf = el.dataset.suffix || '';
  var dur = 1300;
  var t0 = performance.now();
  function tick(now) {
    var p = Math.min((now - t0) / dur, 1);
    var eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtNum(target * eased, dec) + suf;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
var statEls = document.querySelectorAll('[data-count]');
if ('IntersectionObserver' in window) {
  var statIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        countUp(en.target);
        statIO.unobserve(en.target);
      }
    });
  }, { threshold: 0.6 });
  statEls.forEach(function (el) { statIO.observe(el); });
} else {
  statEls.forEach(countUp);
}

/* ---------- Marquee: gandakan konten agar loop mulus ---------- */
var track = document.getElementById('marqueeTrack');
track.innerHTML += track.innerHTML;

/* ---------- Pencarian dari hero ---------- */
var heroSearchBtn = document.getElementById('heroSearchBtn');
var heroSearch = document.getElementById('heroSearch');
var heroBrand = document.getElementById('heroBrand');
function heroGo() {
  Catalog.search(heroSearch.value, heroBrand.value);
  document.getElementById('katalog').scrollIntoView({ behavior: 'smooth' });
}
heroSearchBtn.addEventListener('click', heroGo);
heroSearch.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') heroGo();
});

/* ---------- Form jual motor → kirim ke backend ---------- */
document.getElementById('sellForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var form = e.target;
  var ok = true;
  var rules = [
    ['sNama', function (v) { return v.trim().length >= 3; }],
    ['sWa', function (v) { return /^(\+?62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')); }],
    ['sMerk', function (v) { return !!v; }],
    ['sModel', function (v) { return v.trim().length >= 2; }],
    ['sTahun', function (v) { return +v >= 1990 && +v <= 2026; }],
    ['sHarga', function (v) { return +v >= 1000000; }]
  ];
  rules.forEach(function (r) {
    var input = document.getElementById(r[0]);
    var field = input.closest('.field');
    var valid = r[1](input.value);
    field.classList.toggle('invalid', !valid);
    if (!valid) ok = false;
  });
  if (!ok) {
    showToast('Cek lagi ya, ada isian yang belum valid 🙏', 'error');
    return;
  }

  /* Payload sesuai skema POST /api/sell-requests */
  var payload = {
    nama: document.getElementById('sNama').value.trim(),
    wa: document.getElementById('sWa').value.trim(),
    merk: document.getElementById('sMerk').value,
    model: document.getElementById('sModel').value.trim(),
    tahun: Number(document.getElementById('sTahun').value),
    harga: Number(document.getElementById('sHarga').value),
    kelengkapan: Array.prototype.map.call(
      document.querySelectorAll('#sellForm .chip-check input:checked'),
      function (i) { return i.nextElementSibling.textContent.trim(); }
    ),
    catatan: document.getElementById('sCatatan').value.trim()
  };

  function sukses() {
    showToast('Permintaan terkirim! Tim kami hubungi kamu ≤ 24 jam 🎉');
    form.reset();
  }

  if (window.fetch && typeof NUMO_API_BASE !== 'undefined') {
    fetch(NUMO_API_BASE + '/api/sell-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        sukses();
      })
      .catch(function () {
        showToast('Backend belum aktif — jalankan `node server.js` di folder backend 🙏', 'error');
      });
  } else {
    sukses();
  }
});

/* ---------- FAQ: tutup item lain saat satu dibuka ---------- */
var faqs = Array.prototype.slice.call(document.querySelectorAll('details.faq-item'));
faqs.forEach(function (d) {
  d.addEventListener('toggle', function () {
    if (!d.open) return;
    faqs.forEach(function (o) { if (o !== d) o.open = false; });
  });
});

/* ---------- Tahun footer ---------- */
document.getElementById('year').textContent = new Date().getFullYear();