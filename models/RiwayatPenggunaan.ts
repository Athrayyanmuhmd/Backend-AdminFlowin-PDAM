import { Schema, model, Document } from 'mongoose';

/**
 * Collection: riwayatpenggunaans
 *
 * Menampung DUA tipe dokumen yang dibedakan via field `tanggal`:
 *
 * 1. Raw IoT record — ditulis oleh flowin-recieve-iot cron setelah 7 hari
 *    Field: MeterID, UserID, PenggunaanAir, timestamp
 *    Query: { MeterID, timestamp: { $gte, $lt } }
 *
 * 2. Daily aggregate — ditulis oleh BE_backend runIotSyncJob setiap jam (upsert)
 *    Field: MeterID, UserID, tanggal, totalPenggunaan, perJam, lastSyncAt
 *    Query: { MeterID, tanggal: { $gte, $lt } }
 *
 * Tidak ada tumpang-tindih: raw docs tidak punya `tanggal`,
 * daily aggregate docs tidak punya `timestamp`.
 */

export interface IRiwayatPenggunaan {
  // ── Raw IoT record (dari flowin-recieve-iot) ──────────────────────────────
  MeterID?: string;
  UserID?: string;
  PenggunaanAir?: number; // liter
  timestamp?: Date;

  // ── Daily aggregate (dari BE_backend runIotSyncJob) ───────────────────────
  tanggal?: string;           // YYYY-MM-DD (WIB) — discriminator tipe dokumen
  totalPenggunaan?: number;   // total liter hari itu
  perJam?: Map<string, number>; // { "08": 1500, "09": 1800, ... } liter per jam WIB
  lastSyncAt?: Date;
}

export interface IRiwayatPenggunaanDocument extends IRiwayatPenggunaan, Document {}

const RiwayatPenggunaanSchema = new Schema<IRiwayatPenggunaan>(
  {
    // ── Raw IoT record fields ─────────────────────────────────────────────────
    MeterID:        { type: String,  index: true },
    UserID:         { type: String },
    PenggunaanAir:  { type: Number,  min: 0 },
    timestamp:      { type: Date,    index: true },

    // ── Daily aggregate fields ────────────────────────────────────────────────
    tanggal:         { type: String },  // YYYY-MM-DD, sparse index di bawah
    totalPenggunaan: { type: Number,  min: 0, default: 0 },
    perJam:          { type: Map, of: Number, default: {} },
    lastSyncAt:      { type: Date },
  },
  {
    timestamps: true,
    collection: 'riwayatpenggunaans',
  }
);

// Query raw records (dari flowin)
RiwayatPenggunaanSchema.index({ MeterID: 1, timestamp: -1 });

// Query daily aggregate (dari BE_backend) — unique: satu dokumen per meteran per hari
RiwayatPenggunaanSchema.index(
  { MeterID: 1, tanggal: 1 },
  { unique: true, sparse: true }
);

export default model<IRiwayatPenggunaan>(
  'RiwayatPenggunaan',
  RiwayatPenggunaanSchema,
  'riwayatpenggunaans'
);
