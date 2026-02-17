import express from "express";
import { handlePaymentWebhook } from "../controllers/paymentWebhookController.js";

const router = express.Router();

/**
 * POST /webhook/payment
 * Webhook endpoint untuk menerima notifikasi dari Midtrans
 * untuk pembayaran RAB dan Billing
 *
 * Format order_id:
 * - RAB-{rabId} untuk pembayaran RAB
 * - BILLING-{billingId} untuk pembayaran billing
 */
router.post("/payment", handlePaymentWebhook);

export default router;
