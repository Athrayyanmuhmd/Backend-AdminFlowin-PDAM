import { Schema, model, Types, Document, Model } from 'mongoose';

export interface IPenyelesaianLaporan {
  idLaporan: Types.ObjectId;
  urlGambar: string[];
  catatan: string;
  teknisiId?: Types.ObjectId | null;
  tanggalSelesai?: Date;
  metadata?: {
    durasiPengerjaan?: number | null;
    materialDigunakan?: string[];
    biaya?: number;
  };
}

export interface IPenyelesaianLaporanDocument extends IPenyelesaianLaporan, Document {
  hasFotos(): boolean;
  getFotoCount(): number;
}

interface IPenyelesaianLaporanModel extends Model<IPenyelesaianLaporanDocument> {
  findByLaporan(laporanId: Types.ObjectId): any;
  findByTeknisi(teknisiId: Types.ObjectId): any;
  getStats(startDate?: Date, endDate?: Date): Promise<any>;
}

const PenyelesaianLaporanSchema = new Schema<IPenyelesaianLaporanDocument>(
  {
    idLaporan: { type: Schema.Types.ObjectId, ref: 'Laporan', required: true },
    urlGambar: {
      type: [String], default: [],
      validate: { validator: (v: string[]) => v && v.length > 0, message: 'Minimal 1 foto penyelesaian diperlukan' },
    },
    catatan: { type: String, required: true, trim: true, minlength: [10, 'Catatan minimal 10 karakter'] },
    teknisiId: { type: Schema.Types.ObjectId, ref: 'Teknisi', default: null },
    tanggalSelesai: { type: Date, default: Date.now },
    metadata: {
      durasiPengerjaan: { type: Number, default: null },
      materialDigunakan: { type: [String], default: [] },
      biaya: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'penyelesaianlaporans' }
);

PenyelesaianLaporanSchema.index({ idLaporan: 1 });
PenyelesaianLaporanSchema.index({ teknisiId: 1 });
PenyelesaianLaporanSchema.index({ tanggalSelesai: -1 });
PenyelesaianLaporanSchema.index({ createdAt: -1 });

PenyelesaianLaporanSchema.virtual('laporanDetails', { ref: 'Laporan', localField: 'idLaporan', foreignField: '_id', justOne: true });
PenyelesaianLaporanSchema.virtual('teknisiDetails', { ref: 'Teknisi', localField: 'teknisiId', foreignField: '_id', justOne: true });

PenyelesaianLaporanSchema.methods.hasFotos = function () { return this.urlGambar && this.urlGambar.length > 0; };
PenyelesaianLaporanSchema.methods.getFotoCount = function () { return this.urlGambar ? this.urlGambar.length : 0; };

PenyelesaianLaporanSchema.statics.findByLaporan = function (laporanId) {
  return this.findOne({ idLaporan: laporanId }).populate('teknisiDetails').populate('laporanDetails');
};
PenyelesaianLaporanSchema.statics.findByTeknisi = function (teknisiId) {
  return this.find({ teknisiId }).populate('laporanDetails').sort({ tanggalSelesai: -1 });
};
PenyelesaianLaporanSchema.statics.getStats = async function (startDate, endDate) {
  return await this.aggregate([
    { $match: { tanggalSelesai: { $gte: startDate || new Date(0), $lte: endDate || new Date() } } },
    { $group: { _id: null, totalResolutions: { $sum: 1 }, avgDuration: { $avg: '$metadata.durasiPengerjaan' }, totalCost: { $sum: '$metadata.biaya' }, totalPhotos: { $sum: { $size: '$urlGambar' } } } },
  ]);
};

PenyelesaianLaporanSchema.pre('save', function (next) {
  if (!this.urlGambar || this.urlGambar.length === 0) {
    next(new Error('Minimal 1 foto penyelesaian diperlukan'));
    return;
  }
  const invalidUrls = this.urlGambar.filter(url => { try { new URL(url); return false; } catch { return true; } });
  if (invalidUrls.length > 0) { next(new Error(`URL gambar tidak valid: ${invalidUrls.join(', ')}`)); } else { next(); }
});

export default model<IPenyelesaianLaporanDocument, IPenyelesaianLaporanModel>(
  'PenyelesaianLaporan', PenyelesaianLaporanSchema
);
