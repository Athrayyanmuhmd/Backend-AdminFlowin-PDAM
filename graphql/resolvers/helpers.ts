import jwt from 'jsonwebtoken';
import AdminAccount from '../../models/AdminAccount.js';
import Technician from '../../models/Technician.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import AksesLog from '../../models/AksesLog.js';
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

// ─── Akses Log & Anomaly Detection ───────────────────────────────────────────

/**
 * Catat setiap akses ke dokumen kredensial (NIK, KK, IMB, RAB, Survei).
 * Fire-and-forget — tidak menghambat response GraphQL jika gagal.
 * Setelah catat, jalankan cek anomali: jika admin yang sama akses >20 dokumen dalam 10 menit,
 * kirim notifikasi peringatan ke semua admin lain.
 */
export async function catatAksesLog({
  token,
  req,
  jenisDokumen,
  idPemilik,
  namaOperasi,
}: {
  token?: string;
  req?: any;
  jenisDokumen: string;
  idPemilik: string;
  namaOperasi: string;
}) {
  try {
    let namaAdmin = 'Tidak Diketahui';
    let idAdmin = 'unknown';

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        idAdmin = (decoded.id ?? decoded.userId ?? 'unknown').toString();
        const admin = await AdminAccount.findById(idAdmin, 'namaLengkap');
        if (admin) namaAdmin = admin.namaLengkap;
      } catch (_) {}
    }

    const ipAddress = req?.ip ?? req?.headers?.['x-forwarded-for'] ?? 'unknown';
    const userAgent = req?.headers?.['user-agent'] ?? null;

    await AksesLog.create({ idAdmin, namaAdmin, jenisDokumen, idPemilik, namaOperasi, ipAddress, userAgent });

    // Deteksi anomali: >20 akses dokumen dalam 10 menit oleh admin yang sama
    const batasWaktu = new Date(Date.now() - 10 * 60 * 1000);
    const jumlahAkses = await AksesLog.countDocuments({ idAdmin, createdAt: { $gte: batasWaktu } });
    if (jumlahAkses > 20) {
      // Hanya kirim notif sekali setiap 10 menit (cek apakah sudah ada notif yang sama)
      const sudahAda = await AuditLog.findOne({
        idAdmin,
        aksi: 'ANOMALY_ALERT',
        createdAt: { $gte: batasWaktu },
      });
      if (!sudahAda) {
        await AuditLog.create({
          idAdmin,
          namaAdmin,
          aksi: 'ANOMALY_ALERT',
          resource: 'DOKUMEN_KREDENSIAL',
          catatan: `Akses tidak biasa: ${jumlahAkses} dokumen diakses dalam 10 menit terakhir dari IP ${ipAddress}`,
        });
        await notifikasiSemuaAdmin(
          '⚠️ Peringatan Keamanan: Akses Dokumen Tidak Normal',
          `Admin "${namaAdmin}" mengakses ${jumlahAkses} dokumen kredensial dalam 10 menit terakhir (IP: ${ipAddress}). Harap verifikasi.`,
          'PERINGATAN',
          '/system/audit-logs',
        );
        logger.warn({ idAdmin, namaAdmin, jumlahAkses, ipAddress }, 'ANOMALY: akses dokumen berlebihan terdeteksi');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Gagal mencatat akses log');
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
