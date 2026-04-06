import { Schema, model, Types, Document } from 'mongoose';

export interface IGeolocation {
  idLaporan: Types.ObjectId;
  longitude: number;
  latitude: number;
}

export interface IGeolocationDocument extends IGeolocation, Document {}

const GeolocationSchema = new Schema<IGeolocation>(
  {
    idLaporan: { type: Schema.Types.ObjectId, ref: 'Laporan', required: true },
    longitude: { type: Number, required: true },
    latitude: { type: Number, required: true },
  },
  {
    timestamps: true,
    collection: 'geolokasis',
  }
);

GeolocationSchema.index({ idLaporan: 1 });

export default model<IGeolocation>('Geolocation', GeolocationSchema);
