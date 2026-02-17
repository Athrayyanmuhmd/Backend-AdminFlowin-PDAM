import mongoose from "mongoose";

const Transactions = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    userID: {
      type: String,
      required: true,
    },
    recieverID: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
  },
  { timeStamps: true }
);

export default mongoose.model("Transactions", Transactions);
