import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import AdminAccount from '../models/AdminAccount.js';
import Technician from '../models/Technician.js';

/**
 * Middleware: izinkan admin ATAU teknisi lokal.
 * Validasi: (1) JWT valid + belum expired, (2) role benar, (3) token masih aktif di DB (cek post-logout).
 *
 * Token payload: { id, email, role: 'admin' | 'technician' }
 */
export const verifyAdminOrTechnician = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ status: 401, message: 'Token tidak ditemukan, akses ditolak' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    res.status(401).json({
      status: 401,
      message: isExpired ? 'Token sudah kadaluarsa, silakan login ulang' : 'Token tidak valid',
    });
    return;
  }

  const role: string | undefined = decoded.role;
  // Handle dua format: REST token lama pakai `userId`, GraphQL/REST baru pakai `id`
  const id: string | undefined = decoded.id ?? decoded.userId;

  if (!id) {
    res.status(403).json({ status: 403, message: 'Token tidak valid: ID tidak ditemukan' });
    return;
  }

  // ─── Cek token masih aktif di DB (invalidasi setelah logout) ──────────────
  try {
    if (role === 'admin' || (!role && id)) {
      // Admin atau legacy token (tanpa role field)
      const admin = await AdminAccount.findOne({ _id: id, token }).select('_id').lean();
      if (!admin) {
        res.status(401).json({ status: 401, message: 'Sesi tidak valid atau sudah logout. Silakan login ulang.' });
        return;
      }
      req.userId = id;
      req.userEmail = decoded.email;
      req.userRole = 'admin';
      next();
      return;
    }

    if (role === 'technician') {
      const teknisi = await Technician.findOne({ _id: id, token }).select('_id').lean();
      if (!teknisi) {
        res.status(401).json({ status: 401, message: 'Sesi tidak valid atau sudah logout. Silakan login ulang.' });
        return;
      }
      req.technicianId = id;
      req.userEmail = decoded.email;
      req.userRole = 'technician';
      next();
      return;
    }
  } catch (dbErr: any) {
    // Jika DB tidak tersedia, fallback ke JWT-only (graceful degrade)
    console.error('[adminOrTechnicianAuth] DB check error, fallback ke JWT-only:', dbErr.message);
    req.userId = id;
    req.userEmail = decoded.email;
    req.userRole = role === 'technician' ? 'technician' : 'admin';
    next();
    return;
  }

  res.status(403).json({ status: 403, message: 'Akses ditolak: token bukan admin atau teknisi' });
};

/**
 * Middleware: hanya admin (role === 'admin'), dengan DB token check.
 */
export const verifyAdminOnly = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ status: 401, message: 'Token tidak ditemukan, akses ditolak' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    res.status(401).json({
      status: 401,
      message: isExpired ? 'Token sudah kadaluarsa, silakan login ulang' : 'Token tidak valid',
    });
    return;
  }

  const role: string | undefined = decoded.role;
  const id: string | undefined = decoded.id ?? decoded.userId;

  if (role === 'technician') {
    res.status(403).json({ status: 403, message: 'Akses ditolak: hanya administrator' });
    return;
  }

  if (!id) {
    res.status(403).json({ status: 403, message: 'Token tidak valid: ID tidak ditemukan' });
    return;
  }

  try {
    const admin = await AdminAccount.findOne({ _id: id, token }).select('_id').lean();
    if (!admin) {
      res.status(401).json({ status: 401, message: 'Sesi tidak valid atau sudah logout. Silakan login ulang.' });
      return;
    }
  } catch (dbErr: any) {
    console.error('[verifyAdminOnly] DB check error, fallback ke JWT-only:', dbErr.message);
  }

  req.userId = id;
  req.userEmail = decoded.email;
  req.userRole = 'admin';
  next();
};
