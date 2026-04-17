import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/Survey.ts)
// Collection: surveis — shared with Rafli
// jumlahPenghuni: Number (bukan String) — sesuai Rafli
// idTeknisi dihapus — tidak ada di ERD dan tidak ada di model Rafli

export interface ISurveyData {
  idKoneksiData: Types.ObjectId;
  koordinat?: {
    longitude?: number | null;
    latitude?: number | null;
  } | null;
  urlJaringan?: string | null;
  diameterPipa?: number | null;
  urlPosisiBak?: string | null;
  posisiMeteran?: string | null;
  jumlahPenghuni?: number | null;  // Number — sesuai Rafli (bukan String)
  standar?: boolean | null;
  catatan?: string | null;
  statusAdmin?: 'menunggu_review' | 'disetujui' | 'ditolak';
  catatanAdmin?: string | null;
  isDraft?: boolean;
}

export interface ISurveyDataDocument extends ISurveyData, Document {}

const SurveyDataSchema = new Schema<ISurveyData>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'KoneksiData',
      required: true,
      index: true,
    },
    koordinat: {
      type: new Schema(
        {
          longitude: { type: Number, default: null },
          latitude: { type: Number, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    urlJaringan: { type: String, default: null },
    diameterPipa: { type: Number, default: null },
    urlPosisiBak: { type: String, default: null },
    posisiMeteran: { type: String, default: null },
    jumlahPenghuni: { type: Number, default: null },
    standar: { type: Boolean, default: null },
    catatan: { type: String, default: null },
    statusAdmin: {
      type: String,
      enum: ['menunggu_review', 'disetujui', 'ditolak'],
      default: 'menunggu_review',
    },
    catatanAdmin: { type: String, default: null },
    isDraft: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'surveis',
    strict: false, // Rafli owns this collection — agar field Rafli yang belum didefinisikan tetap terbaca
  }
);

// Model name 'Survei' — sama dengan Rafli
export default model<ISurveyData>('Survei', SurveyDataSchema);
