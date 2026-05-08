import { Schema, model, Document } from 'mongoose';

/**
 * AksesLog — mencatat setiap akses ke dokumen kredensial pelanggan (NIK, KK, IMB, RAB, Survei).
 * Digunakan untuk audit trail dan deteksi anomali (>20 akses/10 menit = alert ke admin).
 * Tidak ada PII di sini — hanya metadata akses.
 */
export interface IAksesLog {
  idAdmin: string;           // _id admin yang mengakses
  namaAdmin: string;         // nama admin untuk kemudahan audit tanpa join
  jenisDokumen: string;      // 'NIK' | 'KK' | 'IMB' | 'RAB' | 'SURVEI' | 'MULTIPLE'
  idPemilik: string;         // _id KoneksiData atau dokumen yang diakses
  namaOperasi: string;       // nama GraphQL operation (getKoneksiData, getWorkOrder, dll)
  ipAddress: string;
  userAgent?: string | null;
  createdAt?: Date;
}

export interface IAksesLogDocument extends IAksesLog, Document {}

const AksesLogSchema = new Schema<IAksesLog>(
  {
    idAdmin:       { type: String, required: true, index: true },
    namaAdmin:     { type: String, required: true },
    jenisDokumen:  { type: String, required: true },
    idPemilik:     { type: String, required: true },
    namaOperasi:   { type: String, required: true },
    ipAddress:     { type: String, required: true },
    userAgent:     { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'akseslogs',
    autoIndex: false, // nonaktif — jangan buat collection otomatis saat server start
  }
);

// Index untuk anomaly detection query: cari akses oleh admin X dalam N menit terakhir
AksesLogSchema.index({ idAdmin: 1, createdAt: -1 });
// Index untuk audit query: semua akses ke dokumen tertentu
AksesLogSchema.index({ idPemilik: 1, createdAt: -1 });

export default model<IAksesLog>('AksesLog', AksesLogSchema);
