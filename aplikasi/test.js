/* ============================================================
   NuMotorindo Finance — Unit Test (tanpa dependensi)
   Jalankan:  node test.js
============================================================ */
'use strict';

const assert = require('assert');
const { totalsOf, validateSale, validateUser, validateOpex } = require('./api');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, 'GAGAL: ' + label);
  passed += 1;
  console.log('  ✔ ' + label);
}

console.log('Test totalsOf — kalkulasi modal & laba:');
const u = {
  purchase: { price: 24500000 },
  repairs: [{ cost: 450000 }, { cost: 320000 }],
  documents: [{ cost: 750000 }],
  sale: { price: 28500000 }
};
const t = totalsOf(u);
ok(t.purchase === 24500000, 'pembelian terbaca');
ok(t.repair === 770000, 'total perbaikan = 770.000');
ok(t.doc === 750000, 'total dokumen = 750.000');
ok(t.modal === 26020000, 'total modal = 26.020.000');
ok(t.profit === 2480000, 'laba = 2.480.000');

console.log('Test totalsOf — unit belum terjual:');
ok(totalsOf({ purchase: { price: 1000000 } }).profit === null, 'profit null bila belum dijual');

console.log('Test validateSale:');
ok(validateSale({ price: 0, buyerName: 'Budi Santoso' }, false).ok === false, 'tolak harga jual 0');
ok(validateSale({ price: 5000000, buyerName: 'AB' }, false).ok === false, 'tolak nama pembeli <3 karakter');
ok(validateSale({ price: 5000000, buyerName: 'Budi', payment: 'barter' }, false).ok === false, 'tolak metode tak dikenal');
const kredit = validateSale({
  price: 20000000, buyerName: 'Rina Wulandari', payment: 'kredit',
  dp: 8000000, leasing: 'BAF', tenor: 12, installment: 1100000, installmentsPaid: 3
}, false);
ok(kredit.ok && kredit.value.tenor === 12 && kredit.value.installmentsPaid === 3,
  'kredit lengkap diterima (tenor & angsuran dibayar)');
const cash = validateSale({ price: 20000000, buyerName: 'Budi Santoso' }, false);
ok(cash.value.installmentsPaid === 0 && cash.value.dp === null, 'cash default tanpa DP/kolektibilitas');

console.log('Test validateUser:');
ok(validateUser({ username: 'AB', name: 'Budi', role: 'staff', password: '123456' }, false).ok === false,
  'tolak username <3 karakter');
ok(validateUser({ username: 'budi.s', name: 'Budi', role: 'staff', password: '123' }, false).ok === false,
  'tolak password <6 karakter');
ok(validateUser({ username: 'budi.s', name: 'Budi Santoso', role: 'bos', password: '123456' }, false).ok === false,
  'tolak peran tidak dikenal');
const good = validateUser({ username: 'budi.s', name: 'Budi Santoso', role: 'admin', password: 'rahasia' }, false);
ok(good.ok && /^[a-f0-9]{128}$/.test(good.value.hash) && good.value.salt.length === 32,
  'hash scrypt 64 byte + salt tersimpan');

console.log('Test validateOpex:');
ok(validateOpex({ category: 'bonus', desc: 'X', amount: -5 }).ok === false, 'tolak kategori/nominal salah');
const op = validateOpex({ category: 'sewa', desc: 'Sewa tempat September', amount: 3500000 });
ok(op.ok && op.amount === undefined && op.value.amount === 3500000, 'OPEX valid diterima');

console.log('\n✅ Semua unit test lulus (' + passed + ' assertion).');