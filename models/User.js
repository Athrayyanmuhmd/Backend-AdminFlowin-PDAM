import mongoose from "mongoose";

const Users = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    namaLengkap: {  // Renamed from fullName to match ERD
      type: String,
      required: true,
    },
    noHP: {  // Renamed from phone to match ERD
      type: String,
      default: null,
    },
    nik: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    address: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ["L", "P", null],
      default: null,
    },
    birthDate: {
      type: String,
      default: null,
    },
    occupation: {
      type: String,
      default: null,
    },
    location: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    customerType: {
      type: String,
      enum: ["rumah_tangga", "komersial", "industri", "sosial"],
      default: "rumah_tangga",
    },
    accountStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    password: {
      type: String,
      default: null,
    },
    token: {
      type: String,
      default: null,
    },
    SambunganDataId: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      default: null,
    },
    meteranId: {
      type: mongoose.Types.ObjectId,
      ref: "Meteran",
      default: null,
    },
    iotConnectionId: {
      type: mongoose.Types.ObjectId,
      ref: "IoTConnection",
      default: null,
    },
    isIoTConnected: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'penggunas'  // Explicit collection name (ERD-compliant)
  }
);

export default mongoose.model("Pengguna", Users);
