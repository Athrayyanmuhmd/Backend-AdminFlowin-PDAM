import mongoose from "mongoose";

const Meteran = new mongoose.Schema(
  {
    idKelompokPelanggan: {
      type: mongoose.Types.ObjectId,
      ref: "KelompokPelanggan",
      required: true,
    },
    idKoneksiData: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      default: null,
    },
    nomorMeteran: {
      type: String,
      required: true,
    },
    nomorAkun: {
      type: String,
      required: true,
      unique: true,
    },
    totalPemakaian: {
      type: Number,
      default: 0,
    },
    pemakaianBelumTerbayar: {
      type: Number,
      default: 0,
    },
    statusAktif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'meterans'
  }
);

export default mongoose.model("Meteran", Meteran);
