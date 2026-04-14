import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/PenyelesaianLaporan.ts)
// Collection: penyelesaianlaporans — shared across systems

export interface IPenyelesaianLaporan {
  idLaporan: Types.ObjectId;
  urlGambar?: string[] | null;
  catatan?: string | null;
}

export interface IPenyelesaianLaporanDocument extends IPenyelesaianLaporan, Document {}

const PenyelesaianLaporanSchema = new Schema<IPenyelesaianLaporan>(
  {
    idLaporan: {
      type: Schema.Types.ObjectId,
      ref: 'Laporan',
      required: true,
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
    collection: 'penyelesaianlaporans',
  }
);

PenyelesaianLaporanSchema.index({ idLaporan: 1 });

export default model<IPenyelesaianLaporan>('PenyelesaianLaporan', PenyelesaianLaporanSchema);
