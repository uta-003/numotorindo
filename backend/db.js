/* ============================================================
   NuMotorindo Backend — Persistensi JSON sederhana (tanpa deps)
   Data disimpan di backend/data/db.json
============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!cache || !Array.isArray(cache.bikes)) throw new Error('format tidak dikenal');
    console.log('[db] Memuat ' + cache.bikes.length + ' motor & ' +
      (cache.sellRequests || []).length + ' permintaan jual dari db.json');
  } catch (e) {
    const seed = require('./seed-data');
    cache = {
      bikes: seed.bikes,
      sellRequests: [],
      seq: { bike: seed.bikes.length + 1, sr: 1 }
    };
    save();
    console.log('[db] db.json belum ada — dibuat dari seed (' + cache.bikes.length + ' motor)');
  }
  if (!cache.seq) cache.seq = { bike: 1000, sr: 1 };
  return cache;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

function nextId(kind) {
  const data = load();
  const n = data.seq[kind] ? data.seq[kind]++ : (data.seq[kind] = 1);
  return kind === 'bike' ? 'bike-' + n : 'req-' + n;
}

module.exports = { load, save, nextId };