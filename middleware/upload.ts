import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and image files (JPEG, PNG) are allowed.'));
  }
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
