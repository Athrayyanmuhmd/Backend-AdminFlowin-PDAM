import express from "express";
import {
  createTechnician,
  loginTechnician,
  getAllTechnicians,
  getTechnicianById,
  getTechnicianProfile,
  updateTechnician,
  deleteTechnician,
  logoutTechnician,
} from "../controllers/technicianController.js";
import { verifyAdmin } from "../middleware/adminAuth.js";
import { verifyTechnician } from "../middleware/technicianAuth.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";

const router = express.Router();

// Public routes
router.post("/login", loginTechnician);

// Technician routes
router.get("/profile", verifyTechnician, getTechnicianProfile);
router.post("/logout", verifyTechnician, logoutTechnician);

// Admin & Technician routes (read access)
router.get("/", verifyAdminOrTechnician, getAllTechnicians);
router.get("/:id", verifyAdminOrTechnician, getTechnicianById);

// Admin only routes (create/update/delete)
router.post("/", verifyAdmin, createTechnician);
router.put("/:id", verifyAdmin, updateTechnician);
router.delete("/:id", verifyAdmin, deleteTechnician);

export default router;
