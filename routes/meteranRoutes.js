import express from "express";
import {
  createMeteran,
  getAllMeteran,
  getMeteranById,
  getMeteranByUserId,
  updateMeteran,
  deleteMeteran,
} from "../controllers/meteranController.js";
import { verifyToken } from "../middleware/auth.js";
import { verifyAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// User routes
router.get("/my-meteran", verifyToken, getMeteranByUserId);

// Admin routes
router.post("/", verifyAdmin, createMeteran);
router.get("/", verifyAdmin, getAllMeteran);
router.get("/:id", verifyAdmin, getMeteranById);
router.put("/:id", verifyAdmin, updateMeteran);
router.delete("/:id", verifyAdmin, deleteMeteran);

export default router;
