// @ts-nocheck — legacy REST route, phase-out menuju GraphQL
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
 * IoT Device routes — dilindungi device secret
 */

// Middleware: cek x-device-secret header sebelum heartbeat
const verifyDeviceSecret = (req, res, next) => {
  const secret = req.headers['x-device-secret'];
  const expected = process.env.IOT_DEVICE_SECRET;
  if (!expected) return next(); // secret belum dikonfigurasi → skip (dev mode)
  if (!secret || secret !== expected) {
    return res.status(401).json({ status: 401, pesan: 'Device tidak dikenal.' });
  }
  next();
};

// IoT heartbeat/sync
router.post("/heartbeat", verifyDeviceSecret, iotHeartbeat);

export default router;
