import { Schema, model, Types, Document, Model } from 'mongoose';

export interface IPemasangan {
  idKoneksiData: Types.ObjectId;
  seriMeteran: string;
  fotoRumah: string;
  fotoMeteran: string;
  fotoMeteranDanRumah: string;
  catatan?: string;
  teknisiId: Types.ObjectId;
  tanggalPemasangan?: Date;
  statusVerifikasi?: 'Pending' | 'Disetujui' | 'Ditolak';
  diverifikasiOleh?: Types.ObjectId | null;
  tanggalVerifikasi?: Date | null;
  detailPemasangan?: {
    diameterPipa?: number | null;
    lokasiPemasangan?: string;
    koordinat?: { latitude?: number; longitude?: number };
    materialDigunakan?: string[];
  };
}

export interface IPemasanganDocument extends IPemasangan, Document {
  isVerified(): boolean;
  isPending(): boolean;
  isRejected(): boolean;
  getAllPhotos(): { type: string; url: string }[];
}

interface IPemasanganModel extends Model<IPemasanganDocument> {
  findByKoneksiData(koneksiDataId: Types.ObjectId): any;
  findBySeriMeteran(seriMeteran: string): any;
  findPendingVerification(): any;
  findByTeknisi(teknisiId: Types.ObjectId): any;
}

const urlValidator = {
  validator: function (v: string) {
    try { new URL(v); return true; } catch { return false; }
  },
  message: 'URL tidak valid',
};

const PemasanganSchema = new Schema<IPemasanganDocument>(
  {
    idKoneksiData: { type: Schema.Types.ObjectId, ref: 'ConnectionData', required: true, unique: true },
    seriMeteran: {
      type: String, required: true, unique: true, trim: true, uppercase: true,
      validate: {
        validator: (v: string) => /^[A-Z0-9]{6,20}$/.test(v),
        message: 'Format seri meteran tidak valid (harus 6-20 karakter alfanumerik)',
      },
    },
    fotoRumah: { type: String, required: true, trim: true, validate: urlValidator },
    fotoMeteran: { type: String, required: true, trim: true, validate: urlValidator },
    fotoMeteranDanRumah: { type: String, required: true, trim: true, validate: urlValidator },
    catatan: { type: String, default: '', trim: true },
    teknisiId: { type: Schema.Types.ObjectId, ref: 'Teknisi', required: true },
    tanggalPemasangan: { type: Date, default: Date.now },
    statusVerifikasi: { type: String, enum: ['Pending', 'Disetujui', 'Ditolak'], default: 'Pending' },
    diverifikasiOleh: { type: Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    tanggalVerifikasi: { type: Date, default: null },
    detailPemasangan: {
      diameterPipa: { type: Number, default: null },
      lokasiPemasangan: { type: String, default: '' },
      koordinat: { latitude: Number, longitude: Number },
      materialDigunakan: { type: [String], default: [] },
    },
  },
  { timestamps: true, collection: 'pemasangans' }
);

PemasanganSchema.index({ teknisiId: 1 });
PemasanganSchema.index({ statusVerifikasi: 1 });
PemasanganSchema.index({ tanggalPemasangan: -1 });

PemasanganSchema.virtual('koneksiDataDetails', { ref: 'ConnectionData', localField: 'idKoneksiData', foreignField: '_id', justOne: true });
PemasanganSchema.virtual('teknisiDetails', { ref: 'Teknisi', localField: 'teknisiId', foreignField: '_id', justOne: true });
PemasanganSchema.virtual('adminDetails', { ref: 'AdminAccount', localField: 'diverifikasiOleh', foreignField: '_id', justOne: true });

PemasanganSchema.methods.isVerified = function () { return this.statusVerifikasi === 'Disetujui'; };
PemasanganSchema.methods.isPending = function () { return this.statusVerifikasi === 'Pending'; };
PemasanganSchema.methods.isRejected = function () { return this.statusVerifikasi === 'Ditolak'; };
PemasanganSchema.methods.getAllPhotos = function () {
  return [
    { type: 'Rumah', url: this.fotoRumah },
    { type: 'Meteran', url: this.fotoMeteran },
    { type: 'Meteran & Rumah', url: this.fotoMeteranDanRumah },
  ];
};

PemasanganSchema.statics.findByKoneksiData = function (koneksiDataId) {
  return this.findOne({ idKoneksiData: koneksiDataId }).populate('teknisiDetails').populate('koneksiDataDetails');
};
PemasanganSchema.statics.findBySeriMeteran = function (seriMeteran) {
  return this.findOne({ seriMeteran: seriMeteran.toUpperCase() }).populate('teknisiDetails').populate('koneksiDataDetails');
};
PemasanganSchema.statics.findPendingVerification = function () {
  return this.find({ statusVerifikasi: 'Pending' }).populate('teknisiDetails').populate('koneksiDataDetails').sort({ tanggalPemasangan: -1 });
};
PemasanganSchema.statics.findByTeknisi = function (teknisiId) {
  return this.find({ teknisiId }).populate('koneksiDataDetails').sort({ tanggalPemasangan: -1 });
};

PemasanganSchema.pre('save', function (next) {
  if (this.seriMeteran) this.seriMeteran = this.seriMeteran.toUpperCase();
  next();
});

PemasanganSchema.post('save', async function (doc) {
  try {
    const ConnectionData = (await import('./ConnectionData.js')).default;
    await ConnectionData.updateOne(
      { _id: doc.idKoneksiData },
      { $set: { isPemasanganDone: true, meteranId: doc._id } }
    );
  } catch (error) {
    console.error('Error updating connection data:', error);
  }
});

export default model<IPemasanganDocument, IPemasanganModel>('Pemasangan', PemasanganSchema);
