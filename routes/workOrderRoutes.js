import express from "express";
import {
  createWorkOrder,
  getAllWorkOrders,
  getWorkOrderById,
  assignTechnician,
  updateWorkOrderStatus,
  updateWorkOrder,
  deleteWorkOrder,
  getWorkOrdersByTechnician,
  getWorkOrderStats,
} from "../controllers/workOrderController.js";
import { verifyAdmin } from "../middleware/adminAuth.js";
import { verifyTechnician } from "../middleware/technicianAuth.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";

const router = express.Router();

// Admin only routes - Create, Update, Delete
router.post("/", verifyAdmin, createWorkOrder);
router.put("/:id", verifyAdmin, updateWorkOrder);
router.delete("/:id", verifyAdmin, deleteWorkOrder);
router.put("/:id/assign", verifyAdmin, assignTechnician);

// Admin & Technician routes - Read access
router.get("/", verifyAdminOrTechnician, getAllWorkOrders);
router.get("/stats", verifyAdminOrTechnician, getWorkOrderStats);
router.get("/technician/:technicianId", verifyAdminOrTechnician, getWorkOrdersByTechnician);
router.get("/:id", verifyAdminOrTechnician, getWorkOrderById);

// Admin & Technician can update status
router.put("/:id/status", verifyAdminOrTechnician, updateWorkOrderStatus);

export default router;
