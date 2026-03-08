import mongoose from "mongoose";

const KoneksiDataSchema = new mongoose.Schema(
  {
    idPelanggan: {
      type: mongoose.Types.ObjectId,
      ref: "Pengguna",
      default: null,
    },
    statusVerifikasi: {
      type: String,
      enum: ['Menunggu', 'Disetujui', 'Ditolak'],
      default: 'Menunggu',
    },
    NIK: {
      type: String,
      default: null,
    },
    NIKUrl: {
      type: String,
      default: null,
    },
    noKK: {
      type: String,
      default: null,
    },
    KKUrl: {
      type: String,
      default: null,
    },
    IMB: {
      type: String,
      default: null,
    },
    IMBUrl: {
      type: String,
      default: null,
    },
    alamat: {
      type: String,
      default: null,
    },
    kelurahan: {
      type: String,
      default: null,
    },
    kecamatan: {
      type: String,
      default: null,
    },
    luasBangunan: {
      type: Number,
      default: null,
    },
    alasanPenolakan: {
      type: String,
      default: null,
    },
    tanggalVerifikasi: {
      type: Date,
      default: null,
    },
    idTeknisi: {
      type: mongoose.Types.ObjectId,
      ref: "Teknisi",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: mongoose.Types.ObjectId,
      ref: "AdminAccount",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'koneksidatas',
  }
);

export default mongoose.model("ConnectionData", KoneksiDataSchema);
