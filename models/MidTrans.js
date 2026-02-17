import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      required: false,
    },
    paymentType: { type: String },
    transactionStatus: {
      type: String,
      required: true,
      default: "pending",
    },
    customerDetails: {
      userId: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("TransactionMidtrans", transactionSchema);
