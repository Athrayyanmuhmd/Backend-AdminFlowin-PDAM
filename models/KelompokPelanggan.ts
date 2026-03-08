import { Schema, model, Document } from 'mongoose';

export interface IKelompokPelanggan {
  namaKelompok: string;
  hargaDiBawah10mKubik: number;
  hargaDiAtas10mKubik: number;
  biayaBeban?: number | null;
}

export interface IKelompokPelangganDocument extends IKelompokPelanggan, Document {}

const KelompokPelangganSchema = new Schema<IKelompokPelanggan>(
  {
    namaKelompok: {
      type: String,
      required: true,
    },
    hargaDiBawah10mKubik: {
      type: Number,
      required: true,
    },
    hargaDiAtas10mKubik: {
      type: Number,
      required: true,
    },
    biayaBeban: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'kelompokpelanggans',
  }
);

export default model<IKelompokPelanggan>('KelompokPelanggan', KelompokPelangganSchema);
