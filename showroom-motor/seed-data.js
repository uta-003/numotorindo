/* ============================================================
   NuMo Showroom — Seed data awal
   4 user (admin/owner/sales/mekanik), 6 unit motor beserta
   biaya perbaikan & dokumen, 2 invoice penjualan
============================================================ */
'use strict';

const { hashPassword } = require('./hash');

function mkUser(id, username, password, name, role) {
  const { salt, hash } = hashPassword(password);
  return { id, username, name, role, salt, passHash: hash, active: true, createdAt: new Date().toISOString() };
}

function mkCost(id, desc, amount, date) {
  return { id, desc, amount, date };
}

const users = [
  mkUser('user-1', 'admin', 'admin123', 'Admin Showroom', 'admin'),
  mkUser('user-2', 'owner', 'owner123', 'Budi Santoso (Pemilik)', 'owner'),
  mkUser('user-3', 'sales', 'sales123', 'Rina Amelia (Sales)', 'sales'),
  mkUser('user-4', 'mekanik', 'mekanik123', 'Joko Prasetyo (Mekanik)', 'mekanik')
];

/* komisi & target untuk sales */
Object.assign(users.find((u) => u.role === 'sales'), { komisiPersen: 2.5, targetBulanan: 40000000 });

const customers = [
  { id: 'cust-1', name: 'Hendra Wijaya', phone: '0812-3344-5566', address: 'Jl. Kenanga No. 21, Depok', notes: 'Pelanggan tetap — minat motor matic', createdAt: '2026-06-28T06:30:00.000Z' },
  { id: 'cust-2', name: 'Agus Salim', phone: '0857-1122-3344', address: 'Jl. Melati Raya No. 9, Bekasi', notes: '', createdAt: '2026-05-09T04:15:00.000Z' }
];

const units = [
  {
    id: 'unit-1', code: 'UM-0001',
    name: 'Honda Beat Sporty FI', brand: 'Honda', type: 'Skutik',
    year: 2020, km: 15430, cc: 110, transmisi: 'Otomatis', color: 'Merah',
    nopol: 'B 3421 KQA',
    purchaseCost: 7150000, purchaseDate: '2026-06-02',
    bpkbDays: 21, bpkbStart: '2026-06-02',
    repairCosts: [
      mkCost('cost-1', 'Servis besar + ganti oli, filter, busi', 385000, '2026-06-03'),
      mkCost('cost-2', 'Ganti kampas rem depan & belakang', 175000, '2026-06-03')
    ],
    docCosts: [
      mkCost('cost-3', 'Balik nama (BBN) Samsat', 400000, '2026-06-05'),
      mkCost('cost-4', 'Cek pajak & administrasi STNK', 100000, '2026-06-05')
    ],
    sellPrice: 9350000, status: 'tersedia', notes: 'Kondisi mulus, plat genap.',
    createdAt: '2026-06-02T03:00:00.000Z'
  },
  {
    id: 'unit-2', code: 'UM-0002',
    name: 'Yamaha NMAX 155 Connected ABS', brand: 'Yamaha', type: 'Skutik',
    year: 2021, km: 9870, cc: 155, transmisi: 'Otomatis', color: 'Biru',
    nopol: 'B 5678 XYZ',
    purchaseCost: 18500000, purchaseDate: '2026-05-12',
    bpkbDays: 14, bpkbStart: '2026-05-12', bpkbReady: true, bpkbReadyAt: '2026-06-20',
    repairCosts: [
      mkCost('cost-5', 'Ganti ban belakang IRC NR53', 475000, '2026-05-14'),
      mkCost('cost-6', 'Ganti aki GS Astra 5Ah', 320000, '2026-05-14')
    ],
    docCosts: [mkCost('cost-7', 'Balik nama (BBN) Samsat', 450000, '2026-05-16')],
    sellPrice: 21500000, status: 'terjual', invoiceId: 'inv-1', soldAt: '2026-06-28',
    notes: 'Versi ABS connected, keyless.',
    createdAt: '2026-05-12T03:00:00.000Z'
  },
  {
    id: 'unit-3', code: 'UM-0003',
    name: 'Suzuki Satria F150', brand: 'Suzuki', type: 'Bebek Sport',
    year: 2016, km: 23450, cc: 150, transmisi: 'Manual 6', color: 'Hitam',
    nopol: 'B 4521 ABC',
    purchaseCost: 8600000, purchaseDate: '2026-04-18',
    repairCosts: [
      mkCost('cost-8', 'Overhaul mesin bagian atas', 1150000, '2026-04-22'),
      mkCost('cost-9', 'Cat & poles fairing body', 675000, '2026-04-25'),
      mkCost('cost-10', 'Ganti rantai-gir set', 420000, '2026-04-22')
    ],
    docCosts: [
      mkCost('cost-11', 'Perpanjangan STNK 5 tahun', 325000, '2026-04-28'),
      mkCost('cost-12', 'Balik nama (BBN) Samsat', 400000, '2026-04-28')
    ],
    sellPrice: 11900000, status: 'tersedia', notes: '',
    createdAt: '2026-04-18T03:00:00.000Z'
  }
];

