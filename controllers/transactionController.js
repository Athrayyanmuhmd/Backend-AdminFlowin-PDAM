import Transaction from "../models/Transaction.js";
import { verifyToken } from "../middleware/auth.js";
import mongoose from "mongoose";

export const createTransaction = [
  verifyToken,
  async (req, res, next) => {
    try {
      const { name, userID, recieverID, amount, category } = req.body;
      if ((!name || !userID || !recieverID || !amount, !category)) {
        return res.status(400).json({
          status: 400,
          pesan: "All field are required",
        });
      }

      const newTransaction = new Transaction(req.body);
      const savedTransaction = await newTransaction.save();

      res.status(201).json({
        status: 201,
        data: savedTransaction,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

export const editTransaction = [
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, userID, recieverID, amount, category } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: 400,
          pesan: "Invalid report ID.",
        });
      }

      if ((!name || !userID || recieverID || !amount, !category)) {
        return res.status(400).json({
          status: 400,
          pesan: "All field are required",
        });
      }

      const updatedTransaction = await Transaction.findByIdAndUpdate(
        id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedTransaction) {
        return res.status(404).json({
          status: 404,
          pesan: "Transaction not found",
        });
      }

      res.status(200).json({
        status: 200,
        data: updatedTransaction,
        pesan: "Transaction updated successfull",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

export const getTransactionByTransactionID = [
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID is required.",
        });
      }

      const transaction = await Transaction.findById(id);

      if (!transaction) {
        return res.status(404).json({
          status: 404,
          pesan: "Transaction not found",
        });
      }

      res.status(200).json({
        status: 200,
        data: transaction,
        pesan: "Transaction founded",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

export const getTransactionByUserID = [
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "User ID is required.",
        });
      }

      const transactions = await Transaction.find({ userID: id });
      if (transactions.length === 0) {
        return res.status(404).json({
          status: 404,
          pesan: "No Transaction found for the given User ID.",
        });
      }

      res.status(200).json({
        status: 200,
        data: transactions,
        message: `${transactions.length} ${
          transactions.length === 1 ? "Transaction" : "Transactions"
        } found.`,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];
export const getTransactionByRecieverID = [
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "Reciever ID is required.",
        });
      }

      const transactions = await Transaction.find({ recieverID: id });
      if (transactions.length === 0) {
        return res.status(404).json({
          status: 404,
          pesan: "No Transaction found for the given Reciever ID.",
        });
      }

      res.status(200).json({
        status: 200,
        data: transactions,
        message: `${transactions.length} ${
          transactions.length === 1 ? "Transaction" : "Transactions"
        } found.`,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];
