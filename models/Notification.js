import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    idAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    idTeknisi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teknisi',
      default: null,
    },
    idPelanggan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    judul: {
      type: String,
      required: true,
    },
    pesan: {
      type: String,
      required: true,
    },
    kategori: {
      type: String,
      enum: ["Transaksi", "Informasi", "Peringatan"],
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'notifikasis',
  }
);

export default mongoose.model("Notifikasi", NotificationSchema);
