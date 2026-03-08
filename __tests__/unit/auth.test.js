/**
 * ============================================================
 * WHITEBOX TESTING — Auth Logic (JWT & Bcrypt)
 * ============================================================
 * Menguji logika internal autentikasi yang digunakan oleh
 * resolver loginAdmin, loginTechnician, dan verifyAdminToken.
 *
 * Tidak memerlukan database — murni unit test.
 * ============================================================
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = 'test-jwt-secret-aqualink';
process.env.JWT_SECRET = JWT_SECRET;

// Replikasi logika verifyAdminToken dari resolvers/index.js (whitebox)
function verifyAdminToken(token) {
  if (!token) throw new Error('Token tidak ditemukan. Silakan login terlebih dahulu.');
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new Error('Token tidak valid atau sudah kadaluarsa.');
  }
}

// ============================================================
// SUITE 1: verifyAdminToken
// ============================================================
describe('[WHITEBOX] verifyAdminToken — Validasi Token JWT', () => {
  let tokenValid;
  let tokenExpired;
  let tokenWrongSecret;

  beforeAll(() => {
    tokenValid = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    tokenExpired = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    tokenWrongSecret = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      'wrong-secret-key'
    );
  });

  it('TC-AUTH-01 ✅ Token valid harus mengembalikan payload yang benar', () => {
    const decoded = verifyAdminToken(tokenValid);
    expect(decoded.id).toBe('adminId001');
    expect(decoded.email).toBe('admin@test.com');
    expect(decoded.role).toBe('admin');
  });

  it('TC-AUTH-02 ❌ Token null harus throw error "Token tidak ditemukan"', () => {
    expect(() => verifyAdminToken(null)).toThrow('Token tidak ditemukan');
  });

  it('TC-AUTH-03 ❌ Token string kosong harus throw error "Token tidak ditemukan"', () => {
    expect(() => verifyAdminToken('')).toThrow('Token tidak ditemukan');
  });

  it('TC-AUTH-04 ❌ Token undefined harus throw error "Token tidak ditemukan"', () => {
    expect(() => verifyAdminToken(undefined)).toThrow('Token tidak ditemukan');
  });

  it('TC-AUTH-05 ❌ Token string sembarang harus throw error "Token tidak valid"', () => {
    expect(() => verifyAdminToken('bukan.token.valid')).toThrow('Token tidak valid atau sudah kadaluarsa');
  });

  it('TC-AUTH-06 ❌ Token expired harus throw error "Token tidak valid"', () => {
    expect(() => verifyAdminToken(tokenExpired)).toThrow('Token tidak valid atau sudah kadaluarsa');
  });

  it('TC-AUTH-07 ❌ Token dari secret berbeda harus throw error "Token tidak valid"', () => {
    expect(() => verifyAdminToken(tokenWrongSecret)).toThrow('Token tidak valid atau sudah kadaluarsa');
  });
});

// ============================================================
// SUITE 2: JWT Token Structure (struktur token yang dibuat loginAdmin)
// ============================================================
describe('[WHITEBOX] JWT Token Structure — Struktur Token Admin', () => {
  it('TC-JWT-01 ✅ Token admin harus mengandung field id, email, role', () => {
    const token = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('email');
    expect(decoded).toHaveProperty('role');
  });

  it('TC-JWT-02 ✅ Token admin harus memiliki role "admin"', () => {
    const token = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('admin');
  });

  it('TC-JWT-03 ✅ Token teknisi harus memiliki role "teknisi"', () => {
    const token = jwt.sign(
      { id: 'techId001', email: 'tech@test.com', role: 'teknisi' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.role).toBe('teknisi');
  });

  it('TC-JWT-04 ✅ Token harus expire sesuai waktu yang ditentukan (30 hari)', () => {
    const token = jwt.sign({ id: 'x' }, JWT_SECRET, { expiresIn: '30d' });
    const decoded = jwt.decode(token);
    const expectedExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    // Toleransi 5 detik
    expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5);
    expect(decoded.exp).toBeLessThan(expectedExpiry + 5);
  });
});

// ============================================================
// SUITE 3: Bcrypt Password Hashing (digunakan loginAdmin)
// ============================================================
describe('[WHITEBOX] Bcrypt — Password Hashing & Comparison', () => {
  const plainPassword = 'admin123';
  let hashedPassword;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash(plainPassword, 10);
  });

  it('TC-BCR-01 ✅ bcrypt.compare harus true untuk password yang benar', async () => {
    const result = await bcrypt.compare(plainPassword, hashedPassword);
    expect(result).toBe(true);
  });

  it('TC-BCR-02 ❌ bcrypt.compare harus false untuk password yang salah', async () => {
    const result = await bcrypt.compare('passwordSalah', hashedPassword);
    expect(result).toBe(false);
  });

  it('TC-BCR-03 ❌ bcrypt.compare harus false untuk string kosong', async () => {
    const result = await bcrypt.compare('', hashedPassword);
    expect(result).toBe(false);
  });

  it('TC-BCR-04 ✅ Hash yang berbeda untuk password yang sama harus tetap valid', async () => {
    const hash1 = await bcrypt.hash(plainPassword, 10);
    const hash2 = await bcrypt.hash(plainPassword, 10);
    // Dua hash berbeda (salt berbeda)
    expect(hash1).not.toBe(hash2);
    // Tapi keduanya valid untuk password yang sama
    expect(await bcrypt.compare(plainPassword, hash1)).toBe(true);
    expect(await bcrypt.compare(plainPassword, hash2)).toBe(true);
  });

  it('TC-BCR-05 ✅ Hash password harus dimulai dengan prefix bcryptjs "$2a$" atau "$2b$"', async () => {
    // bcryptjs (pure JS) menghasilkan $2a$, bcrypt (C binding) menghasilkan $2b$ — keduanya valid
    expect(hashedPassword).toMatch(/^\$2[ab]\$/);
  });
});
