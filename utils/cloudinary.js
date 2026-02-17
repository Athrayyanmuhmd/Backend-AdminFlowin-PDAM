import { v2 as cloudinary } from "cloudinary";
import { configDotenv } from "dotenv";
import sharp from "sharp";
import { createCanvas } from "canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

configDotenv();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload PDF or image to Cloudinary
 * For PDFs: Convert first page to image using pdf.js
 * For images: Upload and optimize directly
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} folder - Cloudinary folder path
 * @param {string} mimetype - File mimetype
 * @returns {Promise<string>} - Secure URL of uploaded file
 */
export const uploadPdfAsImage = async (
  fileBuffer,
  folder = "aqualink",
  mimetype = "application/pdf"
) => {
  try {
    let imageBuffer;

    // If file is PDF, convert to image first
    if (mimetype === "application/pdf") {
      console.log("📄 Converting PDF to image...");

      try {
        // Load PDF using pdf.js
        const loadingTask = getDocument({
          data: new Uint8Array(fileBuffer),
          standardFontDataUrl: null,
        });

        const pdfDocument = await loadingTask.promise;
        const page = await pdfDocument.getPage(1); // Get first page

        // Set scale for good quality
        const scale = 2.0;
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");

        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Get image buffer from canvas
        const pngBuffer = canvas.toBuffer("image/png");

        // Optimize with sharp and convert to JPEG
        imageBuffer = await sharp(pngBuffer)
          .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

        console.log("✅ PDF converted to image successfully");
      } catch (pdfError) {
        console.error("❌ Error converting PDF:", pdfError);
        throw new Error(`Failed to convert PDF: ${pdfError.message}`);
      }
    } else {
      // For images, optimize with sharp
      console.log("🖼️ Optimizing image file...");
      imageBuffer = await sharp(fileBuffer)
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    // Upload to Cloudinary as image
    const uploadOptions = {
      folder: folder,
      resource_type: "image",
      format: "jpg",
    };

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload error:", error);
            reject(new Error(`Failed to upload file: ${error.message}`));
          } else {
            console.log("✅ Image uploaded to Cloudinary:", result.secure_url);
            console.log("   Resource type:", result.resource_type);
            console.log("   Format:", result.format);
            console.log("   Public ID:", result.public_id);
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(imageBuffer);
    });
  } catch (error) {
    console.error("❌ Error processing file:", error);
    throw error;
  }
};
/**
 * Upload file to Cloudinary from buffer
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<string>} - Secure URL of uploaded file
 */
export const uploadToCloudinary = async (fileBuffer, folder = "aqualink") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "raw", // Use "raw" for PDFs and non-image files
        format: "pdf", // Explicitly set format as PDF
        access_mode: "public", // Make files publicly accessible
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error);
          reject(new Error(`Failed to upload file: ${error.message}`));
        } else {
          // Ensure URL includes .pdf extension
          let secureUrl = result.secure_url;
          if (!secureUrl.endsWith(".pdf")) {
            secureUrl = `${secureUrl}.pdf`;
          }

          console.log("✅ File uploaded to Cloudinary:", secureUrl);
          console.log("   Resource type:", result.resource_type);
          console.log("   Format:", result.format);
          console.log("   Public ID:", result.public_id);
          resolve(secureUrl);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete file from Cloudinary
 * @param {string} fileUrl - Cloudinary file URL
 */
export const deleteFromCloudinary = async (fileUrl) => {
  try {
    // Extract public_id from URL
    const parts = fileUrl.split("/");
    const fileName = parts[parts.length - 1];
    const folderPath = parts.slice(-3, -1).join("/");
    const publicId = `${folderPath}/${fileName.split(".")[0]}`;

    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (error) {
    console.error("Failed to delete file:", error);
  }
};

export default cloudinary;
