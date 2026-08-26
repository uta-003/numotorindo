/* ============================================================
   Seed awal backend — identik dengan data demo frontend
   (frontend/js/data.js) supaya katalog langsung terisi.
============================================================ */
'use strict';

module.exports = {
  bikes: [
    { id: 'vario160', name: 'Honda Vario 160 ABS', brand: 'Honda', type: 'matic', typeName: 'Skutik',
      year: 2023, km: 8400, cc: 160, trans: 'CVT', price: 27500000, oldPrice: 29500000,
      cond: 'like-new', color: 'Hitam Doff', img: 'assets/img/moto-matic.svg',
      desc: 'Vario 160 ABS 2023 like new! Service record resmi AHASS lengkap, plat D Jakarta, satu tangan. Siap pakai tanpa catatan bodi.' },

    { id: 'aerox155', name: 'Yamaha Aerox 155 Connected', brand: 'Yamaha', type: 'matic', typeName: 'Skutik',
      year: 2022, km: 14200, cc: 155, trans: 'CVT', price: 26800000, oldPrice: null,
      cond: 'bagus', color: 'Biru Racing', img: 'assets/img/moto-matic.svg',
      desc: 'Aerox 155 Connected kondisi cakep, mesin standar pabrik, ban Pirelli baru ganti 500 km lalu. Cocok buat daily maupun road trip.' },

    { id: 'beatstreet', name: 'Honda Beat Street ESP', brand: 'Honda', type: 'matic', typeName: 'Skutik',
      year: 2021, km: 18600, cc: 110, trans: 'CVT', price: 17900000, oldPrice: 19000000,
      cond: 'muluz', color: 'Merah Hitam', img: 'assets/img/moto-matic.svg',
      desc: 'Beat Street 2021 mulus, hemat bensin juara, ideal buat anak kos & pekerja kantoran. Dokumen lengkap atas nama sendiri.' },

    { id: 'pcx160', name: 'Honda PCX 160 ABS', brand: 'Honda', type: 'matic', typeName: 'Skutik',
      year: 2023, km: 11300, cc: 157, trans: 'CVT', price: 33900000, oldPrice: null,
      cond: 'like-new', color: 'Radiant White', img: 'assets/img/moto-matic.svg',
      desc: 'PCX 160 ABS 2023, komuter premium. Kondisi like new, masih panas garansi resmi Astra Honda Motor.' },

    { id: 'cbr150r', name: 'Honda CBR150R ABS', brand: 'Honda', type: 'sport', typeName: 'Sport',
      year: 2022, km: 9800, cc: 149, trans: 'Manual (6)', price: 33500000, oldPrice: 35500000,
      cond: 'like-new', color: 'Mat Cannon Black', img: 'assets/img/moto-sport.svg',
      desc: 'CBR150R ABS facelift, jarang pakai karena garasi privat. Knalpot standar masih utuh, ban Michelin sisa 80%.' },

    { id: 'r15', name: 'Yamaha R15 Connected', brand: 'Yamaha', type: 'sport', typeName: 'Sport',
      year: 2023, km: 6500, cc: 155, trans: 'Manual (6)', price: 36900000, oldPrice: null,
      cond: 'like-new', color: 'Cyber Camo Green', img: 'assets/img/moto-sport.svg',
      desc: 'R15 Connected 2023 full ori belum disentuh, servis rutin Yamaha. Like new abis. Bonus cover body & sarung jok.' },

    { id: 'mt15', name: 'Yamaha MT-15', brand: 'Yamaha', type: 'sport', typeName: 'Sport Naked',
      year: 2021, km: 16300, cc: 155, trans: 'Manual (6)', price: 30200000, oldPrice: null,
      cond: 'bagus', color: 'Midnight Fluo', img: 'assets/img/moto-sport.svg',
      desc: 'MT-15 2021 si dark rider favorite. Mesin sehat, oli rutin ganti tiap 2.000 km. Siap gas ke Bromo besok pagi.' },

    { id: 'ninja250', name: 'Kawasaki Ninja 250 FI', brand: 'Kawasaki', type: 'sport', typeName: 'Sport',
      year: 2019, km: 21400, cc: 249, trans: 'Manual (6)', price: 42500000, oldPrice: null,
      cond: 'bagus', color: 'Lime Green', img: 'assets/img/moto-sport.svg',
      desc: 'Ninja 250 FI twin cylinder, suara standar merdu. Tool kit & buku servis lengkap semua. Rangka mulus, tidak pernah jatuh.' },

    { id: 'satriafu', name: 'Suzuki Satria FU 150', brand: 'Suzuki', type: 'bebek', typeName: 'Bebek Sport',
      year: 2020, km: 12700, cc: 147, trans: 'Manual (6)', price: 24800000, oldPrice: null,
      cond: 'bagus', color: 'Hitam Silver', img: 'assets/img/moto-bebek.svg',
      desc: 'Satria FU 150 2020 rajin servis, blok masih standar. Buat kamu yang cari bebek ngebut legal — ini jawabannya.' },

    { id: 'supragtr', name: 'Honda Supra GTR 150', brand: 'Honda', type: 'bebek', typeName: 'Bebek Sport',
      year: 2019, km: 23100, cc: 150, trans: 'Manual (6)', price: 21500000, oldPrice: 23000000,
      cond: 'muluz', color: 'Merah Hitam', img: 'assets/img/moto-bebek.svg',
      desc: 'Supra GTR 150 kondisi mulus, nyaman untuk harian jarak jauh. Shockbreaker depan & aki baru ganti.' },

    { id: 'w175', name: 'Kawasaki W175 SE', brand: 'Kawasaki', type: 'retro', typeName: 'Retro Klasik',
      year: 2022, km: 10900, cc: 177, trans: 'Manual (5)', price: 30900000, oldPrice: null,
      cond: 'like-new', color: 'Candy Emerald Blue', img: 'assets/img/moto-retro.svg',
      desc: 'W175 SE 2022 vibes retro-cafe racer, kilometer masih sedikit. Full standar, plat B baru, siap pakai.' },

    { id: 'xsr155', name: 'Yamaha XSR 155', brand: 'Yamaha', type: 'retro', typeName: 'Retro Klasik',
      year: 2023, km: 7800, cc: 155, trans: 'Manual (6)', price: 36500000, oldPrice: null,
      cond: 'like-new', color: 'Vintage White', img: 'assets/img/moto-retro.svg',
      desc: 'XSR 155 2023 styling klasik modern. Satu tangan, jarang dipakai, kondisinya seperti baru keluar dari dealer.' }
  ]
};