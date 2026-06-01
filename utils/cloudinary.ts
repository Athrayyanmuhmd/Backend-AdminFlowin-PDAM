import { v2 as cloudinary } from 'cloudinary';
import { configDotenv } from 'dotenv';
import sharp from 'sharp';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

configDotenv();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Watermark Helpers ────────────────────────────────────────────────────────

/**
 * Embed diagonal watermark teks ke dalam PDF menggunakan pdf-lib.
 * Tidak ada rendering ke canvas — PDF tetap vector/lossless.
 */
async function applyPdfWatermark(pdfBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const uploadDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const cx = width / 2;
    const cy = height / 2;
    const fontSize = Math.max(18, Math.round(width * 0.04));

    page.drawText('DOKUMEN RAHASIA', {
      x: cx - 120, y: cy + fontSize * 1.6,
      size: fontSize * 1.2,
      color: rgb(0.6, 0, 0),
      opacity: 0.12,
      rotate: degrees(-35),
    });
    page.drawText('PERUMDAM TIRTA DAROY', {
      x: cx - 120, y: cy,
      size: fontSize,
      color: rgb(0.6, 0, 0),
      opacity: 0.12,
      rotate: degrees(-35),
    });
    page.drawText(`Diunggah: ${uploadDate}`, {
      x: cx - 80, y: cy - fontSize * 1.6,
      size: fontSize * 0.75,
      color: rgb(0.6, 0, 0),
      opacity: 0.12,
      rotate: degrees(-35),
    });
  }

  return Buffer.from(await pdfDoc.save());
}

/**
 * Embed diagonal watermark SVG ke dalam gambar menggunakan sharp.
 */
async function applyImageWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width || 1000;
  const h = metadata.height || 1400;
  const fontSize = Math.max(28, Math.round(w * 0.04));
  const lineGap = Math.round(fontSize * 1.6);
  const cx = w / 2;
  const cy = h / 2;
  const uploadDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const svgWatermark = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <style>
        text { font-family: Arial, sans-serif; font-weight: bold; fill: rgba(160,0,0,0.13); text-anchor: middle; }
      </style>
      <g transform="rotate(-35, ${cx}, ${cy})">
        <text x="${cx}" y="${cy - lineGap}" font-size="${fontSize * 1.2}">DOKUMEN RAHASIA</text>
        <text x="${cx}" y="${cy}" font-size="${fontSize}">PERUMDAM TIRTA DAROY</text>
        <text x="${cx}" y="${cy + lineGap}" font-size="${Math.round(fontSize * 0.75)}">Diunggah: ${uploadDate}</text>
      </g>
    </svg>`;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svgWatermark), blend: 'over' }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

// ─── Upload Helpers ───────────────────────────────────────────────────────────

function uploadStream(buffer: Buffer, options: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) reject(new Error(error?.message ?? 'Upload failed'));
      else resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload dokumen (PDF atau gambar) ke Cloudinary dengan watermark otomatis.
 *
 * - PDF  → watermark via pdf-lib → upload raw (lossless, kualitas asli terjaga)
 * - Image → resize → watermark via sharp → upload sebagai JPEG
 *
 * Gunakan fungsi ini untuk semua dokumen kredensial: NIK, KK, IMB, foto survei, RAB.
 */
const ALLOWED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const uploadDocument = async (
  fileBuffer: Buffer,
  folder = 'aqualink',
  mimetype = 'application/pdf'
): Promise<string> => {
  if (!ALLOWED_MIMETYPES.includes(mimetype)) {
    throw new Error(`Tipe file tidak diizinkan: ${mimetype}. Hanya PDF, JPEG, PNG yang diterima.`);
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Ukuran file terlalu besar (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB). Maksimal 5MB.`);
  }

  if (mimetype === 'application/pdf') {
    const watermarked = await applyPdfWatermark(fileBuffer);
    // resource_type: 'image' agar PDF baru bisa diakses publik via /image/upload/
    // URL lama yang sudah pakai /raw/upload/ tetap berfungsi via stream proxy di
    // documentController. Tidak ada migration — kedua format hidup berdampingan.
    const url = await uploadStream(watermarked, {
      folder,
      resource_type: 'image',
      format: 'pdf',
    });
    return url.endsWith('.pdf') ? url : `${url}.pdf`;
  }

  // Image path (JPEG/PNG dari foto teknisi)
  const resized = await sharp(fileBuffer)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const watermarked = await applyImageWatermark(resized);
  return uploadStream(watermarked, { folder, resource_type: 'image', format: 'jpg' });
};

/**
 * Upload PDF mentah ke Cloudinary tanpa watermark (untuk internal/sistem).
 * Untuk dokumen user gunakan uploadDocument().
 */
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder = 'aqualink'
): Promise<string> => {
  const url = await uploadStream(fileBuffer, {
    folder,
    resource_type: 'raw',
    format: 'pdf',
    access_mode: 'public',
  });
  return url.endsWith('.pdf') ? url : `${url}.pdf`;
};

/**
 * Kembalikan URL Cloudinary yang bisa dibuka langsung di browser (inline, bukan download).
 * Gunakan ini untuk preview PDF di <iframe>.
 */
export function toPdfInlineUrl(cloudinaryUrl: string): string {
  return cloudinaryUrl.replace('/upload/', '/upload/fl_attachment:false/');
}

/**
 * Kembalikan true jika URL mengarah ke file PDF (bukan gambar).
 * Digunakan di frontend untuk memilih antara <img> vs <iframe>.
 */
export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}

/**
 * Delete file from Cloudinary by URL.
 */
export const deleteFromCloudinary = async (fileUrl: string): Promise<void> => {
  try {
    const parts = fileUrl.split('/');
    const fileName = parts[parts.length - 1];
    const folderPath = parts.slice(-3, -1).join('/');
    const publicId = `${folderPath}/${fileName.split('.')[0]}`;
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
};

export default cloudinary;
