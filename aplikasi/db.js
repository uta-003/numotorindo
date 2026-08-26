/* ============================================================
   NuMotorindo Finance — Persistensi JSON sederhana (tanpa deps)
   Data disimpan di aplikasi/data/db.json:
   { users, units, sessions, settings, seq }
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
    if (!cache || !Array.isArray(cache.units) || !Array.isArray(cache.users)) throw new Error('format tidak dikenal');
    console.log('[db] Memuat ' + cache.units.length + ' unit motor & ' + cache.users.length + ' pengguna dari db.json');
  } catch (e) {
    const seed = require('./seed-data');
    cache = {
      users: seed.users,
      units: seed.units,
      sessions: {},
      settings: seed.settings,
      opex: seed.opex || [],
      auditLog: [],
      seq: { unit: seed.units.length + 1, invoice: seed.nextInvoiceSeq }
    };
    save();
    console.log('[db] db.json belum ada — dibuat dari seed (' + cache.units.length + ' unit)');
  }
  if (!cache.sessions) cache.sessions = {};
  if (!cache.settings) cache.settings = {};
  if (!cache.opex) cache.opex = [];
  if (!cache.auditLog) cache.auditLog = [];
  if (!cache.seq) cache.seq = { unit: cache.units.length + 1, invoice: 1 };
  if (!cache.seq.user) cache.seq.user = cache.users.length + 1;
  if (!cache.seq.opex) cache.seq.opex = (cache.opex ? cache.opex.length : 0) + 1;
  return cache;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  /* cadangan harian otomatis: simpan salinan maksimal 7 hari terakhir */
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (cache && fs.existsSync(DB_PATH)) {
      const bdir = path.join(DATA_DIR, 'backups');
      fs.mkdirSync(bdir, { recursive: true });
      const bpath = path.join(bdir, 'db-' + today + '.json');
      if (!fs.existsSync(bpath)) {
        fs.copyFileSync(DB_PATH, bpath);
        const olds = fs.readdirSync(bdir)
          .filter((f) => f.startsWith('db-') && f.endsWith('.json'))
          .sort();
        while (olds.length > 7) fs.unlinkSync(path.join(bdir, olds.shift()));
      }
    }
  } catch (e) { console.error('[db] backup harian gagal:', e.message); }

  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

function nextId(kind) {
  const data = load();
  const n = data.seq[kind] ? data.seq[kind]++ : (data.seq[kind] = 1);
  return kind === 'unit' ? 'unit-' + n : kind + '-' + n;
}

/* Nomor invoice format INV-{YYMM}-{urut}, mis. INV-2608-004 */
function nextInvoiceNo() {
  const data = load();
  if (!data.seq.invoice) data.seq.invoice = 1;
  const n = data.seq.invoice++;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return 'INV-' + yy + mm + '-' + String(n).padStart(3, '0');
}

module.exports = { load, save, nextId, nextInvoiceNo };