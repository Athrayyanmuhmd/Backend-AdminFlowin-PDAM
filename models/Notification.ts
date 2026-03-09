import { Schema, model, Types, Document } from 'mongoose';

export type KategoriNotif = 'Transaksi' | 'Informasi' | 'Peringatan';

export interface INotification {
  idAdmin?: Types.ObjectId | null;
  idTeknisi?: Types.ObjectId | null;
  idPelanggan?: Types.ObjectId | null;
  judul: string;
  pesan: string;
  kategori: KategoriNotif;
  link?: string | null;
  isRead?: boolean;
}

export interface INotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema<INotification>(
  {
    idAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'AdminAccount',
      default: null,
    },
    idTeknisi: {
      type: Schema.Types.ObjectId,
      ref: 'Teknisi',
      default: null,
    },
    idPelanggan: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      default: null,
    },
    judul: {
      type: String,
      required: true,
    },
    pesan: {
      type: String,
      required: true,
    },
    kategori: {
      type: String,
      enum: ['Transaksi', 'Informasi', 'Peringatan'],
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'notifikasis',
  }
);

// Indexes for notification polling (polled every 30s by admin panel)
NotificationSchema.index({ idAdmin: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ idTeknisi: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ idPelanggan: 1, isRead: 1, createdAt: -1 });

export default model<INotification>('Notifikasi', NotificationSchema);
