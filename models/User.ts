import { Schema, model, Types, Document } from 'mongoose';
import type { MongooseTimestamps } from '../types/index.js';

export interface IUser extends MongooseTimestamps {
  email: string;
  namaLengkap: string;
  noHP?: string | null;
  nik?: string | null;
  address?: string | null;
  gender?: 'L' | 'P' | null;
  birthDate?: string | null;
  occupation?: string | null;
  location?: any;
  customerType?: 'rumah_tangga' | 'komersial' | 'industri' | 'sosial';
  accountStatus?: 'active' | 'inactive' | 'suspended';
  password?: string | null;
  token?: string | null;
  // Legacy IoT fields — do NOT remove
  SambunganDataId?: Types.ObjectId | null;
  meteranId?: Types.ObjectId | null;
  iotConnectionId?: Types.ObjectId | null;
  isIoTConnected?: boolean;
  isVerified?: boolean;
  // Ahmad fields — Google Auth
  googleId?: string | null;
  profilePicture?: string | null;
  authProvider?: 'email' | 'google';
}

export interface IUserDocument extends IUser, Document {}

const UsersSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    namaLengkap: {
      type: String,
      required: true,
    },
    noHP: {
      type: String,
      default: null,
    },
    nik: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    address: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ['L', 'P', null],
    },
    birthDate: {
      type: String,
    },
    occupation: {
      type: String,
    },
    location: {
      type: Schema.Types.Mixed,
    },
    customerType: {
      type: String,
      // null diperbolehkan: admin bisa biarkan "Belum Ditentukan" sampai survei selesai.
      // Default sengaja tidak di-set ke 'rumah_tangga' agar tidak auto-klasifikasi
      // yang rawan salah (UX risk).
      enum: ['rumah_tangga', 'komersial', 'industri', 'sosial', null],
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'inactive',
    },
    password: {
      type: String,
      default: null,
    },
    token: {
      type: String,
      default: null,
    },
    SambunganDataId: {
      type: Schema.Types.ObjectId,
      ref: 'KoneksiData',
    },
    meteranId: {
      type: Schema.Types.ObjectId,
      ref: 'Meteran',
    },
    iotConnectionId: {
      type: Schema.Types.ObjectId,
      ref: 'IoTConnection',
    },
    isIoTConnected: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
  },
  {
    timestamps: true,
    collection: 'penggunas',
  }
);

export default model<IUser>('Pengguna', UsersSchema);
