// @ts-nocheck — legacy REST route, phase-out menuju GraphQL
import express from "express";
import {
  createTransaction,
  editTransaction,
  getTransactionByRecieverID,
  getTransactionByTransactionID,
  getTransactionByUserID,
} from "../controllers/transactionController.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";

const transactionRouter = express.Router();

// Semua route transaksi wajib auth admin atau teknisi
transactionRouter.post("/", verifyAdminOrTechnician, createTransaction);
transactionRouter.put("/updateTransaction/:id", verifyAdminOrTechnician, editTransaction);
transactionRouter.get("/getTransactionByRecieverID/:id", verifyAdminOrTechnician, getTransactionByRecieverID);
transactionRouter.get("/getTransactionByTransactionID/:id", verifyAdminOrTechnician, getTransactionByTransactionID);
transactionRouter.get("/getTransactionByUserID/:id", verifyAdminOrTechnician, getTransactionByUserID);

export default transactionRouter;
