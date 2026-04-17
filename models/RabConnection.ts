import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/RAB.ts) & Rafli
// Collection: rabs — shared across systems
// statusPembayaran: lowercase — sesuai Ahmad EnumPaymentStatus & Rafli

export type StatusPembayaranRab =
  | 'pending'
  | 'settlement'
  | 'cancel'
  | 'expire'
  | 'refund'
  | 'chargeback'
  | 'fraud';

export interface IRabConnection {
  idKoneksiData: Types.ObjectId;
  totalBiaya?: number | null;
  statusPembayaran: StatusPembayaranRab;
  orderId?: string | null;     // Midtrans order ID
  paymentUrl?: string | null;  // Snap redirect URL
  urlRab?: string | null;
  catatan?: string | null;
  statusKonfirmasiPembayaran?: 'belum_dikonfirmasi' | 'dikonfirmasi';
  catatanKonfirmasi?: string | null;
}

export interface IRabConnectionDocument extends IRabConnection, Document {}

const RabConnectionSchema = new Schema<IRabConnection>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'KoneksiData',
      required: true,
      index: true,
    },
    totalBiaya: { type: Number, default: null },
    statusPembayaran: {
      type: String,
      enum: ['pending', 'settlement', 'cancel', 'expire', 'refund', 'chargeback', 'fraud'],
      default: 'pending',
    },
    orderId: { type: String, default: null },
    paymentUrl: { type: String, default: null },
    urlRab: { type: String, default: null },
    catatan: { type: String, default: null },
    statusKonfirmasiPembayaran: {
      type: String,
      enum: ['belum_dikonfirmasi', 'dikonfirmasi'],
      default: 'belum_dikonfirmasi',
    },
    catatanKonfirmasi: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'rabs',
  }
);

export default model<IRabConnection>('RAB', RabConnectionSchema);
