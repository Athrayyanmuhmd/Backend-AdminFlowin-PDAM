import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/PengawasanSetelahPemasangan.ts)
// Collection: pengawasansetelahpemasangans — shared across systems

export interface IPengawasanSetelahPemasangan {
  idPemasangan: Types.ObjectId;
  urlGambar?: string[] | null;
  catatan?: string | null;
  statusAdmin?: 'menunggu_review' | 'disetujui' | 'ditolak';
  catatanAdmin?: string | null;
}

export interface IPengawasanSetelahPemasanganDocument extends IPengawasanSetelahPemasangan, Document {}

const PengawasanSetelahPemasanganSchema = new Schema<IPengawasanSetelahPemasangan>(
  {
    idPemasangan: {
      type: Schema.Types.ObjectId,
      ref: 'Pemasangan',
      required: true,
    },
    urlGambar: {
      type: [String],
      default: null,
    },
    catatan: { type: String, default: null },
    statusAdmin: {
      type: String,
      enum: ['menunggu_review', 'disetujui', 'ditolak'],
      default: 'menunggu_review',
    },
    catatanAdmin: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'pengawasansetelahpemasangans',
  }
);

PengawasanSetelahPemasanganSchema.index({ idPemasangan: 1 });

export default model<IPengawasanSetelahPemasangan>(
  'PengawasanSetelahPemasangan',
  PengawasanSetelahPemasanganSchema
);
