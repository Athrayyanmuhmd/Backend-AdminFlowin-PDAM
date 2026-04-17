// @ts-nocheck — legacy REST route, phase-out menuju GraphQL
import express from "express";
import { getNotificationsByUserId } from "../controllers/notificationController.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";

const notificationRouter = express.Router();

// Auth wajib — notifikasi berisi data pribadi pelanggan
notificationRouter.get(
  "/getNotificationByUserId/:userId",
  verifyAdminOrTechnician,
  getNotificationsByUserId
);

export default notificationRouter;
