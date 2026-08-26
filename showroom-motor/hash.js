/* ============================================================
   NuMo Showroom — Utilitas hash password (tanpa dependensi)
   Menggunakan crypto.scryptSync + salt acak per user
============================================================ */
'use strict';

const crypto = require('crypto');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(12).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    const cand = crypto.scryptSync(String(password), salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(cand), Buffer.from(hash));
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };