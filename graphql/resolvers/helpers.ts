import jwt from 'jsonwebtoken';
import AdminAccount from '../../models/AdminAccount.js';
import Technician from '../../models/Technician.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import logger from '../../utils/logger.js';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function verifyAdminToken(token: string | undefined): Record<string, any> {
  if (!token) throw new Error('Token tidak ditemukan. Silakan login terlebih dahulu.');
  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    throw new Error(isExpired ? 'Token sudah kadaluarsa. Silakan login ulang.' : 'Token tidak valid.');
  }
  // Role check — dua format token yang beredar:
  // Format baru (GraphQL login + REST login yang sudah dipatch): { id, role: 'admin'|'technician', email }
  // Format lama (REST login sebelum patch):                      { userId, email } — tanpa role, tanpa id
  // Token Ahmad (pelanggan):                                     { userId, email } — tapi disimpan di sistem berbeda
  //
  // Strategi: terima jika role eksplisit admin/teknisi, ATAU jika ada userId/id (legacy admin).
  // Token user Ahmad tidak harusnya sampai di sini karena dikirim ke backend Ahmad (port 3001), bukan admin (5000).
  const hasValidRole = decoded.role === 'admin' || decoded.role === 'technician';
  const hasId = !!(decoded.id || decoded.userId); // legacy REST token pakai userId, bukan id
  if (!hasValidRole && !hasId) {
    throw new Error('Akses ditolak: token tidak memiliki hak akses admin.');
  }
  return decoded;
}

/** Verifikasi token dan pastikan hanya role 'admin' (bukan teknisi). */
export function verifyAdminOnlyToken(token: string | undefined): Record<string, any> {
  const decoded = verifyAdminToken(token);
  if (decoded.role === 'technician') {
    throw new Error('Akses ditolak: hanya administrator yang dapat melakukan operasi ini.');
  }
  return decoded;
}

/** Extract ID dari token — handle format baru (id) dan lama (userId). */
export function extractTokenId(decoded: Record<string, any>): string | null {
  return decoded.id?.toString() ?? decoded.userId?.toString() ?? null;
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
        idAdmin = decoded.id ?? decoded.userId; // handle REST token lama (userId)
        const admin = await AdminAccount.findById(idAdmin, 'namaLengkap');
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
      IdAdmin: admin._id,
      Judul: judul,
      Pesan: pesan,
      Kategori: kategori,
      Link: link,
      isRead: false,
    }));
    if (notifs.length > 0) await Notification.insertMany(notifs);
  } catch (err) {
    logger.error({ err }, 'Gagal kirim notifikasi admin');
  }
}

// Kirim notifikasi ke pelanggan (user Ahmad) — menulis ke koleksi notifikasis
// yang dibaca Ahmad via query { IdPelanggan: userId }
// Kategori harus 'INFORMASI' atau 'PEMBAYARAN' (sesuai enum Ahmad)
export async function notifikasiUntukPelanggan(
  idPelanggan: string,
  judul: string,
  pesan: string,
  kategori: 'INFORMASI' | 'PEMBAYARAN' = 'INFORMASI',
  link: string | null = null,
) {
  try {
    await Notification.create({
      IdPelanggan: idPelanggan,
      Judul: judul,
      Pesan: pesan,
      Kategori: kategori,
      Link: link,
      isRead: false,
    });
  } catch (err) {
    logger.error({ err }, 'Gagal kirim notifikasi pelanggan');
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
