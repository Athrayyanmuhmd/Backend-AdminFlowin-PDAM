import express from "express";
import {
  createPayment,
  webhookMidtrans,
  getTransactionByOrderID,
} from "../controllers/payment.js";

const paymentRouter = express.Router();

paymentRouter.post("/topup/:id", createPayment);
paymentRouter.post("/notification", webhookMidtrans);
paymentRouter.get("/getTransactionByOrderID/:orderID", getTransactionByOrderID);

export default paymentRouter;
