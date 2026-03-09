import { Schema, model, Document } from 'mongoose';
import type { MongooseTimestamps } from '../types/index.js';

export type DivisiTeknisi = 'PerencanaanTeknik' | 'TeknikCabang' | 'PengawasanTeknik';

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
      enum: ['PerencanaanTeknik', 'TeknikCabang', 'PengawasanTeknik'],
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
    collection: 'teknisis',
  }
);

export default model<ITechnician>('Teknisi', TechnicianSchema);
