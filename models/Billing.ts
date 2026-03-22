import { Schema, model, Types, Document } from 'mongoose';

export type StatusPembayaranBilling =
  | 'Pending'
  | 'Settlement'
  | 'Cancel'
  | 'Expire'
  | 'Refund'
  | 'Chargeback'
  | 'Fraud'
  | 'Merged'; // Record lama yang sudah digabung ke tagihan baru

export type JenisBilling = 'normal' | 'denda';

export interface IBilling {
  userId: Types.ObjectId;
  idMeteran: Types.ObjectId;
  periode: Date;
  penggunaanSebelum: number;
  penggunaanSekarang: number;
  totalPemakaian: number;
  biaya: number;
  biayaBeban: number;
  totalBiaya: number;
  statusPembayaran?: StatusPembayaranBilling;
  tanggalPembayaran?: Date | null;
  metodePembayaran?: string | null;
  tenggatWaktu: Date;
  menunggak?: boolean;
  denda?: number;
  catatan?: string;
  // ── Merge tunggakan fields ───────────────────────────
  jenisBilling?: JenisBilling;        // 'normal' | 'denda'
  bulanCakupan?: number;              // default 1; merged billing = 2
  isMergedBilling?: boolean;          // true jika ini record gabungan
  mergedFromIds?: Types.ObjectId[];   // merged billing → pointer ke 2 record lama
  mergedIntoBillingId?: Types.ObjectId | null; // record lama → pointer ke merged billing
}

export interface IBillingDocument extends IBilling, Document {}

const billingSchema = new Schema<IBilling>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      required: true,
    },
    idMeteran: {
      type: Schema.Types.ObjectId,
      ref: 'Meteran',
      required: true,
    },
    periode: {
      type: Date,
      required: true,
    },
    penggunaanSebelum: {
      type: Number,
      required: true,
    },
    penggunaanSekarang: {
      type: Number,
      required: true,
    },
    totalPemakaian: {
      type: Number,
      required: true,
    },
    biaya: {
      type: Number,
      required: true,
    },
    biayaBeban: {
      type: Number,
      required: true,
    },
    totalBiaya: {
      type: Number,
      required: true,
    },
    statusPembayaran: {
      type: String,
      enum: ['Pending', 'Settlement', 'Cancel', 'Expire', 'Refund', 'Chargeback', 'Fraud', 'Merged'],
      default: 'Pending',
    },
    tanggalPembayaran: {
      type: Date,
      default: null,
    },
    metodePembayaran: {
      type: String,
      default: null,
    },
    tenggatWaktu: {
      type: Date,
      required: true,
    },
    menunggak: {
      type: Boolean,
      default: false,
    },
    denda: {
      type: Number,
      default: 0,
    },
    catatan: {
      type: String,
      default: '',
    },
    jenisBilling: {
      type: String,
      enum: ['normal', 'denda'],
      default: 'normal',
    },
    bulanCakupan: {
      type: Number,
      default: 1,
    },
    isMergedBilling: {
      type: Boolean,
      default: false,
    },
    mergedFromIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Tagihan',
      default: [],
    },
    mergedIntoBillingId: {
      type: Schema.Types.ObjectId,
      ref: 'Tagihan',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

billingSchema.index({ userId: 1, periode: 1 });
billingSchema.index({ idMeteran: 1, periode: 1 });
billingSchema.index({ statusPembayaran: 1, tenggatWaktu: 1 });

export default model<IBilling>('Tagihan', billingSchema);
