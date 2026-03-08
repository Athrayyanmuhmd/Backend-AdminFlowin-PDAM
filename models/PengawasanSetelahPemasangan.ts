import { Schema, model, Types, Document, Model } from 'mongoose';

export type HasilPengawasanSetelah = 'Baik' | 'Perlu Perbaikan' | 'Bermasalah';
export type StatusMeteran = 'Berfungsi Normal' | 'Bermasalah' | 'Perlu Kalibrasi';

export interface IPengawasanSetelahPemasangan {
  idPemasangan: Types.ObjectId;
  urlGambar: string[];
  catatan: string;
  supervisorId: Types.ObjectId;
  tanggalPengawasan?: Date;
  hariSetelahPemasangan?: number | null;
  hasilPengawasan: HasilPengawasanSetelah;
  statusMeteran?: StatusMeteran;
  bacaanAwal?: number;
  masalahDitemukan?: string[];
  tindakan?: string;
  rekomendasi?: string;
  perluTindakLanjut?: boolean;
  checklist?: {
    meteranBacaCorrect?: boolean;
    tidakAdaKebocoran?: boolean;
    sambunganAman?: boolean;
    mudahDibaca?: boolean;
    pelangganPuas?: boolean;
    dokumentasiLengkap?: boolean;
  };
  feedbackPelanggan?: {
    rating?: number | null;
    komentar?: string;
  };
}

export interface IPengawasanSetelahPemasanganDocument extends IPengawasanSetelahPemasangan, Document {
  isOK(): boolean;
  hasIssues(): boolean;
  needsFollowUp(): boolean;
  getAllChecksPassed(): boolean;
  getCustomerRating(): number | null;
}

interface IPengawasanSetelahPemasanganModel extends Model<IPengawasanSetelahPemasanganDocument> {
  findByPemasangan(pemasanganId: Types.ObjectId): any;
  findBySupervisor(supervisorId: Types.ObjectId): any;
  findProblematic(): any;
  getAverageRating(): Promise<any>;
}

const PengawasanSetelahPemasanganSchema = new Schema<IPengawasanSetelahPemasanganDocument>(
  {
    idPemasangan: { type: Schema.Types.ObjectId, ref: 'Pemasangan', required: true },
    urlGambar: {
      type: [String], default: [],
      validate: { validator: (v: string[]) => v && v.length > 0, message: 'Minimal 1 foto diperlukan' },
    },
    catatan: { type: String, required: true, trim: true, minlength: [10, 'Catatan minimal 10 karakter'] },
    supervisorId: { type: Schema.Types.ObjectId, ref: 'Teknisi', required: true },
    tanggalPengawasan: { type: Date, default: Date.now },
    hariSetelahPemasangan: { type: Number, default: null },
    hasilPengawasan: { type: String, enum: ['Baik', 'Perlu Perbaikan', 'Bermasalah'], required: true },
    statusMeteran: { type: String, enum: ['Berfungsi Normal', 'Bermasalah', 'Perlu Kalibrasi'], default: 'Berfungsi Normal' },
    bacaanAwal: { type: Number, default: 0, min: [0, 'Bacaan meteran tidak boleh negatif'] },
    masalahDitemukan: { type: [String], default: [] },
    tindakan: { type: String, default: '', trim: true },
    rekomendasi: { type: String, default: '', trim: true },
    perluTindakLanjut: { type: Boolean, default: false },
    checklist: {
      meteranBacaCorrect: { type: Boolean, default: true },
      tidakAdaKebocoran: { type: Boolean, default: true },
      sambunganAman: { type: Boolean, default: true },
      mudahDibaca: { type: Boolean, default: true },
      pelangganPuas: { type: Boolean, default: true },
      dokumentasiLengkap: { type: Boolean, default: true },
    },
    feedbackPelanggan: {
      rating: { type: Number, min: 1, max: 5, default: null },
      komentar: { type: String, default: '' },
    },
  },
  { timestamps: true, collection: 'pengawasansetelahpemasangans' }
);

