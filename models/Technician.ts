import { Schema, model, Types, Document } from 'mongoose';
import type { MongooseTimestamps } from '../types/index.js';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/TeknisiPerumdam)
// Collection: teknisiperumdams — shared across systems

export type DivisiTeknisi = 'perencanaan_teknik' | 'teknik_cabang' | 'pengawasan_teknik';

export interface ITechnician extends MongooseTimestamps {
  namaLengkap: string;
  nip: string;
  email: string;
  noHp: string;
  divisi: DivisiTeknisi;
  password: string;
  pekerjaanSekarang?: Types.ObjectId | null;
  isActive?: boolean;
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
}

export interface ITechnicianDocument extends ITechnician, Document {}

const TechnicianSchema = new Schema<ITechnician>(
  {
    namaLengkap: {
      type: String,
      required: true,
    },
    nip: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    noHp: {
      type: String,
      required: true,
      unique: true,
    },
    divisi: {
      type: String,
      enum: ['perencanaan_teknik', 'teknik_cabang', 'pengawasan_teknik'],
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    pekerjaanSekarang: {
      type: Schema.Types.ObjectId,
      ref: 'PekerjaanTeknisi',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
      default: null,
    },
    accessToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'teknisiperumdams',
  }
);

export default model<ITechnician>('TeknisiPerumdam', TechnicianSchema);
