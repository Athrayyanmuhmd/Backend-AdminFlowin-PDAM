import express from "express";
import {
  createTransaction,
  editTransaction,
  getTransactionByRecieverID,
  getTransactionByTransactionID,
  getTransactionByUserID,
} from "../controllers/transactionController.js";

const transactionRouter = express.Router();

transactionRouter.post("/", createTransaction);
transactionRouter.put("/updateTransaction/:id", editTransaction);
transactionRouter.get(
  "/getTransactionByRecieverID/:id",
  getTransactionByRecieverID
);
transactionRouter.get(
  "/getTransactionByTransactionID/:id",
  getTransactionByTransactionID
);
transactionRouter.get("/getTransactionByUserID/:id", getTransactionByUserID);

export default transactionRouter;
