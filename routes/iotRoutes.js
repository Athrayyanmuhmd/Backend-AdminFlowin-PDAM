import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  getConnectionStatus,
  disconnectDevice,
  iotHeartbeat,
} from "../controllers/iotController.js";

const router = express.Router();

/**
 * ⚠️ PAIRING ROUTES REMOVED - IoT devices use hardcoded configuration
 * No need for pairing flow anymore!
 */

/**
 * User routes (authenticated)
 */

// Get connection status
router.get("/connection-status", verifyToken, getConnectionStatus);

// Disconnect device
router.post("/disconnect", verifyToken, disconnectDevice);

/**
 * IoT Device routes (public)
 */

// IoT heartbeat/sync
router.post("/heartbeat", iotHeartbeat);

export default router;
