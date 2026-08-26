/* ============================================================
   NuMo Showroom — Persistensi JSON sederhana (tanpa deps)
   Data disimpan di showroom-motor/data/db.json
============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 hari

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!cache || !Array.isArray(cache.units) || !Array.isArray(cache.users)) throw new Error('format tidak dikenal');
    console.log('[db] Memuat ' + cache.units.length + ' unit, ' +
      (cache.invoices || []).length + ' invoice, ' + cache.users.length + ' user dari db.json');
  } catch (e) {
    const seed = require('./seed-data');
    cache = {
      users: seed.users,
      units: seed.units,
      invoices: seed.invoices,
      sessions: {},
      seq: { user: 5, unit: 7, inv: 3, cost: 21 }
    };
    save();
    console.log('[db] db.json belum ada — dibuat dari seed (' + cache.units.length + ' unit, ' + cache.users.length + ' user)');
  }
  if (!cache.seq) cache.seq = { user: 1, unit: 1, inv: 1, cost: 1 };
  if (!cache.sessions) cache.sessions = {};
  if (!Array.isArray(cache.invoices)) cache.invoices = [];

  /* bersihkan sesi kadaluarsa */
  const now = Date.now();
  let pruned = 0;
  for (const k of Object.keys(cache.sessions)) {
    const s = cache.sessions[k];
    if (!s || now - new Date(s.createdAt).getTime() > SESSION_TTL) { delete cache.sessions[k]; pruned++; }
  }
  if (pruned) { save(); console.log('[db] ' + pruned + ' sesi kadaluarsa dihapus'); }
  return cache;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

/* ID berurutan per jenis: nextId('unit','unit') -> 'unit-8' */
function nextId(kind, prefix) {
  const d = load();
  const n = d.seq[kind] ? d.seq[kind]++ : (d.seq[kind] = 1);
  return prefix + '-' + n;
}

module.exports = { load, save, nextId, SESSION_TTL };