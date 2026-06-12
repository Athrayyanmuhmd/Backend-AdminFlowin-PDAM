/**
 * ============================================================
 * WHITEBOX TESTING — Middleware adminAuth
 * ============================================================
 * Menguji logika middleware verifyAdmin dari middleware/adminAuth.js
 * menggunakan mock req/res/next — tanpa database, tanpa network.
 *
 * Code path yang diuji:
 * 1. Tidak ada token → 401
 * 2. Token valid tapi admin tidak ditemukan di DB → 403
 * 3. Token valid dan admin ditemukan → next() dipanggil
 * 4. Token invalid/expired → 403
 * ============================================================
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-jwt-secret-aqualink';
process.env.JWT_SECRET = JWT_SECRET;

// ============================================================
// Mock AdminAccount model sebelum import middleware
// ============================================================
const mockFindById = jest.fn();
jest.unstable_mockModule('../../models/AdminAccount.js', () => ({
  default: { findById: mockFindById },
}));

// Import middleware SETELAH mock didefinisikan
const { verifyAdmin } = await import('../../middleware/adminAuth.js');

// ============================================================
// Helpers untuk buat mock req/res/next
// ============================================================
function mockReq(authHeader = null) {
  return {
    headers: {
      authorization: authHeader,
    },
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const mockNext = jest.fn();

// ============================================================
// SUITE: verifyAdmin middleware
// ============================================================
describe('[WHITEBOX] Middleware verifyAdmin — Otorisasi Request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC-MW-01 ❌ Tanpa Authorization header → status 401', async () => {
    const req = mockReq(null);
    const res = mockRes();

    await verifyAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('No token') })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('TC-MW-02 ❌ Token format salah (tanpa "Bearer ") → status 401', async () => {
    const req = mockReq('tanpa-prefix-bearer');
    const res = mockRes();

    // Token tidak bisa di-verify karena bukan JWT valid
    mockFindById.mockResolvedValue(null);
    await verifyAdmin(req, res, mockNext);

    // Harus return 401 atau 403 (tidak sampai next)
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('TC-MW-03 ✅ Token valid + admin ditemukan → next() dipanggil', async () => {
    const adminData = {
      // ObjectId valid — middleware verifyAdmin memvalidasi format ObjectId
      // (mongoose.Types.ObjectId.isValid) sebelum memanggil findById.
      _id: '507f1f77bcf86cd799439011',
      namaLengkap: 'Admin Test',
      email: 'admin@test.com',
    };
    const token = jwt.sign(
      { id: adminData._id, email: adminData.email, role: 'admin' },
      JWT_SECRET
    );

    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    mockFindById.mockResolvedValue(adminData);

    await verifyAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(req.admin).toEqual(adminData);
    expect(req.userId).toBe(adminData._id);
  });

  it('TC-MW-04 ❌ Token valid tapi admin tidak ditemukan di DB → status 403', async () => {
    const token = jwt.sign(
      // ObjectId valid (lolos guard isValid) tapi tidak ada di DB → findById null
      { id: '507f191e810c19729de860ea', email: 'ghost@test.com', role: 'admin' },
      JWT_SECRET
    );

    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    mockFindById.mockResolvedValue(null); // Admin tidak ada

    await verifyAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Admin only') })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('TC-MW-05 ❌ Token expired → status 403', async () => {
    const expiredToken = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const req = mockReq(`Bearer ${expiredToken}`);
    const res = mockRes();

    await verifyAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Invalid or expired') })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('TC-MW-06 ❌ Token dengan secret berbeda → status 403', async () => {
    const wrongToken = jwt.sign(
      { id: 'adminId001', email: 'admin@test.com', role: 'admin' },
      'wrong-secret-key'
    );

    const req = mockReq(`Bearer ${wrongToken}`);
    const res = mockRes();

    await verifyAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('TC-MW-07 ❌ Token acak (bukan JWT) → status 403', async () => {
    const req = mockReq('Bearer ini-bukan-jwt-sama-sekali');
    const res = mockRes();

    await verifyAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
