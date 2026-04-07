import { Schema, model, Types, Document } from 'mongoose';

export type StatusVerifikasiKoneksi = 'Menunggu' | 'Disetujui' | 'Ditolak';

export interface IConnectionData {
  idPelanggan?: Types.ObjectId | null;
  statusVerifikasi?: StatusVerifikasiKoneksi;
  NIK?: string | null;
  NIKUrl?: string | null;
  noKK?: string | null;
  KKUrl?: string | null;
  IMB?: string | null;
  IMBUrl?: string | null;
  alamat?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  luasBangunan?: number | null;
  catatan?: string | null;
  alasanPenolakan?: string | null;
  tanggalVerifikasi?: Date | null;
  idTeknisi?: Types.ObjectId | null;
  assignedAt?: Date | null;
  assignedBy?: Types.ObjectId | null;
  isVerifiedByTeknisi?: boolean;
  catatanTeknisi?: string | null;
  tanggalVerifikasiTeknisi?: Date | null;
  idTeknisiDED?: Types.ObjectId | null;
  assignedDEDAt?: Date | null;
  assignedDEDBy?: Types.ObjectId | null;
}

export interface IConnectionDataDocument extends IConnectionData, Document {}

const KoneksiDataSchema = new Schema<IConnectionData>(
  {
    idPelanggan: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      default: null,
    },
    statusVerifikasi: {
      type: String,
      enum: ['Menunggu', 'Disetujui', 'Ditolak'],
      default: 'Menunggu',
    },
    NIK: { type: String, default: null },
    NIKUrl: { type: String, default: null },
    noKK: { type: String, default: null },
    KKUrl: { type: String, default: null },
    IMB: { type: String, default: null },
    IMBUrl: { type: String, default: null },
    alamat: { type: String, default: null },
    kelurahan: { type: String, default: null },
    kecamatan: { type: String, default: null },
    luasBangunan: { type: Number, default: null },
    catatan: { type: String, default: null },
    alasanPenolakan: { type: String, default: null },
    tanggalVerifikasi: { type: Date, default: null },
    idTeknisi: {
      type: Schema.Types.ObjectId,
      ref: 'Teknisi',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'AdminAccount',
      default: null,
    },
    isVerifiedByTeknisi: { type: Boolean, default: false },
    catatanTeknisi: { type: String, default: null },
    tanggalVerifikasiTeknisi: { type: Date, default: null },
    idTeknisiDED: { type: Schema.Types.ObjectId, ref: 'Teknisi', default: null },
    assignedDEDAt: { type: Date, default: null },
    assignedDEDBy: { type: Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
  },
  {
    timestamps: true,
    collection: 'koneksidatas',
  }
);

KoneksiDataSchema.index({ idPelanggan: 1 });
KoneksiDataSchema.index({ statusVerifikasi: 1, createdAt: -1 });
KoneksiDataSchema.index({ idTeknisi: 1 });

export default model<IConnectionData>('ConnectionData', KoneksiDataSchema);
