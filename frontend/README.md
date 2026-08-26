# 🏍️ NuMotorindo — Showroom Motor Bekas

Landing page showroom motor bekas dengan UI/UX modern ("kekinian"): glassmorphism navbar, hero blob dengan kartu mengambang, marquee merek, katalog dinamis dengan filter & sorting, modal detail unit, form konsinyasi dengan validasi, testimoni, FAQ accordion, dan integrasi tombol WhatsApp.

## 🎨 Palet Warna

| Warna | Hex | Peran |
|---|---|---|
| Navy | `#003049` | Warna utama / teks & footer |
| Merah | `#D62828` | Aksen kuat / harga & CTA |
| Oranye | `#F77F00` | Gradasi CTA & highlight |
| Kuning | `#FCBF49` | Highlight, badge, aksen |

Font: **Plus Jakarta Sans** (Google Fonts).

## 📁 Struktur

```
numotorindo/
└── frontend/               # Aplikasi frontend (folder ini)
    ├── index.html          # Halaman utama (semua section)
    ├── server.js           # Mini static server untuk preview lokal (tanpa dependensi)
    ├── css/
    │   ├── base.css        # Design token, reset, tombol, badge, toast
    │   ├── layout.css      # Navbar, hero, marquee, footer, fab
    │   ├── sections.css    # Katalog, fitur, form jual, testimoni, FAQ, CTA
    │   ├── modal.css       # Popup detail motor
    │   └── responsive.css  # Breakpoints mobile-first
    ├── js/
    │   ├── data.js         # 12 data motor demo + nomor WA
    │   ├── catalog.js      # Render katalog, filter/sort, favorit, modal
    │   └── main.js         # Nav, scrollspy, animasi reveal/count-up, form
    └── assets/
        ├── favicon.svg
        └── img/            # Ilustrasi SVG motor (sport/matic/bebek/retro)
```

> Folder `frontend/` ini dirancang sebagai bagian frontend dari proyek yang lebih besar — backend nantinya bisa ditempatkan sebagai folder sejajar di dalam `numotorindo/` (mis. `backend/`).

## ▶️ Cara Menjalankan

Tanpa build tools — cukup buka `index.html` di browser, atau:

```bash
# opsi 1: mini static server bawaan (disarankan)
node server.js            # default port 8080 → http://localhost:8080
node server.js 3000       # atau port lain

# opsi 2: Python
python -m http.server 8080

# opsi 3: Node.js lain
npx serve .
```

lalu akses `http://localhost:8080`.

## ✨ Fitur

- **Katalog dinamis**: cari teks, filter merek, urutkan harga/km/tahun — semua dari `js/data.js`
- **Modal detail motor**: spesifikasi lengkap, estimasi DP, tombol WhatsApp per-unit (pesan otomatis)
- **Favorit**: toggle ❤️ di tiap kartu dengan notifikasi toast
- **Form jual motor**: validasi inline (nama, format WA, tahun, harga) + toast sukses
- **Animasi**: reveal on-scroll, count-up statistik, floating cards, marquee pause on hover
- **Scrollspy**: menu navbar ikut menyorot section aktif
- **Responsif penuh** + dukungan `prefers-reduced-motion`

> Catatan: nomor WhatsApp (`6281234567890`), alamat, dan data unit adalah placeholder/demo — ubah di `js/data.js` dan `index.html` sesuai kebutuhan. Data form tidak dikirim ke server (front-end only).