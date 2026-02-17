import express from "express";
import { getMonitoringStats } from "../controllers/monitoringController.js";
import { verifyToken } from "../middleware/auth.js";

const monitoringRouter = express.Router();

/**
 * GET /monitoring/stats/:userId/:meteranId
 * Get monitoring statistics including average usage and comparison
 */
monitoringRouter.get(
  "/stats/:userId/:meteranId",
  verifyToken,
  getMonitoringStats
);

export default monitoringRouter;
