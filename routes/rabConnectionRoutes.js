import express from "express";
import {
  createRabConnection,
  getAllRabConnections,
  getRabConnectionById,
  getRabConnectionByUserId,
  getRabConnectionByConnectionId,
  updateRabPaymentStatus,
  updateRabConnection,
  deleteRabConnection,
  createRabPayment,
} from "../controllers/rabConnectionController.js";
import { verifyToken } from "../middleware/auth.js";
import { verifyAdmin } from "../middleware/adminAuth.js";
import { verifyTechnician } from "../middleware/technicianAuth.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";
import { uploadRabFile } from "../middleware/upload.js";

const router = express.Router();

// User routes
router.get("/my-rab", verifyToken, getRabConnectionByUserId);
router.post("/:rabId/pay", verifyToken, createRabPayment); // Endpoint baru untuk bayar RAB
router.put("/:id/payment", verifyToken, updateRabPaymentStatus);

// Technician routes (create/update)
router.post("/", verifyTechnician, uploadRabFile, createRabConnection);
router.put("/:id", verifyTechnician, uploadRabFile, updateRabConnection);

// Admin & Technician routes (read access)
router.get("/", verifyAdminOrTechnician, getAllRabConnections);
router.get("/:id", verifyAdminOrTechnician, getRabConnectionById);
router.get(
  "/connection/:connectionDataId",
  verifyAdminOrTechnician,
  getRabConnectionByConnectionId
);

// Admin only routes
router.delete("/:id", verifyAdmin, deleteRabConnection);

export default router;
