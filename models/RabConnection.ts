import { Schema, model, Types, Document } from 'mongoose';

export type StatusPembayaranRab =
  | 'Pending'
  | 'Settlement'
  | 'Cancel'
  | 'Expire'
  | 'Refund'
  | 'Chargeback'
  | 'Fraud';

export type StatusVerifikasiRab = 'Menunggu' | 'Disetujui' | 'Ditolak';

export interface IRabConnection {
  idKoneksiData: Types.ObjectId;
  totalBiaya: number;
  statusPembayaran?: StatusPembayaranRab;
  statusVerifikasiAdmin?: StatusVerifikasiRab;
  alasanPenolakan?: string | null;
  tanggalVerifikasiAdmin?: Date | null;
  urlRab: string;
  catatan?: string;
}

export interface IRabConnectionDocument extends IRabConnection, Document {}

const RabConnectionSchema = new Schema<IRabConnection>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'ConnectionData',
      required: true,
    },
    totalBiaya: { type: Number, required: true },
    statusPembayaran: {
      type: String,
      enum: ['Pending', 'Settlement', 'Cancel', 'Expire', 'Refund', 'Chargeback', 'Fraud'],
      default: 'Pending',
    },
    statusVerifikasiAdmin: {
      type: String,
      enum: ['Menunggu', 'Disetujui', 'Ditolak'],
      default: 'Menunggu',
    },
    alasanPenolakan: { type: String, default: null },
    tanggalVerifikasiAdmin: { type: Date, default: null },
    urlRab: { type: String, required: true },
    catatan: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'rabs',
  }
);

export default model<IRabConnection>('RabConnection', RabConnectionSchema);
