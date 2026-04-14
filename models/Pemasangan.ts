import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/Pemasangan.ts)
// Collection: pemasangans — shared across systems
// Semua field opsional kecuali idKoneksiData

export interface IPemasangan {
  idKoneksiData: Types.ObjectId;
  seriMeteran?: string | null;
  fotoRumah?: string | null;
  fotoMeteran?: string | null;
  fotoMeteranDanRumah?: string | null;
  catatan?: string | null;
}

export interface IPemasanganDocument extends IPemasangan, Document {}

const PemasanganSchema = new Schema<IPemasangan>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'KoneksiData',
      required: true,
    },
    seriMeteran: {
      type: String,
      default: null,
    },
    fotoRumah: {
      type: String,
      default: null,
    },
    fotoMeteran: {
      type: String,
      default: null,
    },
    fotoMeteranDanRumah: {
      type: String,
      default: null,
    },
    catatan: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'pemasangans',
  }
);

PemasanganSchema.index({ idKoneksiData: 1 });

export default model<IPemasangan>('Pemasangan', PemasanganSchema);
