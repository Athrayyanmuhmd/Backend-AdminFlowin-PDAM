import express from "express";
import {
  createKelompokPelanggan,
  getAllKelompokPelanggan,
  getKelompokPelangganById,
  updateKelompokPelanggan,
  deleteKelompokPelanggan,
} from "../controllers/kelompokPelangganController.js";
import { verifyAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// Admin routes
router.post("/", verifyAdmin, createKelompokPelanggan);
router.get("/", verifyAdmin, getAllKelompokPelanggan);
router.get("/:id", verifyAdmin, getKelompokPelangganById);
router.put("/:id", verifyAdmin, updateKelompokPelanggan);
router.delete("/:id", verifyAdmin, deleteKelompokPelanggan);

export default router;
