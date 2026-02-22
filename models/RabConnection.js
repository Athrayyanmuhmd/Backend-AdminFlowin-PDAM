import mongoose from "mongoose";

const RabConnection = new mongoose.Schema(
  {
    idKoneksiData: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      required: true,
    },
    totalBiaya: {
      type: Number,
      required: true,
    },
    statusPembayaran: {
      type: String,
      enum: ["Pending", "Settlement", "Cancel", "Expire", "Refund", "Chargeback", "Fraud"],
      default: "Pending",
    },
    urlRab: {
      type: String,
      required: true,
    },
    catatan: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: 'rabconnections'  // Explicit collection name (ERD-compliant)
  }
);

export default mongoose.model("RabConnection", RabConnection);