units.push(
  {
    id: 'unit-4', code: 'UM-0004',
    name: 'Honda Vario 125 LED', brand: 'Honda', type: 'Skutik',
    year: 2023, km: 5120, cc: 125, transmisi: 'Otomatis', color: 'Merah Matte',
    nopol: 'B 9876 PQR',
    purchaseCost: 17400000, purchaseDate: '2026-07-01',
    bpkbDays: 14, bpkbStart: '2026-08-10',
    repairCosts: [],
    docCosts: [mkCost('cost-13', 'Balik nama (BBN) Samsat', 350000, '2026-07-03')],
    sellPrice: 19900000, status: 'booking', notes: 'DP diterima, menunggu pelunasan.',
    createdAt: '2026-07-01T03:00:00.000Z'
  },
  {
    id: 'unit-5', code: 'UM-0005',
    name: 'Kawasaki W175 SE', brand: 'Kawasaki', type: 'Retro Klasik',
    year: 2019, km: 18760, cc: 177, transmisi: 'Manual 5', color: 'Hijau',
    nopol: 'B 1122 DEF',
    purchaseCost: 13900000, purchaseDate: '2026-06-20',
    repairCosts: [
      mkCost('cost-14', 'Setel karburator + tune up', 225000, '2026-06-23'),
      mkCost('cost-15', 'Ganti spion set original', 145000, '2026-06-23')
    ],
    docCosts: [mkCost('cost-16', 'Cek Form A & fisik STNK', 75000, '2026-06-24')],
    sellPrice: 16250000, status: 'tersedia', notes: '',
    createdAt: '2026-06-20T03:00:00.000Z'
  },
  {
    id: 'unit-6', code: 'UM-0006',
    name: 'Honda CB150 Verza', brand: 'Honda', type: 'Sport',
    year: 2018, km: 31240, cc: 150, transmisi: 'Manual 6', color: 'Putih',
    nopol: 'B 7788 GHI',
    purchaseCost: 12100000, purchaseDate: '2026-03-15',
    bpkbDays: 21, bpkbStart: '2026-03-15', bpkbReady: true, bpkbReadyAt: '2026-04-08',
    repairCosts: [
      mkCost('cost-17', 'Ganti rantai-gir set', 395000, '2026-03-18'),
      mkCost('cost-18', 'Service mesin + ganti oli', 260000, '2026-03-18')
    ],
    docCosts: [
      mkCost('cost-19', 'Balik nama (BBN) Samsat', 350000, '2026-03-20'),
      mkCost('cost-20', 'Mutasi nama kendaraan', 275000, '2026-03-20')
    ],
    sellPrice: 14750000, status: 'terjual', invoiceId: 'inv-2', soldAt: '2026-05-09',
    notes: '', createdAt: '2026-03-15T03:00:00.000Z'
  }
);

