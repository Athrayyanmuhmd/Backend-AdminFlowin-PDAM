import express from "express";
import {
  generateMonthlyBilling,
  generateBillingForMeter,
  getAllBilling,
  getMyBilling,
  getBillingById,
  getUnpaidBilling,
  payBilling,
  payAllBilling,
  createPayment,
  createPaymentForAllBills,
  updatePaymentStatus,
  updateOverdueStatus,
  getMonthlyReport,
  deleteBilling,
} from "../controllers/billingController.js";
import { verifyToken } from "../middleware/auth.js";
import { verifyAdmin } from "../middleware/adminAuth.js";

const billingRouter = express.Router();

// Note: Midtrans webhook sudah di-handle di /webhook/payment (webhookRoutes.js)
// Tidak perlu duplicate webhook endpoint di sini

// Admin routes
billingRouter.post("/generate-all", verifyAdmin, generateMonthlyBilling); // Generate billing for all meters
billingRouter.post(
  "/generate/:meteranId",
  verifyAdmin,
  generateBillingForMeter
); // Generate for single meter
billingRouter.get("/all", verifyAdmin, getAllBilling); // Get all billing
billingRouter.get("/report/:periode", verifyAdmin, getMonthlyReport); // Monthly report
billingRouter.put("/:id/payment-status", verifyAdmin, updatePaymentStatus); // Update payment status
billingRouter.put("/update-overdue", verifyAdmin, updateOverdueStatus); // Update overdue status (cron)
billingRouter.delete("/:id", verifyAdmin, deleteBilling); // Delete billing

// User routes
billingRouter.get("/my-billing", verifyToken, getMyBilling); // Get my billing
billingRouter.get("/unpaid", verifyToken, getUnpaidBilling); // Get unpaid billing
billingRouter.post("/:id/create-payment", verifyToken, createPayment); // Create Midtrans payment link for single bill
billingRouter.post(
  "/create-payment-all",
  verifyToken,
  createPaymentForAllBills
); // Create Midtrans payment link for all bills
billingRouter.put("/:id/pay", verifyToken, payBilling); // Pay single billing manually
billingRouter.put("/pay-all", verifyToken, payAllBilling); // Pay all billing manually

// Public/Both routes
billingRouter.get("/:id", verifyToken, getBillingById); // Get by ID

export default billingRouter;
