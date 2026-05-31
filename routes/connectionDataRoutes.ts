// @ts-nocheck — legacy REST route, phase-out menuju GraphQL
import express from "express";
import {
  createConnectionData,
  getConnectionDataByUser,
  getAllConnectionData,
  getConnectionDataById,
  verifyConnectionDataByAdmin,
  verifyConnectionDataByTechnician,
  completeAllProcedure,
  updateConnectionData,
  deleteConnectionData,
  assignTechnician,
  unassignTechnician,
} from "../controllers/connectionDataController.js";
import { uploadDokumenKoneksiData } from "../controllers/uploadDokumenKoneksiData.js";
import { verifyToken } from "../middleware/auth.js";
import { verifyAdmin } from "../middleware/adminAuth.js";
import { verifyTechnician } from "../middleware/technicianAuth.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";
import { uploadConnectionDataFiles, validateMagicBytes } from "../middleware/upload.js";
import multer from "multer";

const router = express.Router();

// Multer khusus upload dokumen single file (NIK/KK/IMB), max 5MB
const uploadSingleDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Tipe file tidak valid. Hanya PDF, JPEG, PNG yang diizinkan.'));
      return;
    }
    cb(null, true);
  },
}).single('file');

// User routes
router.post("/", verifyToken, uploadConnectionDataFiles, validateMagicBytes, createConnectionData);
router.get("/my-connection", verifyToken, getConnectionDataByUser);

// Admin & Technician routes (read access)
router.get("/", verifyAdminOrTechnician, getAllConnectionData);
router.get("/:id", verifyAdminOrTechnician, getConnectionDataById);

// Admin only routes
router.post("/:id/upload-dokumen", verifyAdmin, uploadSingleDoc, validateMagicBytes, uploadDokumenKoneksiData);
router.put("/:id/verify-admin", verifyAdmin, verifyConnectionDataByAdmin);
router.put("/:id/assign-technician", verifyAdmin, assignTechnician);
router.put("/:id/unassign-technician", verifyAdmin, unassignTechnician);
router.put("/:id/complete-procedure", verifyAdmin, completeAllProcedure);
router.put(
  "/:id",
  verifyAdmin,
  uploadConnectionDataFiles,
  validateMagicBytes,
  updateConnectionData
);
router.delete("/:id", verifyAdmin, deleteConnectionData);

// Technician routes
router.put(
  "/:id/verify-technician",
  verifyTechnician,
  verifyConnectionDataByTechnician
);

export default router;
