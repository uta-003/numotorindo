/* ============================================================
   NuMo Showroom — Persistensi JSON sederhana (tanpa deps)
   Data disimpan di showroom-motor/data/db.json
============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 hari

let cache = null;

/* backup otomatis: maksimal 1x per 12 jam, simpan 14 terakhir */
function autoBackup() {
  try {
    const last = cache.lastBackupAt ? new Date(cache.lastBackupAt).getTime() : 0;
    if (Date.now() - last < 12 * 3600 * 1000) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, 'db-' + stamp + '.json'));
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort();
    while (files.length > 14) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    cache.lastBackupAt = new Date().toISOString();
    save();
    console.log('[db] Backup otomatis dibuat: db-' + stamp + '.json');
  } catch (e) {
    console.error('[db] Backup gagal:', e.message);
  }
}

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
      customers: seed.customers || [],
      units: seed.units,
      invoices: seed.invoices,
      bastds: seed.bastds || [],
      sessions: {},
      seq: { user: 5, unit: 7, inv: 3, cost: 21, bastd: 2 }
    };
    save();
    console.log('[db] db.json belum ada — dibuat dari seed (' + cache.units.length + ' unit, ' + cache.users.length + ' user)');
  }
  if (!cache.seq) cache.seq = { user: 1, unit: 1, inv: 1, cost: 1 };
  if (!cache.sessions) cache.sessions = {};
  if (!Array.isArray(cache.invoices)) cache.invoices = [];

  /* siapkan folder pendukung */
  try { fs.mkdirSync(PHOTOS_DIR, { recursive: true }); } catch (e) {}
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {}

  if (!cache.customers) cache.customers = [];
  if (!cache.logs) cache.logs = [];
  if (!cache.bastds) cache.bastds = [];
  if (cache.seq && !cache.seq.bastd) cache.seq.bastd = 1;
  autoBackup();

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

module.exports = { load, save, nextId, SESSION_TTL, PHOTOS_DIR };