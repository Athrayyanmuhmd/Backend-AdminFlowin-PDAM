import mongoose from "mongoose";

const Meteran = new mongoose.Schema(
  {
    connectionDataId: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      default: null,
    },
    nomorMeteran: {  // Renamed from noMeteran to match ERD
      type: String,
      required: true,
    },
    nomorAkun: {  // Added field from ERD
      type: String,
      required: true,
      unique: true,
    },
    kelompokPelangganId: {
      type: mongoose.Types.ObjectId,
      ref: "KelompokPelanggan",
      required: true,
    },
    totalPemakaian: {
      type: Number,
      default: 0,
    },
    pemakaianBelumTerbayar: {
      type: Number,
      default: 0,
    },
    jatuhTempo: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'meterans'  // Explicit collection name (ERD-compliant)
  }
);

export default mongoose.model("Meteran", Meteran);
