import mongoose, { Schema, model, Model, Document } from 'mongoose';

// Collection riwayatpenggunaans menampung DUA tipe dokumen (discriminator alami via field presence):
//
// 1. Raw IoT record  — dari flowin-recieve-iot (setelah 7 hari keluar dari Redis):
//    { MeterID, UserID, PenggunaanAir (liter), timestamp }
//
// 2. Daily aggregate — dari BE_backend runIotSyncJob (upsert tiap jam):
//    { MeterID, UserID, tanggal (YYYY-MM-DD), totalPenggunaan (liter), perJam, lastSyncAt }
//
// Discriminator: raw records punya `timestamp`, daily aggregate punya `tanggal`.

export interface IRiwayatPenggunaan {
  // ── Raw IoT record fields ──────────────────────────────────────────────
  MeterID?: string;
  UserID?: string;
  PenggunaanAir?: number;   // liter
  timestamp?: Date;

  // ── Daily aggregate fields ─────────────────────────────────────────────
  tanggal?: string;                  // YYYY-MM-DD (WIB)
  totalPenggunaan?: number;          // total liter hari tersebut
  perJam?: Map<string, number>;      // { "08": 1500, "09": 1800, ... }
  lastSyncAt?: Date;
}

export interface IRiwayatPenggunaanDocument extends IRiwayatPenggunaan, Document {}

const RiwayatPenggunaanSchema = new Schema<IRiwayatPenggunaan>(
  {
    // ── Raw IoT record fields ──────────────────────────────
    MeterID: { type: String, index: true },
    UserID: { type: String, index: true },
    PenggunaanAir: { type: Number, default: 0 },
    timestamp: { type: Date, index: true },

    // ── Daily aggregate fields ─────────────────────────────
    tanggal: {
      type: String,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'tanggal must be YYYY-MM-DD'],
      index: true,
    },
    totalPenggunaan: { type: Number, min: 0, default: 0 },
    perJam: { type: Map, of: Number, default: new Map() },
    lastSyncAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'riwayatpenggunaans',
  }
);

// Index untuk raw IoT records (flowin)
RiwayatPenggunaanSchema.index({ MeterID: 1, timestamp: -1 });
// Unique index untuk daily aggregate — tepat 1 doc per meteran per hari
RiwayatPenggunaanSchema.index({ MeterID: 1, tanggal: 1 }, { unique: true, sparse: true });

const MODEL_NAME = 'RiwayatPenggunaanBulanan';
export default (mongoose.models[MODEL_NAME] as Model<IRiwayatPenggunaan>)
  ?? model<IRiwayatPenggunaan>(MODEL_NAME, RiwayatPenggunaanSchema, 'riwayatpenggunaans');
