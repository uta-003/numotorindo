# 🏍️ NuMo Showroom — Aplikasi Manajemen Showroom Motor Bekas

Aplikasi web untuk mengelola bisnis showroom motor bekas: **modal, biaya perbaikan, biaya dokumen, total modal, harga jual, penghitungan laba rugi, invoice & cetak**, dan **manajemen user multi-role**. Dibangun **tanpa dependensi eksternal** — hanya Node.js bawaan (http, crypto, fs).

## 🚀 Menjalankan

```bash
cd D:\projects\numotorindo\showroom-motor
node server.js          # default port 3100
node server.js 4100     # atau port lain
```

Lalu buka **http://localhost:3100/** di browser.

## 🔑 Akun Demo (multi-role)

| Username | Password | Role | Hak Akses |
|---|---|---|---|
| `admin` | `admin123` | Administrator | Semua fitur (unit, biaya, invoice, laporan, kelola pengguna) |
| `owner` | `owner123` | Pemilik | Lihat laporan laba rugi, atur harga jual |
| `sales` | `sales123` | Sales | Buat & cetak invoice penjualan |
| `mekanik` | `mekanik123` | Mekanik | Hanya input biaya perbaikan (tidak melihat angka keuangan) |

> Password tersimpan *scrypt-hashed* + salt acak. Ubah `data/db.json` utk produksi.

## ✨ Fitur

- **Login & role**: sesi token (7 hari), hak akses berbeda per role, kelola pengguna (tambah/edit/nonaktif/hapus) oleh admin.
- **Data Unit**: kode otomatis `UM-xxxx`, tambah/edit/hapus motor, cari & filter status (tersedia/booking/terjual).
- **Biaya per unit**: biaya pembelian, biaya perbaikan (mekanik/admin), biaya dokumen (admin) — ditambah per item dengan total otomatis.
- **Perhitungan otomatis**:
  - `Total Modal = Biaya Pembelian + Biaya Perbaikan + Biaya Dokumen`
  - `Laba/Rugi = Harga Jual − Total Modal` (dan persen margin)
- **Invoice & cetak**: buat invoice penjualan (unit otomatis *Terjual*), cetak A4 dengan **terbilang**, metode pembayaran (tunai/transfer/DP/kredit), hapus invoice oleh admin (unit kembali *Tersedia*).
- **Laporan Laba Rugi** (admin/owner): total omzet vs modal, laba bersih, tren 6 bulan (grafik), rincian laba/rugi per unit + total.
- **Tampilan modern** dengan palet brand: `#003049` (navy), `#D62828` (merah), `#F77F00` (oranye), `#FCBF49` (kuning), responsif.

## 🗂️ Struktur

```
showroom-motor/
├── server.js          # entry: sajikan SPA + dispatch REST API
├── api.js             # REST API + auth + role + validator + hitung modal/laba
├── db.js              # persisten JSON (auto-seed saat pertama kali)
├── hash.js            # hashing password (scrypt)
├── seed-data.js       # 4 user + 6 unit + 2 invoice awal
├── data/db.json       # (dibuat otomatis saat runtime — hapus utk reset seed)
└── public/            # frontend SPA
    ├── index.html
    ├── css/style.css
    └── js/{api.js, app.js}
```

## 🔌 Endpoint API

| Metode & Path | Fungsi |
|---|---|
| `POST /api/auth/login` | Login → token + permissions |
| `GET  /api/auth/me` · `POST /api/auth/logout` | Profil / keluar |
| `GET/POST/PUT/PATCH/DELETE /api/units...` | CRUD unit |
| `POST/DELETE /api/units/:id/costs` | Tambah/hapus biaya (perbaikan/dokumen) |
| `GET/POST/DELETE /api/invoices...` | Invoice penjualan |
| `GET /api/reports/summary` | Ringkasan laba/rugi + tren 6 bulan |
| `GET /api/units/:id` | Detail unit dengan `totals` kalkulasi |

## ⚠️ Catatan
Autentikasi berbasis sesi sederhana (cocok utk demo lokal). Untuk produksi, gunakan HTTPS dan sandingkan dengan database (mis. SQLite/PostgreSQL) serta perkuat CORS di `api.js`.