const invoices = [
  {
    id: 'inv-1', number: 'INV/2026/06/0002', unitId: 'unit-2',
    customerId: 'cust-1',
    snapshot: { name: 'Yamaha NMAX 155 Connected ABS', brand: 'Yamaha', year: 2021, cc: 155, color: 'Biru', nopol: 'B 5678 XYZ' },
    buyer: { name: 'Hendra Wijaya', phone: '0812-3344-5566', address: 'Jl. Kenanga No. 21, Depok' },
    sellPrice: 21500000, discount: 0, total: 21500000,
    paymentMethod: 'transfer', date: '2026-06-28', note: '',
    createdBy: 'Rina Amelia (Sales)', createdAt: '2026-06-28T06:30:00.000Z'
  },
  {
    id: 'inv-2', number: 'INV/2026/05/0001', unitId: 'unit-6',
    customerId: 'cust-2',
    snapshot: { name: 'Honda CB150 Verza', brand: 'Honda', year: 2018, cc: 150, color: 'Putih', nopol: 'B 7788 GHI' },
    buyer: { name: 'Agus Salim', phone: '0857-1122-3344', address: 'Jl. Melati Raya No. 9, Bekasi' },
    sellPrice: 14750000, discount: 250000, total: 14500000,
    paymentMethod: 'tunai', date: '2026-05-09', note: 'Promo akhir bulan.',
    createdBy: 'Rina Amelia (Sales)', createdAt: '2026-05-09T04:15:00.000Z'
  }
];

const bastds = [{
  id: 'bastd-1', number: 'BASTD/2026/07/0001', date: '2026-07-01',
  unitId: 'unit-2', customerId: 'cust-1',
  type: ['stnk', 'bpkb'],
  items: [
    { key: 'stnk', number: 'D 5678 XYZ · masa 06-2027' },
    { key: 'bpkb', number: 'BPKB B 05678 XYZ · hal 1-4' }
  ],
  snapshot: {
    unitCode: 'UM-0002', unitName: 'Yamaha NMAX 155 Connected ABS', brand: 'Yamaha',
    year: 2021, color: 'Biru', nopol: 'B 5678 XYZ',
    noRangka: 'MHJXB53C0KA123456', noMesin: 'B5RE-9876543',
    buyerName: 'Hendra Wijaya', buyerPhone: '0812-3344-5566',
    buyerAddress: 'Jl. Kenanga No. 21, Depok'
  },
  note: '',
  createdBy: 'Rina Amelia (Sales)', createdById: 'user-3',
  createdAt: '2026-07-01T03:00:00.000Z'
}];

module.exports = { users, customers, units, invoices, bastds };

/* Enrichment: nomor rangka/mesin, jatuh tempo pajak & kelengkapan dokumen */
(function enrichUnits() {
  const meta = {
    'unit-1': ['MHLCXB210K9A01234', 'JC39E-1023456', '2026-09-10', true, true, false],
    'unit-2': ['MHJXB53C0KA123456', 'B5RE-9876543', '2027-01-20', true, true, true],
    'unit-3': ['MHCF1B1234K9081721', 'F115-4567890', '2026-11-05', true, false, false],
    'unit-4': ['MHJKVA52C0N0045678', 'K1ZT-1122334', '2027-02-15', true, true, false],
    'unit-5': ['JKARXA2310K7011223', 'EX300E-7788990', '2026-08-30', true, true, false],
    'unit-6': ['MHCB150BK8J9988776', 'C150RU-5566778', '2026-12-12', true, true, true]
  };
  units.forEach((u) => {
    const m = meta[u.id];
    if (!m) return;
    u.noRangka = m[0]; u.noMesin = m[1]; u.pajakDue = m[2];
    u.docs = { stnk: !!m[3], faktur: !!m[4], formA: !!m[5] };
    u.photos = []; u.archived = false;
  });
  /* cicilan/riwayat pembayaran invoice */
  invoices[0].payments = [{ id: 'pay-1', date: '2026-06-28', amount: 21500000, method: 'transfer', note: 'Pelunasan penuh' }];
  invoices[1].payments = [
    { id: 'pay-2', date: '2026-05-09', amount: 5000000, method: 'tunai', note: 'Uang muka (DP)' },
    { id: 'pay-3', date: '2026-05-16', amount: 9500000, method: 'tunai', note: 'Pelunasan' }
  ];
})();