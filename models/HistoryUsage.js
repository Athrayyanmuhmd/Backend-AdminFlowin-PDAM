import mongoose from "mongoose";

const historyUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    meteranId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meteran",
      required: true,
    },
    penggunaanAir: {  // Renamed from usedWater to match ERD and GraphQL schema
      type: Number, // Liter per detik dari IoT sensor
      required: true,
    },
  },
  {
    timestamps: true, // Otomatis menambahkan createdAt untuk time-series
    collection: 'historyusages'  // Explicit collection name (ERD-compliant)
  }
);

const HistoryUsage = mongoose.model("RiwayatPenggunaan", historyUsageSchema);

export default HistoryUsage;
