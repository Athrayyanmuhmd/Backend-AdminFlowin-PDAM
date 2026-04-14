import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/Notifikasi.ts)
// Collection: notifikasis — shared across systems
// Field names PascalCase agar sinkron dengan Ahmad
// Admin uses superset enum: PEMBAYARAN, INFORMASI, PERINGATAN

export type KategoriNotifikasi = 'PEMBAYARAN' | 'INFORMASI' | 'PERINGATAN';

export interface INotification {
  IdPelanggan?: Types.ObjectId | null;
  IdAdmin?: Types.ObjectId | null;
  IdTeknisi?: Types.ObjectId | null;
  Judul: string;
  Pesan: string;
  Kategori: KategoriNotifikasi;
  Link?: string | null;
  isRead: boolean;
}

export interface INotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema<INotification>(
  {
    IdPelanggan: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      default: null,
    },
    IdAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'AdminAccount',
      default: null,
    },
    IdTeknisi: {
      type: Schema.Types.ObjectId,
      ref: 'TeknisiPerumdam',
      default: null,
    },
    Judul: {
      type: String,
      required: true,
    },
    Pesan: {
      type: String,
      required: true,
    },
    Kategori: {
      type: String,
      enum: ['PEMBAYARAN', 'INFORMASI', 'PERINGATAN'],
      required: true,
    },
    Link: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ IdAdmin: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ IdTeknisi: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ IdPelanggan: 1, isRead: 1, createdAt: -1 });

export default model<INotification>('Notifikasi', NotificationSchema, 'notifikasis');
