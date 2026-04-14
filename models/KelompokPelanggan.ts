import { Schema, model, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/KelompokPelanggan.ts)
// Collection: kelompokpelanggans — shared across systems
// Field names PascalCase agar sinkron dengan Ahmad

export type KodeKelompokEnum =
  | 'SOS-U' | 'SOS-K'
  | 'RT-1' | 'RT-2' | 'RT-3' | 'RT-4'
  | 'N-1' | 'N-2' | 'N-3'
  | 'IP' | 'KH';

export type KategoriKelompokEnum =
  | 'Sosial' | 'Non Niaga' | 'Niaga' | 'Instansi Pemerintah' | 'Khusus';

export interface IKelompokPelanggan {
  KodeKelompok: KodeKelompokEnum;
  NamaKelompok: string;
  Kategori: KategoriKelompokEnum;
  Deskripsi?: string;
  TarifRendah: number;
  TarifTinggi: number;
  BatasRendah?: number;
  BiayaBeban: number;
  IsKesepakatan?: boolean;
}

export interface IKelompokPelangganDocument extends IKelompokPelanggan, Document {}

const KelompokPelangganSchema = new Schema<IKelompokPelanggan>(
  {
    KodeKelompok: {
      type: String,
      enum: ['SOS-U', 'SOS-K', 'RT-1', 'RT-2', 'RT-3', 'RT-4', 'N-1', 'N-2', 'N-3', 'IP', 'KH'],
      required: true,
      unique: true,
    },
    NamaKelompok: {
      type: String,
      required: true,
    },
    Kategori: {
      type: String,
      enum: ['Sosial', 'Non Niaga', 'Niaga', 'Instansi Pemerintah', 'Khusus'],
      required: true,
    },
    Deskripsi: {
      type: String,
      default: '',
    },
    TarifRendah: {
      type: Number,
      required: true,
    },
    TarifTinggi: {
      type: Number,
      required: true,
    },
    BatasRendah: {
      type: Number,
      default: 10,
    },
    BiayaBeban: {
      type: Number,
      required: true,
    },
    IsKesepakatan: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'kelompokpelanggans',
  }
);

export default model<IKelompokPelanggan>('KelompokPelanggan', KelompokPelangganSchema);
