import { Schema, model, Types, Document } from 'mongoose';

export type StatusSurvei = 'Menunggu' | 'Disetujui' | 'Ditolak';

export interface ISurveyData {
  idKoneksiData: Types.ObjectId;
  idTeknisi: Types.ObjectId;
  urlJaringan: string;
  diameterPipa: number;
  urlPosisiBak: string;
  posisiMeteran: string;
  jumlahPenghuni: string;
  koordinat?: {
    latitude?: number | null;
    longitude?: number | null;
  };
  standar: boolean;
  catatan?: string;
  statusSurvei?: StatusSurvei;
  alasanPenolakan?: string | null;
  tanggalVerifikasiAdmin?: Date | null;
}

export interface ISurveyDataDocument extends ISurveyData, Document {}

const SurveyDataSchema = new Schema<ISurveyData>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'ConnectionData',
      required: true,
    },
    idTeknisi: {
      type: Schema.Types.ObjectId,
      ref: 'Teknisi',
      required: true,
    },
    urlJaringan: { type: String, required: true },
    diameterPipa: { type: Number, required: true },
    urlPosisiBak: { type: String, required: true },
    posisiMeteran: { type: String, required: true },
    jumlahPenghuni: { type: String, required: true },
    koordinat: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    standar: { type: Boolean, required: true },
    catatan: { type: String, default: '' },
    statusSurvei: {
      type: String,
      enum: ['Menunggu', 'Disetujui', 'Ditolak'],
      default: 'Menunggu',
    },
    alasanPenolakan: { type: String, default: null },
    tanggalVerifikasiAdmin: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'surveis',
  }
);

export default model<ISurveyData>('SurveyData', SurveyDataSchema);
