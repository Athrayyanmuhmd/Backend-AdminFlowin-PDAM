import { Schema, model, Types, Document } from 'mongoose';

// Disesuaikan dengan Ahmad (flowin-backend/Laporan.ts)
// Collection: laporans — shared across systems
// Field names PascalCase agar sinkron dengan Ahmad

export type JenisLaporan =
  | 'AirTidakMengalir'
  | 'AirKeruh'
  | 'KebocoranPipa'
  | 'MeteranBermasalah'
  | 'KendalaLainnya';

export type StatusLaporan =
  | 'Diajukan'
  | 'Ditunda'
  | 'Ditugaskan'
  | 'DitinjauAdmin'
  | 'SedangDikerjakan'
  | 'Selesai'
  | 'Dibatalkan';

export interface IReport {
  IdPengguna: Types.ObjectId;
  NamaLaporan: string;
  Masalah: string;
  Alamat: string;
  ImageURL?: string[];
  JenisLaporan: JenisLaporan;
  Catatan?: string | null;
  Koordinat?: Types.ObjectId | null;
  Status: StatusLaporan;
  IdTeknisi?: Types.ObjectId | null; // teknisi yang ditugaskan (Rafli's teknisiperumdams)
  CatatanAdmin?: string | null;       // catatan admin saat menugaskan
}

export interface IReportDocument extends IReport, Document {}

const ReportSchema = new Schema<IReport>(
  {
    IdPengguna: {
      type: Schema.Types.ObjectId,
      ref: 'Pengguna',
      required: true,
    },
    NamaLaporan: {
      type: String,
      required: true,
    },
    Masalah: {
      type: String,
      required: true,
    },
    Alamat: {
      type: String,
      required: true,
    },
    ImageURL: {
      type: [String],
      default: [],
    },
    JenisLaporan: {
      type: String,
      enum: ['AirTidakMengalir', 'AirKeruh', 'KebocoranPipa', 'MeteranBermasalah', 'KendalaLainnya'],
      required: true,
    },
    Catatan: {
      type: String,
      default: null,
    },
    Koordinat: {
      type: Schema.Types.ObjectId,
      ref: 'GeoLokasi',
      default: null,
    },
    IdTeknisi: {
      type: Schema.Types.ObjectId,
      ref: 'TeknisiPerumdam',
      default: null,
    },
    CatatanAdmin: {
      type: String,
      default: null,
    },
    Status: {
      type: String,
      enum: ['Diajukan', 'Ditunda', 'Ditugaskan', 'DitinjauAdmin', 'SedangDikerjakan', 'Selesai', 'Dibatalkan'],
      required: true,
      default: 'Diajukan',
    },
  },
  { timestamps: true }
);

ReportSchema.index({ IdPengguna: 1 });
ReportSchema.index({ Status: 1 });
ReportSchema.index({ JenisLaporan: 1 });

export default model<IReport>('Laporan', ReportSchema);