PengawasanSetelahPemasanganSchema.index({ idPemasangan: 1 });
PengawasanSetelahPemasanganSchema.index({ supervisorId: 1 });
PengawasanSetelahPemasanganSchema.index({ tanggalPengawasan: -1 });
PengawasanSetelahPemasanganSchema.index({ hasilPengawasan: 1 });
PengawasanSetelahPemasanganSchema.index({ statusMeteran: 1 });

PengawasanSetelahPemasanganSchema.virtual('pemasanganDetails', { ref: 'Pemasangan', localField: 'idPemasangan', foreignField: '_id', justOne: true });
PengawasanSetelahPemasanganSchema.virtual('supervisorDetails', { ref: 'Teknisi', localField: 'supervisorId', foreignField: '_id', justOne: true });

PengawasanSetelahPemasanganSchema.methods.isOK = function () { return this.hasilPengawasan === 'Baik' && this.statusMeteran === 'Berfungsi Normal'; };
PengawasanSetelahPemasanganSchema.methods.hasIssues = function () { return this.masalahDitemukan && this.masalahDitemukan.length > 0; };
PengawasanSetelahPemasanganSchema.methods.needsFollowUp = function () { return this.perluTindakLanjut === true; };
PengawasanSetelahPemasanganSchema.methods.getAllChecksPassed = function () {
  const c = this.checklist;
  return c.meteranBacaCorrect && c.tidakAdaKebocoran && c.sambunganAman && c.mudahDibaca && c.pelangganPuas && c.dokumentasiLengkap;
};
PengawasanSetelahPemasanganSchema.methods.getCustomerRating = function () { return this.feedbackPelanggan?.rating ?? null; };

PengawasanSetelahPemasanganSchema.statics.findByPemasangan = function (id) { return this.find({ idPemasangan: id }).populate('supervisorDetails').sort({ tanggalPengawasan: -1 }); };
PengawasanSetelahPemasanganSchema.statics.findBySupervisor = function (id) { return this.find({ supervisorId: id }).populate('pemasanganDetails').sort({ tanggalPengawasan: -1 }); };
PengawasanSetelahPemasanganSchema.statics.findProblematic = function () {
  return this.find({ $or: [{ hasilPengawasan: 'Bermasalah' }, { statusMeteran: { $ne: 'Berfungsi Normal' } }, { perluTindakLanjut: true }] })
    .populate('pemasanganDetails').populate('supervisorDetails').sort({ tanggalPengawasan: -1 });
};
PengawasanSetelahPemasanganSchema.statics.getAverageRating = async function () {
  const result = await this.aggregate([
    { $match: { 'feedbackPelanggan.rating': { $exists: true, $ne: null } } },
    { $group: { _id: null, avgRating: { $avg: '$feedbackPelanggan.rating' }, count: { $sum: 1 } } },
  ]);
  return result.length > 0 ? result[0] : { avgRating: 0, count: 0 };
};

PengawasanSetelahPemasanganSchema.pre('save', async function (next) {
  if (this.isNew && this.idPemasangan) {
    try {
      const Pemasangan = (await import('./Pemasangan.js')).default;
      const pemasangan = await Pemasangan.findById(this.idPemasangan);
      if (pemasangan && pemasangan.tanggalPemasangan) {
        const diffTime = (this.tanggalPengawasan?.getTime() ?? Date.now()) - pemasangan.tanggalPemasangan.getTime();
        this.hariSetelahPemasangan = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    } catch (error) {
      console.error('Error calculating days after installation:', error);
    }
  }
  if (!this.urlGambar || this.urlGambar.length === 0) {
    next(new Error('Minimal 1 foto pengawasan diperlukan'));
    return;
  }
  const invalidUrls = this.urlGambar.filter(url => { try { new URL(url); return false; } catch { return true; } });
  if (invalidUrls.length > 0) { next(new Error(`URL gambar tidak valid: ${invalidUrls.join(', ')}`)); } else { next(); }
});

export default model<IPengawasanSetelahPemasanganDocument, IPengawasanSetelahPemasanganModel>(
  'PengawasanSetelahPemasangan', PengawasanSetelahPemasanganSchema
);
