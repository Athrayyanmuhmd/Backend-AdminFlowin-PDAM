import mongoose from "mongoose";

const RabConnection = new mongoose.Schema(
  {
    connectionDataId: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      required: true,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    technicianId: {
      type: mongoose.Types.ObjectId,
      ref: "Technician",
      required: true,
    },
    totalBiaya: {
      type: Number,
      required: true,
    },
    statusPembayaran: {  // Renamed from isPaid to match ERD (changed from Boolean to Enum)
      type: String,
      enum: ["Pending", "Settlement", "Cancel", "Expire", "Refund", "Chargeback", "Fraud"],
      default: "Pending",
    },
    urlRab: {  // Renamed from rabUrl to match ERD and GraphQL schema
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
