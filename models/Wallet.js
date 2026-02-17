import mongoose from "mongoose";

const Wallet = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    pendingBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    conservationToken: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Wallets", Wallet);
