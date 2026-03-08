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
 * Upload PDF or image to Cloudinary.
 * For PDFs: converts first page to image using pdf.js
 * For images: optimizes directly with sharp
 */
export const uploadPdfAsImage = async (
  fileBuffer: Buffer,
  folder = 'aqualink',
  mimetype = 'application/pdf'
): Promise<string> => {
  try {
    let imageBuffer: Buffer;

    if (mimetype === 'application/pdf') {
      console.log('📄 Converting PDF to image...');
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
        console.log('✅ PDF converted to image successfully');
      } catch (pdfError: any) {
        console.error('❌ Error converting PDF:', pdfError);
        throw new Error(`Failed to convert PDF: ${pdfError.message}`);
      }
    } else {
      console.log('🖼️ Optimizing image file...');
      imageBuffer = await sharp(fileBuffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', format: 'jpg' },
        (error, result) => {
          if (error || !result) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`Failed to upload file: ${error?.message}`));
          } else {
            console.log('✅ Image uploaded to Cloudinary:', result.secure_url);
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
 * Upload file to Cloudinary from buffer (raw/PDF mode)
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
          console.error('❌ Cloudinary upload error:', error);
          reject(new Error(`Failed to upload file: ${error?.message}`));
        } else {
          let secureUrl = result.secure_url;
          if (!secureUrl.endsWith('.pdf')) secureUrl = `${secureUrl}.pdf`;
          console.log('✅ File uploaded to Cloudinary:', secureUrl);
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
