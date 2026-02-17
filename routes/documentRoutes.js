import express from "express";
import { getDocumentProxy } from "../controllers/documentController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Get document via proxy (requires authentication via header)
router.get("/proxy", verifyToken, getDocumentProxy);

export default router;
