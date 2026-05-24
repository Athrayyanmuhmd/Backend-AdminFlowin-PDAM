import mongoose, { Schema, model, Model, Types, Document } from 'mongoose';

// Schema untuk collection riwayatpenggunaans
// Mendukung DUA tipe dokumen:
// 1. Raw IoT record — dari flowin-recieve-iot (cron migrate): { MeterID, UserID, PenggunaanAir, timestamp }
// 2. Aggregated monthly — { MeteranId, Periode, TotalPenggunaan, DataHarian, DataPerJam }
//
// Semua field optional karena dokumen hanya punya salah satu tipe

export interface IRiwayatPenggunaan {
  // Raw IoT record fields (dari flowin-recieve-iot cron)
  MeterID?: string;
  UserID?: string;
  PenggunaanAir?: number;
  timestamp?: Date;

  // Aggregated monthly fields (untuk monitoring lengkap)
  MeteranId?: Types.ObjectId;
  Periode?: string;               // Format: "YYYY-MM"
  TotalPenggunaan?: number;       // Total liter dalam bulan
  DataHarian?: Map<string, number>;   // { "01": 45.7, "02": 38.2, ... }
  DataPerJam?: Map<string, number>;   // { "01-08": 5.3, "01-09": 4.1, ... }
}

export interface IRiwayatPenggunaanDocument extends IRiwayatPenggunaan, Document {}

const RiwayatPenggunaanSchema = new Schema<IRiwayatPenggunaan>(
  {
    // ── Raw IoT record fields ──────────────────────────────
    MeterID: {
      type: String,
      index: true,
    },
    UserID: {
      type: String,
      index: true,
    },
    PenggunaanAir: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      index: true,
    },

    // ── Aggregated monthly fields ────────────────────────────
    MeteranId: {
      type: Schema.Types.ObjectId,
      ref: 'Meteran',
      index: true,
    },
    Periode: {
      type: String,
      match: [/^\d{4}-\d{2}$/, 'Periode must be in YYYY-MM format'],
      index: true,
    },
    TotalPenggunaan: {
      type: Number,
      min: 0,
      default: 0,
    },
    DataHarian: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    DataPerJam: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    collection: 'riwayatpenggunaans',
  }
);

// Compound index untuk aggregated data
RiwayatPenggunaanSchema.index({ MeteranId: 1, Periode: -1 });
RiwayatPenggunaanSchema.index({ MeteranId: 1, Periode: 1 }, { unique: true, sparse: true });
// Index untuk raw IoT records
RiwayatPenggunaanSchema.index({ MeterID: 1, timestamp: -1 });

const MODEL_NAME = 'RiwayatPenggunaanBulanan';
export default (mongoose.models[MODEL_NAME] as Model<IRiwayatPenggunaan>) ?? model<IRiwayatPenggunaan>(MODEL_NAME, RiwayatPenggunaanSchema, 'riwayatpenggunaans');
