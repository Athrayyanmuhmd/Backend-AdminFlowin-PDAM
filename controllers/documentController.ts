import { Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import AksesLog from '../models/AksesLog.js';
import logger from '../utils/logger.js';
import { generateFingerprintHash, applyCanary, decodeCanary } from '../utils/canary.js';
import cloudinaryV2 from '../utils/cloudinary.js';

// ─── Feature Flags ────────────────────────────────────────────────────────────
const PROXY_ENABLED   = () => process.env.PROXY_DOCUMENT_ENABLED  !== 'false';
const CANARY_ENABLED  = () => process.env.CANARY_DOCUMENT_ENABLED !== 'false';

// ─── Cloudinary URL Helper ────────────────────────────────────────────────────

/**
 * Untuk URL Cloudinary /raw/upload/ (PDF lama), generate signed URL via SDK
 * agar bisa diakses tanpa bergantung pada access_mode di akun Cloudinary.
 * URL /image/upload/ dikembalikan apa adanya (sudah publik by default).
 */
function resolveCloudinaryFetchUrl(storedUrl: string): string {
  if (!storedUrl.includes('/raw/upload/')) return storedUrl;

  // Pisahkan public_id (tanpa ekstensi) dan format dari URL raw
  // Cloudinary menyimpan public_id TANPA ekstensi; ekstensi = format terpisah
  // Contoh URL: .../raw/upload/v123/aqualink/dokumen-pengajuan/abc123.pdf
  //   → publicId = "aqualink/dokumen-pengajuan/abc123", format = "pdf"
  const match = storedUrl.match(/\/raw\/upload\/(?:v\d+\/)?(.+?)\.([a-zA-Z0-9]+)$/);
  if (!match) return storedUrl;

  const publicId = match[1]; // tanpa ekstensi
  const format   = match[2]; // ekstensi (pdf, jpg, dll)
  try {
    return cloudinaryV2.url(publicId, {
      resource_type: 'raw',
      type: 'upload',
      format,
      sign_url: true,
      secure: true,
    });
  } catch {
    return storedUrl;
  }
}

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
  // Prioritas 1: IP asli dari Next.js relay (dari header X-Real-IP)
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp.split(',')[0].trim();
  // Prioritas 2: dari reverse proxy standar
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  // Fallback: direct connection
  return req.ip ?? 'unknown';
}

/** Ambil User-Agent asli dari browser admin (dikirim via header X-Client-User-Agent dari Next.js relay). */
function getClientUserAgent(req: Request): string {
  const ua = req.headers['x-client-user-agent'];
  return typeof ua === 'string' ? ua : (req.headers['user-agent'] ?? null);
}

function detectMimetype(url: string, headers: Record<string, string>): string {
  const ct = headers['content-type'] ?? '';
  if (ct.includes('pdf') || url.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'image/jpeg';
  if (ct.includes('png')) return 'image/png';
  return ct || 'application/octet-stream';
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
      namaOperasi:     'DOCUMENT_PROXY',
      ipAddress:       getClientIp(params.req),
      userAgent:       getClientUserAgent(params.req),
      fingerprintHash: params.fingerprintHash,
      urlDokumen:      params.urlDokumen,
    });
  } catch (err) {
    // Log error tetapi jangan gagalkan request utama
    logger.warn({ err }, 'Gagal menyimpan AksesLog dokumen');
  }
}

// ─── Endpoint: View Document ──────────────────────────────────────────────────

/**
 * GET /documents/view?url=<cloudinaryUrl>&docType=<type>&ownerId=<id>
 *
 * Feature flags:
 *   PROXY_DOCUMENT_ENABLED=false  → redirect langsung ke Cloudinary URL (bypass proxy)
 *   CANARY_DOCUMENT_ENABLED=false → proxy aktif, tapi tanpa fingerprint (log tetap jalan)
 *
 * Alur normal:
 *   1. Verifikasi JWT admin (dilakukan di middleware sebelum controller ini)
 *   2. Fetch file dari Cloudinary
 *   3. Generate fingerprint hash unik per admin per akses
 *   4. Sisipkan canary ke dalam file
 *   5. Simpan ke AksesLog
 *   6. Stream file ke client
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

  // Feature flag: proxy dimatikan → redirect langsung
  if (!PROXY_ENABLED()) {
    res.redirect(302, url);
    return;
  }

  const { id: adminId, nama: namaAdmin } = getAdminFromReq(req);

  try {
    // Fetch file dari Cloudinary sebagai buffer.
    // Raw URLs (/raw/upload/) di-sign dulu agar reliabel di semua konfigurasi Cloudinary.
    const fetchUrl = resolveCloudinaryFetchUrl(url);
    const response = await axios.get<Buffer>(fetchUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    });

    const rawBuffer: Buffer = Buffer.from(new Uint8Array(response.data));
    const mimetype  = detectMimetype(url, response.headers as Record<string, string>);

    // Canary: generate fingerprint dan sisipkan ke file
    let fingerprintHash: string | null = null;
    let fileBuffer: Buffer = rawBuffer;

    if (CANARY_ENABLED()) {
      fingerprintHash = generateFingerprintHash(adminId, url);
      try {
        fileBuffer = Buffer.from(await applyCanary(rawBuffer, mimetype, fingerprintHash));
      } catch (canaryErr) {
        // Canary gagal → tetap sajikan file asli, jangan gagalkan request
        logger.warn({ err: canaryErr }, 'Canary encoding gagal, melayani file asli');
        fileBuffer = rawBuffer;
        fingerprintHash = null;
      }
    }

    // Log akses (fire-and-forget — tidak blokir response)
    logAccess({ req, adminId, namaAdmin, jenisDokumen: docType, idPemilik: ownerId, urlDokumen: url, fingerprintHash });

    // Stream ke client
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(fileBuffer);

  } catch (err: any) {
    const axiosStatus = err.response?.status;
    const axiosCode   = err.code ?? '';
    logger.error({ err, url, axiosStatus, axiosCode }, 'Error saat proxy dokumen');

    if (axiosStatus === 404) {
      res.status(404).json({ status: 404, pesan: 'Dokumen tidak ditemukan di Cloudinary.', url });
    } else if (axiosStatus === 403) {
      res.status(403).json({ status: 403, pesan: 'Akses ke Cloudinary ditolak (403). File mungkin private.', url });
    } else {
      res.status(500).json({
        status: 500,
        pesan: 'Gagal mengambil dokumen.',
        detail: err?.message ?? String(err),
        code: axiosCode,
        cloudinaryStatus: axiosStatus ?? null,
      });
    }
  }
};

// ─── Endpoint: Investigate (Fase 5) ──────────────────────────────────────────

// Multer: hanya terima file di memory, max 10MB
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
 * Body: multipart/form-data { file: <pdf atau gambar yang dicurigai bocor> }
 *
 * Response:
 *   - Jika fingerprint ditemukan dan ada di AksesLog → return info admin yang bocorkan
 *   - Jika fingerprint ditemukan tapi tidak di log → hash ada tapi log hilang/di-manipulasi
 *   - Jika tidak ada fingerprint → bukan file dari sistem kita
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

    // Cari di AksesLog
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
