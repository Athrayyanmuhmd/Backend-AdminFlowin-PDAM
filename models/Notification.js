import mongoose from "mongoose";

const Notifications = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    judul: {  // Renamed from title to match ERD
      type: String,
      required: true,
    },
    pesan: {  // Renamed from message to match ERD
      type: String,
      required: true,
    },
    kategori: {  // Renamed from category to match ERD
      type: String,
      enum: ["Transaksi", "Informasi", "Peringatan"],
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    isRead: {  // Added from ERD
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'notifikasis'  // Explicit collection name (ERD-compliant)
  }
);

export default mongoose.model("Notifikasi", Notifications);
