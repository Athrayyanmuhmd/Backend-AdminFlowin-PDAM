import mongoose from "mongoose";

const KelompokPelanggan = new mongoose.Schema(
  {
    namaKelompok: {
      type: String,
      required: true,
    },
    hargaDiBawah10mKubik: {  // Renamed to match ERD and GraphQL schema
      type: Number,
      required: true,
    },
    hargaDiAtas10mKubik: {  // Renamed to match ERD and GraphQL schema
      type: Number,
      required: true,
    },
    biayaBeban: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'kelompokpelanggans'  // Explicit collection name (ERD-compliant)
  }
);

export default mongoose.model("KelompokPelanggan", KelompokPelanggan);
