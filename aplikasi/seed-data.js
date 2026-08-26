/* ============================================================
   NuMotorindo Finance — Seed awal
   Pengguna, profil showroom & beberapa unit motor beserta
   riwayat biaya perbaikan/dokumen dan penjualan (invoice).
   Login demo: admin/admin123 · kasir/kasir123
============================================================ */
'use strict';

const crypto = require('crypto');

function makeUser(id, username, name, role, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id, username, name, role, salt,
    hash: crypto.scryptSync(password, salt, 64).toString('hex'),
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  nextInvoiceSeq: 4,

  users: [
    makeUser('user-1', 'admin', 'Admin Showroom', 'admin', 'admin123'),
    makeUser('user-2', 'kasir', 'Kasir Showroom', 'staff', 'kasir123')
  ],

  settings: {
    name: 'NuMotorindo Showroom Motor Bekas',
    address: 'Jl. Raya Motor No. 88, Tebet, Jakarta Selatan',
    phone: '0812-3456-7890',
    email: 'sales@numotorindo.id',
    showLoginHint: true,
    footerNote: 'Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan kecuali sesuai kesepakatan bersama.'
  },

  opex: [
    { id: 'opex-1', date: '2026-06-01', category: 'sewa', desc: 'Sewa tempat Juni 2026', amount: 3500000 },
    { id: 'opex-2', date: '2026-07-01', category: 'sewa', desc: 'Sewa tempat Juli 2026', amount: 3500000 },
    { id: 'opex-3', date: '2026-08-01', category: 'sewa', desc: 'Sewa tempat Agustus 2026', amount: 3500000 },
    { id: 'opex-4', date: '2026-08-05', category: 'gaji', desc: 'Gaji mekanik & admin Agustus', amount: 5500000 },
    { id: 'opex-5', date: '2026-08-03', category: 'listrik-air', desc: 'Listrik & air bulan Juli', amount: 850000 },
    { id: 'opex-6', date: '2026-08-10', category: 'marketing', desc: 'Iklan boosting unit Ninja 250', amount: 300000 }
  ],

  units: [
    {
      id: 'unit-1', code: 'MB-0001',
      name: 'Honda Vario 160 ABS', brand: 'Honda', year: 2023, km: 12400,
      plate: 'B 4321 XYZ', color: 'Hitam Doff', status: 'terjual',
      purchase: { price: 24500000, date: '2026-05-12', seller: 'Budi Santoso', note: 'Satu tangan, service record AHASS' },
      repairs: [
        { id: 'rp-1a2b', desc: 'Ganti kampas rem & kampas kopling', cost: 450000, date: '2026-05-14' },
        { id: 'rp-3c4d', desc: 'Servis besar + tune up EFI', cost: 320000, date: '2026-05-14' }
      ],
      documents: [
        { id: 'dc-5e6f', desc: 'Balik nama (BBN) Samsat', cost: 750000, date: '2026-05-20' },
        { id: 'dc-7a8b', desc: 'Pajak tahunan + perpanjangan STNK 5 tahun', cost: 435000, date: '2026-05-20' }
      ],
      sale: {
        price: 28500000, date: '2026-06-20', payment: 'cash', dp: null,
        buyerName: 'Andi Prasetyo', buyerPhone: '0813-9988-1122', buyerAddress: 'Jl. Melati No. 7, Depok',
        invoiceNo: 'INV-2606-001', note: 'Bonus helm 2 buah'
      },
      createdAt: '2026-05-12T03:00:00.000Z'
    },

    {
      id: 'unit-2', code: 'MB-0002',
      name: 'Yamaha Aerox 155 Connected', brand: 'Yamaha', year: 2022, km: 15800,
      plate: 'B 5678 ABC', color: 'Biru Racing', status: 'terjual',
      purchase: { price: 22000000, date: '2026-06-02', seller: 'Dewi Lestari', note: '' },
      repairs: [
        { id: 'rp-9c0d', desc: 'Ganti ban depan & belakang', cost: 780000, date: '2026-06-05' }
      ],
      documents: [
        { id: 'dc-1e2f', desc: 'Cek mutasi & administrasi Samsat', cost: 150000, date: '2026-06-05' }
      ],
      sale: {
        price: 26000000, date: '2026-07-10', payment: 'kredit', dp: 10000000,
        leasing: 'Adira Finance', tenor: 24, installment: 750000,
        installmentsPaid: 4,
        buyerName: 'Rina Wulandari', buyerPhone: '0821-5566-7788', buyerAddress: 'Jl. Kenanga No. 21, Tangerang Selatan',
        invoiceNo: 'INV-2607-002', note: 'Leasing Adira, tenor 24 bulan'
      },
      createdAt: '2026-06-02T03:30:00.000Z'
    },

    {
      id: 'unit-3', code: 'MB-0003',
      name: 'Honda BeAT Street ESP', brand: 'Honda', year: 2021, km: 19200,
      plate: 'D 3311 KL', color: 'Merah Hitam', status: 'terjual',
      purchase: { price: 15500000, date: '2026-07-01', seller: 'Hendra Gunawan', note: 'Bodi mulus' },
      repairs: [
        { id: 'rp-3a4b', desc: 'Cat ulang panel samping kanan', cost: 600000, date: '2026-07-03' }
      ],
      documents: [
        { id: 'dc-5c6d', desc: 'Balik nama (BBN) Samsat', cost: 650000, date: '2026-07-06' }
      ],
      sale: {
        price: 18700000, date: '2026-08-05', payment: 'cash', dp: null,
        buyerName: 'Joko Susilo', buyerPhone: '0857-1234-9090', buyerAddress: 'Jl. Anggrek No. 5, Bekasi',
        invoiceNo: 'INV-2608-003', note: ''
      },
      createdAt: '2026-07-01T04:00:00.000Z'
    },

    {
      id: 'unit-4', code: 'MB-0004',
      name: 'Kawasaki Ninja 250 FI', brand: 'Kawasaki', year: 2019, km: 21600,
      plate: 'B 7012 GH', color: 'Lime Green', status: 'tersedia',
      taxDueDate: '2026-09-05',
      purchase: { price: 38000000, date: '2026-07-18', seller: 'Agus Salim', note: 'Garasi pribadi, jarang dipakai' },
      repairs: [
        { id: 'rp-7e8f', desc: 'Ganti rantai + gir set', cost: 850000, date: '2026-07-21' },
        { id: 'rp-9a0b', desc: 'Servis mesin ringan & ganti oli', cost: 400000, date: '2026-07-21' }
      ],
      documents: [
        { id: 'dc-1c2d', desc: 'Balik nama (BBN) Samsat', cost: 900000, date: '2026-07-24' },
        { id: 'dc-3e4f', desc: 'Pajak tahunan', cost: 625000, date: '2026-07-24' }
      ],
      sale: null,
      createdAt: '2026-07-18T02:00:00.000Z'
    },

    {
      id: 'unit-5', code: 'MB-0005',
      name: 'Suzuki Satria FU 150', brand: 'Suzuki', year: 2020, km: 13400,
      plate: 'E 4409 MN', color: 'Hitam Silver', status: 'tersedia',
      taxDueDate: '2026-08-28',
      purchase: { price: 21500000, date: '2026-08-01', seller: 'Rudi Hartono', note: '' },
      repairs: [
        { id: 'rp-5a6b', desc: 'Ganti aki & busi', cost: 350000, date: '2026-08-03' }
      ],
      documents: [
        { id: 'dc-7c8d', desc: 'Cek fisik & administrasi STNK', cost: 100000, date: '2026-08-03' }
      ],
      sale: null,
      createdAt: '2026-08-01T05:00:00.000Z'
    },

    {
      id: 'unit-6', code: 'MB-0006',
      name: 'Honda PCX 160 ABS', brand: 'Honda', year: 2023, km: 11800,
      plate: 'B 9876 QR', color: 'Radiant White', status: 'tersedia',
      purchase: { price: 30000000, date: '2026-08-10', seller: 'Maya Anggraini', note: 'Like new, masih garansi resmi' },
      repairs: [],
      documents: [],
      sale: null,
      createdAt: '2026-08-10T06:00:00.000Z'
    }
  ]
};