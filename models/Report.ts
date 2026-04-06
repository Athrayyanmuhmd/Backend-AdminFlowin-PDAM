import { Schema, model, Types, Document } from 'mongoose';

export type JenisLaporan =
  | 'AirTidakMengalir'
  | 'AirKeruh'
  | 'KebocoranPipa'
  | 'MeteranBermasalah'
  | 'KendalaLainnya';

export type StatusLaporan = 'Diajukan' | 'ProsesPerbaikan' | 'Selesai';

export interface IReport {
  idPengguna: Types.ObjectId;
  namaLaporan: string;
  masalah: string;
  alamat: string;
  imageUrl?: string[];
  jenisLaporan: JenisLaporan;
  catatan?: string | null;
  koordinat: {
    longitude: number;
    latitude: number;
  };
  status?: StatusLaporan;
}

export interface IReportDocument extends IReport, Document {}

const ReportSchema = new Schema<IReport>(
  {
    idPengguna: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: true },
    namaLaporan: { type: String, required: true },
    masalah: { type: String, required: true },
    alamat: { type: String, required: true },
    imageUrl: { type: [String], default: [] },
    jenisLaporan: {
      type: String,
      enum: ['AirTidakMengalir', 'AirKeruh', 'KebocoranPipa', 'MeteranBermasalah', 'KendalaLainnya'],
      required: true,
    },
    catatan: { type: String, default: null },
    koordinat: {
      longitude: { type: Number, required: true },
      latitude: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['Diajukan', 'ProsesPerbaikan', 'Selesai'],
      required: true,
      default: 'Diajukan',
    },
  },
  { timestamps: true }
);

export default model<IReport>('Laporan', ReportSchema);
