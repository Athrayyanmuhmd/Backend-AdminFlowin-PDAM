import express from "express";
import {
  createHistoryUsage,
  getHistories,
  getAllHistoryUsage,
  deleteHistoryUsage,
} from "../controllers/historyUsageController.js";
import { verifyAdmin } from "../middleware/adminAuth.js";

const historyRouter = express.Router();

// IoT endpoint - Create history usage from IoT sensor
// POST /history/:userId/:meteranId
// Body: { usedWater: 1.3 }
historyRouter.post("/:userId/:meteranId", createHistoryUsage);

// Get aggregated history usage with filter (hari/minggu/bulan/tahun)
// GET /history/getHistory/:userId/:meteranId?filter=hari
historyRouter.get("/getHistory/:userId/:meteranId", getHistories);

// Admin: Get all raw history usage data with filters
// GET /history/all?userId=xxx&meteranId=xxx&startDate=xxx&endDate=xxx&limit=100
historyRouter.get("/all", verifyAdmin, getAllHistoryUsage);

// Admin: Delete history usage
// DELETE /history/:id
historyRouter.delete("/:id", verifyAdmin, deleteHistoryUsage);

export default historyRouter;
