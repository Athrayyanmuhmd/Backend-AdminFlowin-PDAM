import { Schema, model, Document } from 'mongoose';
import type { MongooseTimestamps } from '../types/index.js';

export type DivisiTeknisi = 'perencanaan_teknik' | 'teknik_cabang' | 'pengawasan_teknik';

export interface ITechnician extends MongooseTimestamps {
  namaLengkap: string;
  NIP?: string | null;
  email: string;
  noHP: string;
  divisi?: DivisiTeknisi | null;
  password: string;
  token?: string | null;
}

export interface ITechnicianDocument extends ITechnician, Document {}

const TechnicianSchema = new Schema<ITechnician>(
  {
    namaLengkap: {
      type: String,
      required: true,
    },
    NIP: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    noHP: {
      type: String,
      required: true,
      unique: true,
    },
    divisi: {
      type: String,
      enum: ['perencanaan_teknik', 'teknik_cabang', 'pengawasan_teknik'],
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'teknisiperumdams',
  }
);

export default model<ITechnician>('Teknisi', TechnicianSchema);
