import { Schema, model, Types, Document, Model } from 'mongoose';

export type HasilPengawasanPemasangan = 'Sesuai' | 'Perbaikan Diperlukan' | 'Tidak Sesuai';

export interface IPengawasanPemasangan {
  idPemasangan: Types.ObjectId;
  urlGambar: string[];
  catatan: string;
  supervisorId: Types.ObjectId;
  tanggalPengawasan?: Date;
  hasilPengawasan: HasilPengawasanPemasangan;
  temuan?: string[];
  rekomendasi?: string;
  perluTindakLanjut?: boolean;
  checklist?: {
    kualitasSambunganPipa?: 'Baik' | 'Cukup' | 'Kurang';
    posisiMeteran?: 'Tepat' | 'Perlu Penyesuaian';
    kebersihanPemasangan?: 'Baik' | 'Cukup' | 'Kurang';
    kepatuhanK3?: 'Baik' | 'Cukup' | 'Kurang';
  };
}

export interface IPengawasanPemasanganDocument extends IPengawasanPemasangan, Document {
  isSesuai(): boolean;
  needsFollowUp(): boolean;
  hasFotos(): boolean;
  getFotoCount(): number;
}

interface IPengawasanPemasanganModel extends Model<IPengawasanPemasanganDocument> {
  findByPemasangan(pemasanganId: Types.ObjectId): any;
  findBySupervisor(supervisorId: Types.ObjectId): any;
  findNeedingFollowUp(): any;
}

const PengawasanPemasanganSchema = new Schema<IPengawasanPemasanganDocument>(
  {
    idPemasangan: { type: Schema.Types.ObjectId, ref: 'Pemasangan', required: true },
    urlGambar: {
      type: [String], default: [],
      validate: {
        validator: (v: string[]) => v && v.length > 0,
        message: 'Minimal 1 foto pengawasan diperlukan',
      },
    },
    catatan: { type: String, required: true, trim: true, minlength: [10, 'Catatan minimal 10 karakter'] },
    supervisorId: { type: Schema.Types.ObjectId, ref: 'Teknisi', required: true },
    tanggalPengawasan: { type: Date, default: Date.now },
    hasilPengawasan: { type: String, enum: ['Sesuai', 'Perbaikan Diperlukan', 'Tidak Sesuai'], required: true },
    temuan: { type: [String], default: [] },
    rekomendasi: { type: String, default: '', trim: true },
    perluTindakLanjut: { type: Boolean, default: false },
    checklist: {
      kualitasSambunganPipa: { type: String, enum: ['Baik', 'Cukup', 'Kurang'], default: 'Baik' },
      posisiMeteran: { type: String, enum: ['Tepat', 'Perlu Penyesuaian'], default: 'Tepat' },
      kebersihanPemasangan: { type: String, enum: ['Baik', 'Cukup', 'Kurang'], default: 'Baik' },
      kepatuhanK3: { type: String, enum: ['Baik', 'Cukup', 'Kurang'], default: 'Baik' },
    },
  },
  { timestamps: true, collection: 'pengawasanpemasangans' }
);

PengawasanPemasanganSchema.index({ idPemasangan: 1 });
PengawasanPemasanganSchema.index({ supervisorId: 1 });
PengawasanPemasanganSchema.index({ tanggalPengawasan: -1 });
PengawasanPemasanganSchema.index({ hasilPengawasan: 1 });

PengawasanPemasanganSchema.virtual('pemasanganDetails', { ref: 'Pemasangan', localField: 'idPemasangan', foreignField: '_id', justOne: true });
PengawasanPemasanganSchema.virtual('supervisorDetails', { ref: 'Teknisi', localField: 'supervisorId', foreignField: '_id', justOne: true });

PengawasanPemasanganSchema.methods.isSesuai = function () { return this.hasilPengawasan === 'Sesuai'; };
PengawasanPemasanganSchema.methods.needsFollowUp = function () { return this.perluTindakLanjut === true; };
PengawasanPemasanganSchema.methods.hasFotos = function () { return this.urlGambar && this.urlGambar.length > 0; };
PengawasanPemasanganSchema.methods.getFotoCount = function () { return this.urlGambar ? this.urlGambar.length : 0; };

PengawasanPemasanganSchema.statics.findByPemasangan = function (pemasanganId) {
  return this.find({ idPemasangan: pemasanganId }).populate('supervisorDetails').sort({ tanggalPengawasan: -1 });
};
PengawasanPemasanganSchema.statics.findBySupervisor = function (supervisorId) {
  return this.find({ supervisorId }).populate('pemasanganDetails').sort({ tanggalPengawasan: -1 });
};
PengawasanPemasanganSchema.statics.findNeedingFollowUp = function () {
  return this.find({ perluTindakLanjut: true }).populate('pemasanganDetails').populate('supervisorDetails').sort({ tanggalPengawasan: -1 });
};

PengawasanPemasanganSchema.pre('save', function (next) {
  if (!this.urlGambar || this.urlGambar.length === 0) {
    next(new Error('Minimal 1 foto pengawasan diperlukan'));
    return;
  }
  const invalidUrls = this.urlGambar.filter(url => { try { new URL(url); return false; } catch { return true; } });
  if (invalidUrls.length > 0) {
    next(new Error(`URL gambar tidak valid: ${invalidUrls.join(', ')}`));
  } else {
    next();
  }
});

export default model<IPengawasanPemasanganDocument, IPengawasanPemasanganModel>(
  'PengawasanPemasangan', PengawasanPemasanganSchema
);
