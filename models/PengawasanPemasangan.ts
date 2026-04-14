import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/PengawasanPemasangan.ts)
// Collection: pengawasanpemasangans — shared across systems
// Semua field opsional (default null)

export interface IPengawasanPemasangan {
  idPemasangan?: Types.ObjectId | null;
  urlGambar?: string[] | null;
  catatan?: string | null;
}

export interface IPengawasanPemasanganDocument extends IPengawasanPemasangan, Document {}

const PengawasanPemasanganSchema = new Schema<IPengawasanPemasangan>(
  {
    idPemasangan: {
      type: Schema.Types.ObjectId,
      ref: 'Pemasangan',
      default: null,
    },
    urlGambar: {
      type: [String],
      default: null,
    },
    catatan: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'pengawasanpemasangans',
  }
);

PengawasanPemasanganSchema.index({ idPemasangan: 1 });

export default model<IPengawasanPemasangan>('PengawasanPemasangan', PengawasanPemasanganSchema);
