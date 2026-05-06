import { v2 as cloudinary } from 'cloudinary';
import { configDotenv } from 'dotenv';
import sharp from 'sharp';
import { createCanvas } from 'canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

configDotenv();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Tambahkan watermark "RAHASIA - PERUMDAM TIRTA DAROY" ke gambar.
 * Watermark semi-transparan diagonal — terlihat jika dicetak/screenshot, namun tidak mengganggu keterbacaan dokumen.
 * Dipanggil sebelum upload ke Cloudinary untuk semua dokumen kredensial pelanggan.
 */
async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width || 1000;
  const h = metadata.height || 1400;

  // Teks watermark: baris 1 identitas organisasi, baris 2 label rahasia, baris 3 timestamp upload
  const fontSize = Math.max(28, Math.round(w * 0.04));
  const lineGap = Math.round(fontSize * 1.6);
  const cx = w / 2;
  const cy = h / 2;
  const uploadDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  const svgWatermark = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <style>
        text {
          font-family: Arial, sans-serif;
          font-weight: bold;
          fill: rgba(160, 0, 0, 0.13);
          text-anchor: middle;
        }
      </style>
      <g transform="rotate(-35, ${cx}, ${cy})">
        <text x="${cx}" y="${cy - lineGap}" font-size="${fontSize * 1.2}">DOKUMEN RAHASIA</text>
        <text x="${cx}" y="${cy}" font-size="${fontSize}">PERUMDAM TIRTA DAROY</text>
        <text x="${cx}" y="${cy + lineGap}" font-size="${Math.round(fontSize * 0.75)}">Diunggah: ${uploadDate}</text>
      </g>
    </svg>
  `;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svgWatermark), blend: 'over' }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Upload PDF or image to Cloudinary dengan watermark otomatis.
 * PDF → konversi halaman 1 ke JPEG → watermark → Cloudinary
 * Image → resize → watermark → Cloudinary
 */
export const uploadPdfAsImage = async (
  fileBuffer: Buffer,
  folder = 'aqualink',
  mimetype = 'application/pdf'
): Promise<string> => {
  try {
    let imageBuffer: Buffer;

    if (mimetype === 'application/pdf') {
      try {
        const loadingTask = (getDocument as any)({
          data: new Uint8Array(fileBuffer),
          standardFontDataUrl: null,
        });
        const pdfDocument = await loadingTask.promise;
        const page = await pdfDocument.getPage(1);
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        const pngBuffer = canvas.toBuffer('image/png');
        imageBuffer = await sharp(pngBuffer)
          .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
      } catch (pdfError: any) {
        throw new Error(`Failed to convert PDF: ${pdfError.message}`);
      }
    } else {
      imageBuffer = await sharp(fileBuffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    // Terapkan watermark ke semua dokumen kredensial
    imageBuffer = await applyWatermark(imageBuffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', format: 'jpg' },
        (error, result) => {
          if (error || !result) {
            reject(new Error(`Failed to upload file: ${error?.message}`));
          } else {
            resolve(result.secure_url);
          }
        }
      );
      uploadStream.end(imageBuffer);
    });
  } catch (error) {
    console.error('❌ Error processing file:', error);
    throw error;
  }
};

/**
 * Upload file to Cloudinary from buffer (raw/PDF mode — tanpa watermark, untuk RAB)
 */
export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder = 'aqualink'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'raw', format: 'pdf', access_mode: 'public' },
      (error, result) => {
        if (error || !result) {
          reject(new Error(`Failed to upload file: ${error?.message}`));
        } else {
          let secureUrl = result.secure_url;
          if (!secureUrl.endsWith('.pdf')) secureUrl = `${secureUrl}.pdf`;
          resolve(secureUrl);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete file from Cloudinary by URL
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
