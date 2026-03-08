import { Schema, model, Types, Document, Model } from 'mongoose';

export type StatusPekerjaan =
  | 'Ditunda'
  | 'Ditugaskan'
  | 'DitinjauAdmin'
  | 'SedangDikerjakan'
  | 'Selesai'
  | 'Dibatalkan';

export interface IPekerjaanTeknisi {
  idSurvei?: Types.ObjectId | null;
  rabId?: Types.ObjectId | null;
  idLaporan?: Types.ObjectId | null;
  idPenyelesaianLaporan?: Types.ObjectId | null;
  idPemasangan?: Types.ObjectId | null;
  idPengawasanPemasangan?: Types.ObjectId | null;
  idPengawasanSetelahPemasangan?: Types.ObjectId | null;
  tim: Types.ObjectId[];
  status: StatusPekerjaan;
  disetujui?: boolean | null;
  catatan?: string | null;
}

export interface IPekerjaanTeknisiDocument extends IPekerjaanTeknisi, Document {
  isSelesai(): boolean;
  isSedangDikerjakan(): boolean;
  isDisetujui(): boolean;
}

interface IPekerjaanTeknisiModel extends Model<IPekerjaanTeknisiDocument> {
  findByTeknisi(teknisiId: Types.ObjectId): any;
  findByStatus(status: StatusPekerjaan): any;
  findPendingApproval(): any;
}

const PekerjaanTeknisiSchema = new Schema<IPekerjaanTeknisiDocument>(
  {
    idSurvei: { type: Schema.Types.ObjectId, ref: 'SurveyData', default: null },
    rabId: { type: Schema.Types.ObjectId, ref: 'RabConnection', default: null },
    idLaporan: { type: Schema.Types.ObjectId, ref: 'Laporan', default: null },
    idPenyelesaianLaporan: { type: Schema.Types.ObjectId, ref: 'PenyelesaianLaporan', default: null },
    idPemasangan: { type: Schema.Types.ObjectId, ref: 'Pemasangan', default: null },
    idPengawasanPemasangan: { type: Schema.Types.ObjectId, ref: 'PengawasanPemasangan', default: null },
    idPengawasanSetelahPemasangan: { type: Schema.Types.ObjectId, ref: 'PengawasanSetelahPemasangan', default: null },
    tim: {
      type: [Schema.Types.ObjectId],
      ref: 'Teknisi',
      required: true,
      validate: {
        validator: function (v: Types.ObjectId[]) {
          return v && v.length > 0;
        },
        message: 'Tim harus minimal memiliki 1 teknisi',
      },
    },
    status: {
      type: String,
      enum: ['Ditunda', 'Ditugaskan', 'DitinjauAdmin', 'SedangDikerjakan', 'Selesai', 'Dibatalkan'],
      required: true,
      default: 'Ditugaskan',
    },
    disetujui: { type: Boolean, default: null },
    catatan: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'pekerjaanteknisis',
  }
);

PekerjaanTeknisiSchema.index({ status: 1 });
PekerjaanTeknisiSchema.index({ disetujui: 1 });
PekerjaanTeknisiSchema.index({ tim: 1 });
PekerjaanTeknisiSchema.index({ idSurvei: 1 });
PekerjaanTeknisiSchema.index({ rabId: 1 });

PekerjaanTeknisiSchema.virtual('timDetails', {
  ref: 'Teknisi',
  localField: 'tim',
  foreignField: '_id',
});

PekerjaanTeknisiSchema.methods.isSelesai = function (): boolean {
  return this.status === 'Selesai';
};
PekerjaanTeknisiSchema.methods.isSedangDikerjakan = function (): boolean {
  return this.status === 'SedangDikerjakan';
};
PekerjaanTeknisiSchema.methods.isDisetujui = function (): boolean {
  return this.disetujui === true;
};

PekerjaanTeknisiSchema.statics.findByTeknisi = function (teknisiId: Types.ObjectId) {
  return this.find({ tim: teknisiId });
};
PekerjaanTeknisiSchema.statics.findByStatus = function (status: StatusPekerjaan) {
  return this.find({ status });
};
PekerjaanTeknisiSchema.statics.findPendingApproval = function () {
  return this.find({ disetujui: null, status: 'DitinjauAdmin' });
};

PekerjaanTeknisiSchema.pre('save', function (next) {
  const hasReference =
    this.idSurvei ||
    this.rabId ||
    this.idLaporan ||
    this.idPenyelesaianLaporan ||
    this.idPemasangan ||
    this.idPengawasanPemasangan ||
    this.idPengawasanSetelahPemasangan;
  if (!hasReference) {
    next(new Error('Pekerjaan teknisi harus memiliki minimal 1 referensi'));
  } else {
    next();
  }
});

export default model<IPekerjaanTeknisiDocument, IPekerjaanTeknisiModel>(
  'PekerjaanTeknisi',
  PekerjaanTeknisiSchema
);
