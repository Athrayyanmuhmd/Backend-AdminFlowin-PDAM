import { Schema, model, Types, Document } from 'mongoose';

export interface IMeteran {
  idKelompokPelanggan: Types.ObjectId;
  idKoneksiData?: Types.ObjectId | null;
  nomorMeteran: string;
  nomorAkun: string;
  totalPemakaian?: number;
  /** Critical: incremented by IoT, decremented on payment — do NOT reset to 0 */
  pemakaianBelumTerbayar?: number;
  statusAktif?: boolean;
}

export interface IMeteranDocument extends IMeteran, Document {}

const MeteranSchema = new Schema<IMeteran>(
  {
    idKelompokPelanggan: {
      type: Schema.Types.ObjectId,
      ref: 'KelompokPelanggan',
      required: true,
    },
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'ConnectionData',
      default: null,
    },
    nomorMeteran: {
      type: String,
      required: true,
    },
    nomorAkun: {
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

export default model<IMeteran>('Meteran', MeteranSchema);
