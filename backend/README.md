# 🔧 NuMotorindo Backend

REST API **tanpa dependensi eksternal** (Node.js murni) yang mengelola seluruh konten dinamis frontend: katalog motor & pengajuan jual motor. Dilengkapi **dashboard admin** untuk mengisi/mengubah data tanpa coding.

## 🚀 Menjalankan

```bash
cd D:\projects\numotorindo\backend
node server.js          # default port 3000
node server.js 4000     # atau port lain
```

| URL | Keterangan |
|---|---|
| `http://localhost:3000/` | Website frontend (disajikan langsung oleh backend) |
| `http://localhost:3000/admin` | 🎛️ **Dashboard admin** — kelola motor & permintaan |
| `http://localhost:3000/api/bikes` | REST API katalog |

> Frontend di port 8080 juga tetap bisa dipakai — ia otomatis mengambil data dari API ini, dan jatuh kembali ke data lokal bila backend mati.

## 🔌 Endpoint API

### Motor (`/api/bikes`)
| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/bikes?q=&brand=&sort=` | Daftar motor. `q`=cari teks, `brand`=Honda/Yamaha/Suzuki/Kawasaki, `sort`=`new`(default)/`price-asc`/`price-desc`/`km-asc` |
| GET | `/api/bikes/:id` | Detail satu motor |
| POST | `/api/bikes` | Tambah motor → 201 |
| PUT | `/api/bikes/:id` | Ganti data penuh |
| PATCH | `/api/bikes/:id` | Perbarui sebagian field |
| DELETE | `/api/bikes/:id` | Hapus motor |

Field body POST/PUT: `name*, brand*, type*(matic/sport/bebek/retro), year*, km*, cc*, trans*, price*(≥1jt), oldPrice?, cond*(like-new/bagus/mulus), color*, desc?, img?` — `img` kosong otomatis diisi ilustrasi sesuai tipe. Respons error 400 berbentuk `{ message, errors: {field: pesan} }`.

### Permintaan jual (`/api/sell-requests`)
| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/sell-requests` | Dipakai form "Jual Motor" di website |
| GET | `/api/sell-requests?status=baru` | Daftar (untuk admin) |
| PATCH | `/api/sell-requests/:id` | Ubah `status`(`baru/dihubungi/nego/deal/batal`) / `note` |
| DELETE | `/api/sell-requests/:id` | Hapus |

### Lainnya
- `GET /api/health` → status server
- `GET /api/stats` → `{ totalBikes, byBrand, totalRequests, newRequests }`

## 🗄️ Data
Tersimpan di `backend/data/db.json` (dibuat otomatis dari `seed-data.js` saat pertama kali jalan). Hapus file tersebut untuk reset ke seed. Format ID motor baru: `bike-N`, permintaan: `req-N`.

```
backend/
├── server.js        # entry: static + dispatch API
├── api.js           # handler REST + validator
├── db.js            # persistensi JSON
├── seed-data.js     # 12 motor awal (identik frontend)
├── public/
│   ├── admin.html   # dashboard admin
│   ├── css/admin.css
│   └── js/admin.js
└── data/db.json     # dibuat otomatis saat runtime
```

## 🔗 Integrasi Frontend
- `frontend/js/data.js` → konstanta `NUMO_API_BASE` (default `http://localhost:3000`)
- `frontend/js/catalog.js` → saat halaman dibuka, katalog mengambil daftar motor dari API; jika backend tidak aktif, tetap tampil dengan data lokal
- `frontend/js/main.js` → form jual motor mengirim `POST /api/sell-requests`; bila backend mati muncul toast peringatan dan isian tidak hilang

## ⚠️ Catatan
Belum ada autentikasi (demo lokal). Untuk produksi, tambahkan auth pada endpoint mutasi (`POST/PUT/PATCH/DELETE`) dan batasi CORS pada origin tertentu di fungsi `cors()` di `api.js`.