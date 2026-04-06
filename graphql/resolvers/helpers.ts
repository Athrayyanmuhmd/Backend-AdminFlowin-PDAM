import jwt from 'jsonwebtoken';
import AdminAccount from '../../models/AdminAccount.js';
import Technician from '../../models/Technician.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import logger from '../../utils/logger.js';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function verifyAdminToken(token: string | undefined) {
  if (!token) throw new Error('Token tidak ditemukan. Silakan login terlebih dahulu.');
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string);
  } catch {
    throw new Error('Token tidak valid atau sudah kadaluarsa.');
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function catatAuditLog({
  token,
  aksi,
  resource,
  resourceId = null,
  nilaiBefore = null,
  nilaiAfter = null,
  catatan = null,
}: {
  token?: string;
  aksi: string;
  resource: string;
  resourceId?: any;
  nilaiBefore?: any;
  nilaiAfter?: any;
  catatan?: string | null;
}) {
  try {
    let namaAdmin = 'Sistem';
    let idAdmin = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        idAdmin = decoded.id;
        const admin = await AdminAccount.findById(decoded.id, 'namaLengkap');
        if (admin) namaAdmin = admin.namaLengkap;
      } catch (_) {}
    }
    await AuditLog.create({
      idAdmin,
      namaAdmin,
      aksi,
      resource,
      resourceId: resourceId ? String(resourceId) : null,
      nilaiBefore,
      nilaiAfter,
      catatan,
    });
  } catch (err) {
    logger.error({ err }, 'Gagal mencatat audit log');
  }
}

// ─── Notifikasi ───────────────────────────────────────────────────────────────

export async function notifikasiSemuaAdmin(
  judul: string,
  pesan: string,
  kategori: string,
  link: string | null = null,
) {
  try {
    const admins = await AdminAccount.find({}, '_id');
    const notifs = admins.map((admin) => ({
      idAdmin: admin._id,
      judul,
      pesan,
      kategori,
      link,
      isRead: false,
    }));
    if (notifs.length > 0) await Notification.insertMany(notifs);
  } catch (err) {
    logger.error({ err }, 'Gagal kirim notifikasi admin');
  }
}

// ─── Input Validation ─────────────────────────────────────────────────────────

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string) {
  if (!password || password.length < 8) throw new Error('Kata sandi minimal 8 karakter');
}

export function validatePhone(noHP: string | undefined) {
  if (noHP && !/^(\+62|62|0)[0-9]{8,13}$/.test(noHP.replace(/\s/g, '')))
    throw new Error('Format nomor HP tidak valid');
}
