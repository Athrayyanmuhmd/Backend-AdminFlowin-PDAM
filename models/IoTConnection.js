import mongoose from "mongoose";

const IoTConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    meteranId: {
      type: mongoose.Types.ObjectId,
      ref: "Meteran",
      required: true,
    },
    deviceId: {
      type: String,
      default: null, // MAC address atau unique identifier dari IoT
    },
    pairingCode: {
      type: String,
      default: null,
    },
    pairingCodeExpiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "connected", "disconnected", "error"],
      default: "pending",
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    lastSync: {
      type: Date,
      default: null,
    },
    connectionMethod: {
      type: String,
      enum: ["bluetooth", "wifi"],
      default: "bluetooth",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster queries
IoTConnectionSchema.index({ userId: 1 });
IoTConnectionSchema.index({ meteranId: 1 });
IoTConnectionSchema.index({ deviceId: 1 });
IoTConnectionSchema.index({ pairingCode: 1 });

export default mongoose.model("IoTConnection", IoTConnectionSchema);
