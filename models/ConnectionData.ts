import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/KoneksiData.ts) & Rafli (DataConnection.ts)
// Collection: koneksidatas — shared across all three systems
// Field names PascalCase untuk FK agar sinkron dengan Ahmad & Rafli

export type StatusPengajuan = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IConnectionData {
  IdPelanggan: Types.ObjectId;
  StatusPengajuan: StatusPengajuan;
  AlasanPenolakan?: string | null;
  TanggalVerifikasi?: Date | null;
  NIK: string;
  NIKUrl?: string | null;
  NoKK: string;
  KKUrl?: string | null;
  IMB: string;
  IMBUrl?: string | null;
  Alamat: string;
  Kelurahan: string;
  Kecamatan: string;
  LuasBangunan: number;
  // Field eksklusif admin (tidak ada di Ahmad/Rafli)
  catatan?: string | null;
}

export interface IConnectionDataDocument extends IConnectionData, Document {}

const KoneksiDataSchema = new Schema<IConnectionData>(
  {
    IdPelanggan: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      required: [true, 'ID Pelanggan wajib diisi'],
      index: true,
    },
    StatusPengajuan: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    AlasanPenolakan: { type: String, default: null },
    TanggalVerifikasi: { type: Date, default: null },
    NIK: {
      type: String,
      required: [true, 'NIK wajib diisi'],
      unique: true,
      trim: true,
    },
    NIKUrl: { type: String, default: null },
    NoKK: { type: String, required: [true, 'No KK wajib diisi'], trim: true },
    KKUrl: { type: String, default: null },
    IMB: { type: String, required: [true, 'IMB wajib diisi'], trim: true },
    IMBUrl: { type: String, default: null },
    Alamat: { type: String, required: [true, 'Alamat wajib diisi'] },
    Kelurahan: { type: String, required: [true, 'Kelurahan wajib diisi'] },
    Kecamatan: { type: String, required: [true, 'Kecamatan wajib diisi'] },
    LuasBangunan: { type: Number, required: [true, 'Luas Bangunan wajib diisi'] },
    catatan: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'koneksidatas',
    strict: false, // Agar field format lama (camelCase dari Ahmad) bisa dibaca
  }
);

KoneksiDataSchema.index({ StatusPengajuan: 1, createdAt: -1 });

// Model name 'KoneksiData' — sama dengan Ahmad & Rafli
export default model<IConnectionData>('KoneksiData', KoneksiDataSchema);
