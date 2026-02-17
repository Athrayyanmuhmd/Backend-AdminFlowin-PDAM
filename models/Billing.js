import mongoose from "mongoose";

// Enum untuk Status Pembayaran sesuai ERD
const StatusPembayaranEnum = [
  "Pending",  // ERD typo: "Panding"
  "Settlement",
  "Cancel",
  "Expire",
  "Refund",
  "Chargeback",
  "Fraud"
];

const billingSchema = new mongoose.Schema(
  {
    userId: {  // Additional FK (not in ERD but needed for system)
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    idMeteran: {  // Renamed from meteranId to match ERD naming pattern
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meteran",
      required: true,
    },
    periode: {  // Matches ERD (Periode: Date) - keeping as Date type
      type: Date,
      required: true,
    },
    penggunaanSebelum: {  // Renamed from pemakaianAwal
      type: Number,
      required: true,
    },
    penggunaanSekarang: {  // Renamed from pemakaianAkhir
      type: Number,
      required: true,
    },
    totalPemakaian: {  // Matches ERD (TotalPemakaian)
      type: Number,
      required: true,
    },
    biaya: {  // Renamed from biayaAir
      type: Number,
      required: true,
    },
    biayaBeban: {  // Matches ERD (BiayaBeban)
      type: Number,
      required: true,
    },
    totalBiaya: {  // Renamed from totalTagihan
      type: Number,
      required: true,
    },
    statusPembayaran: {  // Changed from isPaid (boolean) to enum
      type: String,
      enum: StatusPembayaranEnum,
      default: "Pending",
    },
    tanggalPembayaran: {  // Renamed from paidAt
      type: Date,
      default: null,
    },
    metodePembayaran: {  // Renamed from paymentMethod
      type: String,
      default: null,
    },
    tenggatWaktu: {  // Renamed from dueDate
      type: Date,
      required: true,
    },
    menunggak: {  // Renamed from isOverdue
      type: Boolean,
      default: false,
    },
    denda: {  // Matches ERD (Denda)
      type: Number,
      default: 0,
    },
    catatan: {  // Renamed from notes
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Index untuk query cepat (updated field names)
billingSchema.index({ userId: 1, periode: 1 });
billingSchema.index({ idMeteran: 1, periode: 1 });
billingSchema.index({ statusPembayaran: 1, tenggatWaktu: 1 });

const Billing = mongoose.model("Tagihan", billingSchema);

export default Billing;
