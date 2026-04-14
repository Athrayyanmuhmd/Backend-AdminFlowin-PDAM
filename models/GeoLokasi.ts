import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/GeoLokasi.ts)
// Collection: geolokasis — shared across systems
// Ahmad: IdLaporan (required, ref Laporan), Latitude, Longitude

export interface IGeoLokasi {
  IdLaporan: Types.ObjectId;
  Latitude: number;
  Longitude: number;
}

export interface IGeoLokasiDocument extends IGeoLokasi, Document {}

const GeoLokasiSchema = new Schema<IGeoLokasi>(
  {
    IdLaporan: {
      type: Schema.Types.ObjectId,
      ref: 'Laporan',
      required: true,
      index: true,
    },
    Latitude: {
      type: Number,
      required: true,
    },
    Longitude: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default model<IGeoLokasi>('GeoLokasi', GeoLokasiSchema, 'geolokasis');
