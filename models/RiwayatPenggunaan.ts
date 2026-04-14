import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/RiwayatPenggunaan.ts)
// Collection: riwayatpenggunaans — shared across systems
// Ahmad mengisi collection ini tiap akhir bulan dari Redis data IoT

export interface IRiwayatPenggunaan {
  MeteranId: Types.ObjectId; // ref: Meter (Ahmad's collection)
  Periode: string;            // Format: "YYYY-MM"
  TotalPenggunaan: number;    // Total liter dalam bulan
  DataHarian: Map<string, number>;  // { "01": 45.7, "02": 38.2, ... }
  DataPerJam: Map<string, number>;  // { "01-08": 5.3, "01-09": 4.1, ... }
}

export interface IRiwayatPenggunaanDocument extends IRiwayatPenggunaan, Document {}

const RiwayatPenggunaanSchema = new Schema<IRiwayatPenggunaan>(
  {
    MeteranId: {
      type: Schema.Types.ObjectId,
      ref: 'Meter', // Ahmad's Meter model (collection: meters)
      required: true,
      index: true,
    },
    Periode: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Periode must be in YYYY-MM format'],
      index: true,
    },
    TotalPenggunaan: {
      type: Number,
      required: true,
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
    collection: 'riwayatpenggunaans', // Ahmad's collection name
  }
);

// Compound index — satu record per meteran per bulan
RiwayatPenggunaanSchema.index({ MeteranId: 1, Periode: -1 });
RiwayatPenggunaanSchema.index({ MeteranId: 1, Periode: 1 }, { unique: true });

export default model<IRiwayatPenggunaan>('RiwayatPenggunaanBulanan', RiwayatPenggunaanSchema, 'riwayatpenggunaans');
