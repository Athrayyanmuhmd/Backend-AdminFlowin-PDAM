import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/** Hitung SHA-256 dari buffer file — hasilnya hex string 64 karakter */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const storage = multer.memoryStorage();

// Magic bytes signatures — cek isi file, bukan header HTTP yang bisa dipalsukan
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/jpeg':      [[0xFF, 0xD8, 0xFF]],
  'image/jpg':       [[0xFF, 0xD8, 0xFF]],
  'image/png':       [[0x89, 0x50, 0x4E, 0x47]], // .PNG
};

function hasMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;
  return signatures.some(sig => sig.every((byte, i) => buffer[i] === byte));
}

// Middleware pasca-multer: verifikasi magic bytes di buffer yang sudah tersedia
export function validateMagicBytes(req: Request, res: Response, next: NextFunction): void {
  const files: Express.Multer.File[] = [];

  if (req.file) {
    files.push(req.file);
  } else if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      Object.values(req.files).forEach(arr => files.push(...arr));
    }
  }

  for (const file of files) {
    if (!hasMagicBytes(file.buffer, file.mimetype)) {
      res.status(400).json({
        status: 400,
        pesan: `File '${file.originalname}' tidak valid: isi file tidak sesuai dengan tipe yang diklaim (${file.mimetype}).`,
      });
      return;
    }
  }

  next();
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error('Tipe file tidak valid. Hanya PDF dan gambar (JPEG, PNG) yang diizinkan.'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadConnectionDataFiles = upload.fields([
  { name: 'nikFile', maxCount: 1 },
  { name: 'kkFile', maxCount: 1 },
  { name: 'imbFile', maxCount: 1 },
]);

export const uploadSurveyDataFiles = upload.fields([
  { name: 'jaringanFile', maxCount: 1 },
  { name: 'posisiBakFile', maxCount: 1 },
  { name: 'posisiMeteranFile', maxCount: 1 },
]);

export const uploadRabFile = upload.single('rabFile');
export const uploadSingleFile = upload.single('file');

export default upload;
