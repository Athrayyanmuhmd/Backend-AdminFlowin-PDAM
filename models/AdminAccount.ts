import { Schema, model, Document } from 'mongoose';
import type { MongooseTimestamps } from '../types/index.js';

export interface IAdminAccount extends MongooseTimestamps {
  NIP?: string;
  namaLengkap: string;
  email: string;
  password: string;
  noHP: string;
  token?: string;
  isActive: boolean;
}

export interface IAdminAccountDocument extends IAdminAccount, Document {}

const AdminAccountSchema = new Schema<IAdminAccount>(
  {
    NIP: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    namaLengkap: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    noHP: {
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, collection: 'admins' }
);

export default model<IAdminAccount>('AdminAccount', AdminAccountSchema);
