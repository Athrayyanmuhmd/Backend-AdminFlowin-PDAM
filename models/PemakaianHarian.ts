import { Schema, model, Types, Document } from 'mongoose';

export interface IPemakaianHarian {
  idMeteran: Types.ObjectId;
  /** UTC midnight date — diinterpretasikan sebagai tanggal WIB (YYYY-MM-DD) */
  tanggal: Date;
  /** Total pemakaian hari itu dalam liter (sebelum dibagi 1000) */
  totalLiter: number;
  /** Jumlah push IoT yang masuk hari itu */
  jumlahEntry: number;
}

export interface IPemakaianHarianDocument extends IPemakaianHarian, Document {}

const PemakaianHarianSchema = new Schema<IPemakaianHarian>(
  {
    idMeteran: {
      type: Schema.Types.ObjectId,
      ref: 'Meteran',
      required: true,
    },
    tanggal: {
      type: Date,
      required: true,
    },
    totalLiter: {
      type: Number,
      default: 0,
    },
    jumlahEntry: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: false,
    collection: 'pemakaianharianS',
  }
);

// Compound unique: satu dokumen per meteran per hari
PemakaianHarianSchema.index({ idMeteran: 1, tanggal: 1 }, { unique: true });
// Index untuk query bulan tertentu
PemakaianHarianSchema.index({ idMeteran: 1, tanggal: -1 });

export default model<IPemakaianHarian>('PemakaianHarian', PemakaianHarianSchema);
