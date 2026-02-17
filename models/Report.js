import mongoose from "mongoose";

// Enum untuk Jenis Laporan sesuai ERD
const JenisLaporanEnum = [
  "AirTidakMengalir",
  "AirKeruh",
  "KebocoranPipa",
  "MeteranBermasalah",
  "KendalaLainnya"
];

// Enum untuk Status (WorkStatusPelanggan) sesuai ERD
const StatusLaporanEnum = [
  "Diajukan",
  "ProsesPerbaikan",
  "Selesai"
];

const Reports = new mongoose.Schema(
  {
    idPengguna: {  // Changed from reporterID (String) to ObjectId FK
      type: mongoose.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    namaLaporan: {  // Added field from ERD
      type: String,
      required: true,
    },
    masalah: {  // Renamed from problem
      type: String,
      required: true,
    },
    alamat: {  // Renamed from address
      type: String,
      required: true,
    },
    imageUrl: {  // Added field from ERD
      type: [String],
      default: [],
    },
    jenisLaporan: {  // Added enum field from ERD
      type: String,
      enum: JenisLaporanEnum,
      required: true,
    },
    catatan: {  // Added field from ERD
      type: String,
      default: null,
    },
    koordinat: {  // Renamed from coordinate (ERD shows separate Geolocation entity, but keeping embedded for now)
      longitude: {
        type: Number,
        required: true,
      },
      latitude: {
        type: Number,
        required: true,
      },
    },
    status: {  // Updated with proper enum values from ERD
      type: String,
      enum: StatusLaporanEnum,
      required: true,
      default: "Diajukan",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Laporan", Reports);
