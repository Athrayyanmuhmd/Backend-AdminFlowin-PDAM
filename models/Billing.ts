import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/Tagihan.ts)
// Collection: tagihans — shared across systems
// Field names PascalCase agar sinkron dengan Ahmad

// Lowercase enum values — sesuai Ahmad (flowin-backend/Tagihan.ts)
export type StatusPembayaranBilling =
  | 'pending'
  | 'settlement'
  | 'cancel'
  | 'expire'
  | 'refund'
  | 'chargeback'
  | 'fraud'
  | 'merged'; // Admin-only: record lama yang sudah digabung

export type JenisBilling = 'normal' | 'denda';

export interface IBilling {
  // Eksklusif admin — untuk query "tagihan per user"
  userId?: Types.ObjectId | null;
  // PascalCase FK — sesuai Ahmad
  IdMeteran: Types.ObjectId;
  // Ahmad: Periode = String "YYYY-MM"
  Periode: string;
  PenggunaanSebelum: number;
  PenggunaanSekarang: number;
  TotalPemakaian: number;
  Biaya: number;
  // Eksklusif admin (tidak ada di Ahmad)
  BiayaBeban: number;
  TotalBiaya: number;
  StatusPembayaran: StatusPembayaranBilling;
  TanggalPembayaran?: Date | null;
  MetodePembayaran?: string | null;
  TenggatWaktu: Date;
  Menunggak: boolean;
  Denda: number;
  // Admin extras
  Catatan?: string;
  jenisBilling?: JenisBilling;
  bulanCakupan?: number;
  isMergedBilling?: boolean;
  mergedFromIds?: Types.ObjectId[];
  mergedIntoBillingId?: Types.ObjectId | null;
  PeriodeAkhir?: string | null;
  // Midtrans payment fields — sesuai Ahmad (ITagihan)
  MidtransOrderId?: string | null;
  SnapToken?: string | null;
  SnapRedirectUrl?: string | null;
}

export interface IBillingDocument extends IBilling, Document {}

const billingSchema = new Schema<IBilling>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      default: null,
    },
    IdMeteran: {
      type: Schema.Types.ObjectId,
      ref: 'Meteran',
      required: true,
      index: true,
    },
    Periode: {
      type: String,
      required: true,
    },
    PenggunaanSebelum: {
      type: Number,
      required: true,
    },
    PenggunaanSekarang: {
      type: Number,
      required: true,
    },
    TotalPemakaian: {
      type: Number,
      required: true,
    },
    Biaya: {
      type: Number,
      required: true,
    },
    BiayaBeban: {
      type: Number,
      required: true,
    },
    TotalBiaya: {
      type: Number,
      required: true,
    },
    StatusPembayaran: {
      type: String,
      enum: ['pending', 'settlement', 'cancel', 'expire', 'refund', 'chargeback', 'fraud', 'merged'],
      default: 'pending',
    },
    TanggalPembayaran: {
      type: Date,
      default: null,
    },
    MetodePembayaran: {
      type: String,
      default: null,
    },
    TenggatWaktu: {
      type: Date,
      required: true,
    },
    Menunggak: {
      type: Boolean,
      default: false,
    },
    Denda: {
      type: Number,
      default: 0,
    },
    Catatan: {
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
      default: [],
    },
    mergedIntoBillingId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    PeriodeAkhir: { type: String, default: null },
    MidtransOrderId: { type: String, default: null },
    SnapToken: { type: String, default: null },
    SnapRedirectUrl: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'tagihans',
  }
);

billingSchema.index({ userId: 1, Periode: 1 });
billingSchema.index({ IdMeteran: 1, Periode: 1 });
billingSchema.index({ StatusPembayaran: 1, TenggatWaktu: 1 });
billingSchema.index({ Menunggak: 1 });
// Query sering: cari pending per user (pemutusan, pembayaran) dan per meteran
billingSchema.index({ userId: 1, StatusPembayaran: 1 });
billingSchema.index({ IdMeteran: 1, StatusPembayaran: 1 });

export default model<IBilling>('Tagihan', billingSchema);
