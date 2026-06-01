import { Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import AksesLog from '../models/AksesLog.js';
import logger from '../utils/logger.js';
import { generateFingerprintHash, decodeCanary } from '../utils/canary.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAdminFromReq(req: Request): { id: string; nama: string } {
  const admin = (req as any).admin;
  const user  = (req as any).user;
  return {
    id:   (admin?._id ?? admin?.id ?? user?.id ?? 'unknown').toString(),
    nama: admin?.namaLengkap ?? user?.email ?? 'unknown',
  };
}

function getClientIp(req: Request): string {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp.split(',')[0].trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function getClientUserAgent(req: Request): string {
  const ua = req.headers['x-client-user-agent'];
  return typeof ua === 'string' ? ua : (req.headers['user-agent'] ?? null);
}

async function logAccess(params: {
  req: Request;
  adminId: string;
  namaAdmin: string;
  jenisDokumen: string;
  idPemilik: string;
  urlDokumen: string;
  fingerprintHash: string | null;
}): Promise<void> {
  try {
    await AksesLog.create({
      idAdmin:         params.adminId,
      namaAdmin:       params.namaAdmin,
      jenisDokumen:    params.jenisDokumen,
      idPemilik:       params.idPemilik,
      namaOperasi:     'DOCUMENT_ACCESS',
      ipAddress:       getClientIp(params.req),
      userAgent:       getClientUserAgent(params.req),
      fingerprintHash: params.fingerprintHash,
      urlDokumen:      params.urlDokumen,
    });
  } catch (err) {
    logger.warn({ err }, 'Gagal menyimpan AksesLog dokumen');
  }
}

// ─── Endpoint: View Document ──────────────────────────────────────────────────

function detectMimetype(url: string, headers: Record<string, string>): string {
  const ct = headers['content-type'] ?? '';
  if (ct.includes('pdf') || url.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'image/jpeg';
  if (ct.includes('png')) return 'image/png';
  return ct || 'application/octet-stream';
}

/**
 * GET /documents/view?url=<cloudinaryUrl>&docType=<type>&ownerId=<id>
 *
 * Log akses ke AksesLog, lalu stream file dari Cloudinary dengan
 * Content-Disposition: inline agar PDF tampil di iframe (tidak auto-download).
 * Jika fetch gagal (401/404), fallback redirect ke URL asli.
 */
export const viewDocument = async (req: Request, res: Response): Promise<void> => {
  const { url, docType = 'UNKNOWN', ownerId = 'unknown' } = req.query as Record<string, string>;

  if (!url) {
    res.status(400).json({ status: 400, pesan: 'Parameter url wajib diisi.' });
    return;
  }

  if (!url.includes('cloudinary.com')) {
    res.status(400).json({ status: 400, pesan: 'URL tidak valid — hanya Cloudinary yang diizinkan.' });
    return;
  }

  const { id: adminId, nama: namaAdmin } = getAdminFromReq(req);
  const fingerprintHash = generateFingerprintHash(adminId, url);

  // Log akses sebelum apapun — audit trail tetap utuh meski fetch gagal
  await logAccess({
    req,
    adminId,
    namaAdmin,
    jenisDokumen: docType,
    idPemilik: ownerId,
    urlDokumen: url,
    fingerprintHash,
  });

  try {
    // Stream-through proxy: ambil file lalu kirim dengan header inline
    const response = await axios.get<Buffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });

    const buffer = Buffer.from(new Uint8Array(response.data));
    const mimetype = detectMimetype(url, response.headers as Record<string, string>);

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
  } catch (err: any) {
    // Cloudinary tidak bisa diakses (401/404/network) → fallback redirect
    // Agar file tetap terbuka meski preview inline tidak bisa
    logger.warn(
      { url, status: err.response?.status, code: err.code },
      'Proxy fetch gagal, fallback redirect ke Cloudinary',
    );
    res.redirect(302, url);
  }
};

// ─── Endpoint: Investigate (Fase 5) ──────────────────────────────────────────

export const uploadForInvestigation = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  },
}).single('file');

/**
 * POST /documents/investigate
 * Investigasi file yang dicurigai bocor — cari fingerprint canary lama
 * (sisa dari era proxy aktif) di AksesLog.
 */
export const investigateDocument = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ status: 400, pesan: 'File wajib diunggah untuk investigasi.' });
    return;
  }

  try {
    const fingerprintHash = await decodeCanary(req.file.buffer);

    if (!fingerprintHash) {
      res.json({
        status: 'not_found',
        pesan: 'Tidak ada canary fingerprint di file ini. Kemungkinan bukan dokumen dari sistem Aqualink, atau file sudah dimodifikasi.',
        fingerprintHash: null,
        aksesLog: null,
      });
      return;
    }

    const log = await AksesLog.findOne({ fingerprintHash }).lean();

    if (!log) {
      res.json({
        status: 'hash_found_no_log',
        pesan: 'Fingerprint ditemukan di file, tapi tidak ada di AksesLog. Log mungkin telah dihapus atau dimanipulasi.',
        fingerprintHash,
        aksesLog: null,
      });
      return;
    }

    res.json({
      status: 'identified',
      pesan: `Dokumen ini pernah diakses oleh ${log.namaAdmin} dan kemungkinan adalah sumber kebocoran.`,
      fingerprintHash,
      aksesLog: {
        idAdmin:      log.idAdmin,
        namaAdmin:    log.namaAdmin,
        jenisDokumen: log.jenisDokumen,
        idPemilik:    log.idPemilik,
        ipAddress:    log.ipAddress,
        userAgent:    log.userAgent,
        waktuAkses:   log.createdAt,
        urlDokumen:   log.urlDokumen,
      },
    });

  } catch (err) {
    logger.error({ err }, 'Error saat investigasi canary');
    res.status(500).json({ status: 500, pesan: 'Gagal memproses file investigasi.' });
  }
};
