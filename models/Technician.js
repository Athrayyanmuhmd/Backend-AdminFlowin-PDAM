import mongoose from "mongoose";

const Technician = new mongoose.Schema(
  {
    namaLengkap: {  // Renamed from fullName to match ERD
      type: String,
      required: true,
    },
    nip: {  // Added from ERD
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    noHP: {  // Renamed from phone to match ERD
      type: String,
      required: true,
      unique: true,
    },
    divisi: {  // Added from ERD (EnumDivisiTeknisi)
      type: String,
      enum: ["PerencanaanTeknik", "TeknikCabang", "PengawasanTeknik"],
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'teknisis'  // Explicit collection name (ERD-compliant)
  }
);

export default mongoose.model("Teknisi", Technician);
