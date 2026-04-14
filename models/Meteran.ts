import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/Meter.ts)
// Collection: meters — shared across systems
// Field names PascalCase agar sinkron dengan Ahmad

export interface IMeteran {
  // PascalCase FK — sesuai Ahmad
  IdKelompokPelanggan: Types.ObjectId;
  IdKoneksiData?: Types.ObjectId | null;
  NomorMeteran: string;
  NomorAkun: string;
  // Eksklusif admin — untuk billing & IoT tracking (tidak ada di Ahmad)
  totalPemakaian?: number;
  /** Critical: incremented by IoT, decremented on payment — do NOT reset to 0 */
  pemakaianBelumTerbayar?: number;
  statusAktif?: boolean;
}

export interface IMeteranDocument extends IMeteran, Document {}

const MeteranSchema = new Schema<IMeteran>(
  {
    IdKelompokPelanggan: {
      type: Schema.Types.ObjectId,
      ref: 'KelompokPelanggan',
      required: true,
      index: true,
    },
    IdKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'KoneksiData',
      default: null,
      index: true,
    },
    NomorMeteran: {
      type: String,
      required: true,
      unique: true,
    },
    NomorAkun: {
      type: String,
      required: true,
      unique: true,
    },
    totalPemakaian: {
      type: Number,
      default: 0,
    },
    pemakaianBelumTerbayar: {
      type: Number,
      default: 0,
    },
    statusAktif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'meters',
  }
);

MeteranSchema.index({ statusAktif: 1 });

export default model<IMeteran>('Meteran', MeteranSchema);
