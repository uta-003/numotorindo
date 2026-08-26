# 💰 NuMotorindo Finance

Aplikasi **showroom motor bekas** untuk pencatatan keuangan: biaya pembelian, biaya perbaikan,
biaya dokumen, perhitungan **laba rugi**, serta pembuatan & **cetak invoice** — lengkap dengan
**login multi pengguna**. Dibangun tanpa dependensi eksternal (Node.js murni + vanilla JS),
konsisten dengan gaya proyek `backend/` yang sudah ada.

## 🚀 Menjalankan

```bash
cd D:\projects\numotorindo\aplikasi
node server.js          # default port 3100 (bebas bentrok dengan backend utama di 3000)
node server.js 4000     # atau port lain
```

Buka **http://localhost:3100/** lalu login:

| Username | Password | Peran |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `kasir` | `kasir123` | Staf Showroom |

## ✨ Fitur

- **Login & sesi** — password di-hash `scrypt`, token sesi tersimpan 7 hari (bertahan saat server restart), ganti password sendiri di menu Pengaturan.
- **Biaya Operasional (OPEX)** — menu 💸 untuk gaji/sewa/listrik/marketing; Laba Rugi menampilkan **Laba Bersih Setelah OPEX**, dashboard ada kartu OPEX bulan ini.
- **Pengingat pajak/STNK** — jatuh tempo pajak per unit; dashboard menampilkan yang ≤30 hari (merah bila lewat).
- **Kolektibilitas angsuran kredit** — angsuran terbayar, sisa piutang & status lancar/telat + tombol ＋1 di dashboard.
- **Foto unit** (data URL ±450KB), **plat nomor unik**, **audit log admin**, **backup harian otomatis** (`data/backups/`, rotasi 7 hari), **rate-limit login**, dan **unit test**: `node test.js`.
- **Hak akses per role** — hanya admin yang dapat: menghapus unit, membatalkan penjualan, mengubah pengaturan showroom, dan mengelola pengguna (divalidasi di server → 403).
- **Manajemen pengguna (admin)** — tambah/edit/hapus akun + reset password lewat menu 👥 Pengguna; proteksi akun terakhir & tidak bisa menghapus diri sendiri.
- **Export CSV** — tombol ⬇️ di halaman Stok Motor & Laba Rugi (format ramah Excel Indonesia: BOM UTF-8, pemisah `;`).
- **Stok Motor** — CRUD unit (`MB-0001`, dst.) + detail unit berisi:
  - **Biaya Pembelian**: harga beli, tanggal, penjual, catatan.
  - **Biaya Perbaikan**: daftar item (keterangan, biaya, tanggal) + tambah/hapus.
  - **Biaya Dokumen**: BBN, pajak, mutasi, dsb. + tambah/hapus.
  - **Total modal otomatis** = pembelian + seluruh perbaikan + seluruh dokumen.
- **Penjualan** — catat harga jual, tanggal, pembeli, metode cash/kredit (+DP, leasing, tenor, angsuran/bulan), estimasi laba live,
  status berubah menjadi *terjual* dan **nomor invoice dibuat otomatis** (`INV-{YYMM}-{urut}`). Data penjualan bisa dikoreksi tanpa membatalkan invoice.
- **Laba Rugi** — laporan per periode (bulan ini/lalu/3 bulan/tahun ini/semua/kustom):
  tabel per unit (pembelian, perbaikan, dokumen, total modal, harga jual, laba/rugi, margin %)
  + baris total + tombol 🖨️ cetak laporan.
- **Invoice** — preview bergaya A4 siap cetak (header showroom dari Pengaturan, data pembeli,
  rincian tagihan, DP/sisa, tanda tangan). Opsi centang untuk menyertakan **rincian biaya internal**
  sebagai arsip. Batalkan penjualan mengembalikan unit ke stok.
- **Dashboard** — kartu statistik (unit tersedia, terjual, modal tertanam, laba bersih), grafik batang
  laba 6 bulan terakhir, rincian biaya agregat, invoice terbaru.
- **Pengaturan** — profil showroom (nama, alamat, telepon, email, catatan footer) untuk header/footer invoice.

## 🔌 Endpoint API (semua kecuali login butuh header `Authorization: Bearer <token>`)

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | `{username,password}` → `{token,user}` |
| POST | `/api/auth/logout` | Hapus sesi |
| GET | `/api/auth/me` | Info pengguna aktif |
| GET | `/api/stats` | Ringkasan dashboard + deret 6 bulan |
| GET | `/api/units?q=&status=` | Daftar unit (+ `_totals` kalkulasi) |
| POST | `/api/units` | Tambah unit |
| GET/PUT/PATCH/DELETE | `/api/units/:id` | Detail / ubah / hapus |
| POST | `/api/units/:id/costs` | Tambah biaya `{kind:'perbaikan'\|'dokumen',desc,cost,date}` |
| PATCH/DELETE | `/api/units/:id/costs/:cid` | Ubah / hapus item biaya |
| POST | `/api/units/:id/sell` | Catat penjualan → nomor invoice otomatis |
| PATCH/DELETE | `/api/units/:id/sale` | Koreksi / batalkan penjualan |
| GET | `/api/report/laba-rugi?from=&to=` | Laporan laba rugi + total |
| GET | `/api/invoices` · `/api/invoices/:no` | Daftar & detail invoice siap cetak |
| POST | `/api/auth/change-password` | Ganti password sendiri `{oldPassword,newPassword}` |
| GET/POST | `/api/users` 🔒 | Daftar / tambah pengguna (admin) |
| PATCH/DELETE | `/api/users/:id` 🔒 | Edit nama/peran/reset pass / hapus (admin) |
| GET/PUT | `/api/settings` | Profil showroom (PUT hanya admin) |

Error validasi berbentuk `400 { message, errors: {field: pesan} }`.

## 🗄️ Data

Tersimpan di `aplikasi/data/db.json` (dibuat otomatis dari `seed-data.js` saat pertama kali jalan:
2 pengguna, profil showroom, 6 unit motor — 3 terjual dengan invoice). Hapus file tersebut untuk reset.

## 🎨 Palet UI

`#003049` navy (sidebar/header) · `#D62828` merah (aksen primer) · `#F77F00` oranye (aksen sekunder) · `#FCBF49` kuning (highlight)

```
aplikasi/
├── server.js        # entry: statis + dispatch API (port default 3100)
├── api.js           # handler REST + validator + kalkulasi
├── db.js            # persistensi JSON + generator nomor invoice
├── seed-data.js     # data awal (user, unit, biaya, penjualan)
├── public/
│   ├── index.html   # SPA shell (login + aplikasi)
│   ├── css/app.css  # tema palet + layout + print CSS A4
│   └── js/app.js    # router hash + seluruh halaman
└── data/db.json     # dibuat otomatis saat runtime
```