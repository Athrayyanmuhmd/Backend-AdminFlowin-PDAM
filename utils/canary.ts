import crypto from 'crypto';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';

const CANARY_SECRET = process.env.INTERNAL_API_SECRET ?? 'flowin-canary-secret';
const CANARY_PREFIX = 'flowin-canary:';
const CANARY_REGEX  = /flowin-canary:([a-f0-9]{64})/;

// ─── Hash ─────────────────────────────────────────────────────────────────────

/**
 * Generate fingerprint hash unik per admin per akses.
 * HMAC-SHA256(adminId + docUrl + timestamp) → 64 hex chars.
 * Hash ini disimpan di AksesLog DAN disisipkan ke dalam file.
 */
export function generateFingerprintHash(adminId: string, docUrl: string): string {
  const payload = `${adminId}:${docUrl}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
  return crypto.createHmac('sha256', CANARY_SECRET).update(payload).digest('hex');
}

// ─── PDF Canary ────────────────────────────────────────────────────────────────

/**
 * Sisipkan fingerprint ke dalam PDF menggunakan dua lapisan:
 * 1. Document keywords (mudah di-query, tapi bisa di-strip)
 * 2. Invisible white text di sudut kiri bawah setiap halaman (susah di-strip manual)
 */
export async function applyPdfCanary(pdfBuffer: Buffer, fingerprintHash: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const canaryPayload = `${CANARY_PREFIX}${fingerprintHash}`;

  // Lapisan 1: document keywords (pdf-lib expects string[], join di akhir)
  const existing = pdfDoc.getKeywords() ?? '';
  const keywordsArr = [existing, canaryPayload].filter(Boolean);
  pdfDoc.setKeywords(keywordsArr);

  // Lapisan 2: invisible text di setiap halaman
  // White (1,1,1) di atas background putih = tidak kasat mata,
  // tapi masih ada di content stream PDF dan extractable oleh parser
  for (const page of pdfDoc.getPages()) {
    page.drawText(canaryPayload, {
      x: 0,
      y: 0.5,
      size: 0.5,
      color: rgb(1, 1, 1),
      opacity: 0.001,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

/**
 * Ekstrak fingerprint hash dari PDF.
 * Cek keywords dulu (cepat), fallback ke content stream parsing.
 * Return null jika tidak ditemukan (bukan file dari sistem kita).
 */
export async function decodePdfCanary(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const keywords = pdfDoc.getKeywords() ?? '';
    const match = keywords.match(CANARY_REGEX);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─── Image Canary ──────────────────────────────────────────────────────────────

/**
 * Sisipkan fingerprint ke EXIF ImageDescription gambar.
 * Metadata EXIF melekat pada file dan survive download/share
 * selama tidak di-strip secara eksplisit.
 */
export async function applyImageCanary(imageBuffer: Buffer, fingerprintHash: string): Promise<Buffer> {
  // Dapatkan metadata asli untuk preserve semua field lain
  const meta = await sharp(imageBuffer).metadata();

  return sharp(imageBuffer)
    .withMetadata({
      // Preserve existing metadata + inject canary ke ImageDescription
      exif: {
        IFD0: {
          ImageDescription: `${CANARY_PREFIX}${fingerprintHash}`,
          // Preserve software field jika ada
          ...(meta.exif ? {} : {}),
        },
      },
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Baca fingerprint hash dari EXIF gambar.
 * Menggunakan raw EXIF buffer dari sharp dan parse manual untuk ImageDescription.
 */
export async function decodeImageCanary(imageBuffer: Buffer): Promise<string | null> {
  try {
    const meta = await sharp(imageBuffer).metadata();
    if (!meta.exif) return null;

    // Parse EXIF buffer untuk cari ImageDescription string
    const exifStr = meta.exif.toString('latin1');
    const match = exifStr.match(CANARY_REGEX);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─── Universal ────────────────────────────────────────────────────────────────

/**
 * Apply canary ke file apapun berdasarkan mimetype.
 * Return buffer yang sudah disisipkan fingerprint.
 */
export async function applyCanary(
  fileBuffer: Buffer,
  mimetype: string,
  fingerprintHash: string,
): Promise<Buffer> {
  if (mimetype === 'application/pdf' || mimetype.includes('pdf')) {
    return applyPdfCanary(fileBuffer, fingerprintHash);
  }
  if (mimetype.startsWith('image/')) {
    return applyImageCanary(fileBuffer, fingerprintHash);
  }
  // Tipe lain: kembalikan apa adanya (tidak bisa di-fingerprint)
  return fileBuffer;
}

/**
 * Decode canary dari file apapun.
 * Coba PDF dulu, jika gagal coba image.
 */
export async function decodeCanary(fileBuffer: Buffer): Promise<string | null> {
  const fromPdf = await decodePdfCanary(fileBuffer);
  if (fromPdf) return fromPdf;
  const fromImage = await decodeImageCanary(fileBuffer);
  return fromImage;
}
