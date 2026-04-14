import mongoose, { Schema, model, Types, Document } from 'mongoose';

// ══════════════════════════════════════════════════════════════════════════════
// Disesuaikan PENUH dengan Rafli (flowin-teknisi-graphql/WorkOrder.ts)
// Collection: pekerjaanteknisis — shared across systems
// Model name: 'PekerjaanTeknisi' — same as Rafli
// ══════════════════════════════════════════════════════════════════════════════

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Jenis pekerjaan teknisi.
 * Urutan dependensi:
 *   survei → rab → pemasangan ──┐
 *                               ├→ pengawasan_setelah_pemasangan
 *                rab → pengawasan_pemasangan ──┘
 *   penyelesaian_laporan (standalone, butuh DataConnection approved)
 */
export const JENIS_PEKERJAAN = [
  'survei',
  'rab',
  'pemasangan',
  'pengawasan_pemasangan',
  'pengawasan_setelah_pemasangan',
  'penyelesaian_laporan',
] as const;

export type JenisPekerjaan = (typeof JENIS_PEKERJAAN)[number];

/**
 * Status respon awal teknisi terhadap pekerjaan.
 */
export const STATUS_RESPON = [
  'belum_direspon',
  'diterima',
  'penolakan_diajukan',
  'penolakan_diterima',
  'penolakan_ditolak',
] as const;

export type StatusRespon = (typeof STATUS_RESPON)[number];

/**
 * Status pekerjaan work order.
 */
export const STATUS_PEKERJAAN = [
  'menunggu_respon',
  'menunggu_tim',
  'tim_diajukan',
  'ditugaskan',
  'sedang_dikerjakan',
  'dikirim',
  'revisi',
  'selesai',
  'dibatalkan',
] as const;

export type StatusPekerjaan = (typeof STATUS_PEKERJAAN)[number];

/**
 * Status persetujuan tim oleh admin.
 */
export const STATUS_TIM = [
  'belum_diajukan',
  'diajukan',
  'disetujui',
  'ditolak',
] as const;

export type StatusTim = (typeof STATUS_TIM)[number];

/**
 * Peta urutan dependensi pekerjaan.
 */
export const URUTAN_PEKERJAAN: Record<JenisPekerjaan, JenisPekerjaan[]> = {
  survei: [],
  rab: ['survei'],
  pemasangan: ['rab'],
  pengawasan_pemasangan: ['rab'],
  pengawasan_setelah_pemasangan: ['pemasangan', 'pengawasan_pemasangan'],
  penyelesaian_laporan: [],
};

/**
 * Mapping: jenisPekerjaan → field referensi dokumen di WorkOrder.
 */
export const JENIS_KE_REF_FIELD: Record<JenisPekerjaan, string> = {
  survei: 'idSurvei',
  rab: 'idRAB',
  pemasangan: 'idPemasangan',
  pengawasan_pemasangan: 'idPengawasanPemasangan',
  pengawasan_setelah_pemasangan: 'idPengawasanSetelahPemasangan',
  penyelesaian_laporan: 'idPenyelesaianLaporan',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IRiwayatReview {
  status: 'disetujui' | 'ditolak';
  catatan?: string | null;
  oleh: Types.ObjectId;
  tanggal: Date;
}

export interface IRiwayatRespon {
  aksi: 'penolakan_diajukan' | 'penolakan_diterima' | 'penolakan_ditolak' | 'diterima';
  alasan?: string | null;
  oleh: Types.ObjectId;
  tanggal: Date;
}

export interface IPekerjaanTeknisi {
  idKoneksiData: Types.ObjectId;
  jenisPekerjaan: JenisPekerjaan;
  teknisiPenanggungJawab: Types.ObjectId;
  tim: Types.ObjectId[];
  statusTim: StatusTim;
  catatanTim?: string | null;
  status: StatusPekerjaan;
  // Workflow Chain
  workOrderSebelumnya?: Types.ObjectId | null;
  // Respon awal teknisi
  statusRespon: StatusRespon;
  alasanPenolakan?: string | null;
  catatanReviewPenolakan?: string | null;
  riwayatRespon: IRiwayatRespon[];
  // Referensi dokumen pekerjaan (hanya satu yang terisi sesuai jenisPekerjaan)
  idSurvei?: Types.ObjectId | null;
  idRAB?: Types.ObjectId | null;
  idPemasangan?: Types.ObjectId | null;
  idPengawasanPemasangan?: Types.ObjectId | null;
  idPengawasanSetelahPemasangan?: Types.ObjectId | null;
  idPenyelesaianLaporan?: Types.ObjectId | null;
  // Review
  catatanReview?: string | null;
  riwayatReview: IRiwayatReview[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPekerjaanTeknisiDocument extends IPekerjaanTeknisi, Document {}

// ─── Schema ───────────────────────────────────────────────────────────────────

const PekerjaanTeknisiSchema = new Schema<IPekerjaanTeknisiDocument>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: 'KoneksiData',
      required: [true, 'ID koneksi data diperlukan'],
      index: true,
    },

    jenisPekerjaan: {
      type: String,
      enum: {
        values: JENIS_PEKERJAAN,
        message: 'Jenis pekerjaan tidak valid: {VALUE}',
      },
      required: [true, 'Jenis pekerjaan wajib diisi'],
      index: true,
    },

    teknisiPenanggungJawab: {
      type: Schema.Types.ObjectId,
      ref: 'TeknisiPerumdam',
      required: [true, 'Teknisi penanggung jawab wajib diisi'],
      index: true,
    },

    tim: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TeknisiPerumdam',
      },
    ],

    statusTim: {
      type: String,
      enum: {
        values: STATUS_TIM,
        message: 'Status tim tidak valid: {VALUE}',
      },
      default: 'belum_diajukan',
    },

    catatanTim: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: STATUS_PEKERJAAN,
        message: 'Status pekerjaan tidak valid: {VALUE}',
      },
      required: [true, 'Status pekerjaan wajib diisi'],
      default: 'menunggu_respon',
    },

    // ─── Workflow Chain ────────────────────────────────────────────────
    workOrderSebelumnya: {
      type: Schema.Types.ObjectId,
      ref: 'PekerjaanTeknisi',
      default: null,
      index: true,
    },

    // ─── Respon awal teknisi ───────────────────────────────────────────
    statusRespon: {
      type: String,
      enum: {
        values: STATUS_RESPON,
        message: 'Status respon tidak valid: {VALUE}',
      },
      default: 'belum_direspon',
    },

    alasanPenolakan: {
      type: String,
      trim: true,
      default: null,
    },

    catatanReviewPenolakan: {
      type: String,
      trim: true,
      default: null,
    },

    riwayatRespon: [
      {
        aksi: {
          type: String,
          enum: ['penolakan_diajukan', 'penolakan_diterima', 'penolakan_ditolak', 'diterima'],
          required: true,
        },
        alasan: {
          type: String,
          trim: true,
          default: null,
        },
        oleh: {
          type: Schema.Types.ObjectId,
          ref: 'TeknisiPerumdam',
          required: true,
        },
        tanggal: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ─── Referensi dokumen ─────────────────────────────────────────────
    idSurvei: {
      type: Schema.Types.ObjectId,
      ref: 'Survei',
      default: null,
    },
    idRAB: {
      type: Schema.Types.ObjectId,
      ref: 'RAB',
      default: null,
    },
    idPemasangan: {
      type: Schema.Types.ObjectId,
      ref: 'Pemasangan',
      default: null,
    },
    idPengawasanPemasangan: {
      type: Schema.Types.ObjectId,
      ref: 'PengawasanPemasangan',
      default: null,
    },
    idPengawasanSetelahPemasangan: {
      type: Schema.Types.ObjectId,
      ref: 'PengawasanSetelahPemasangan',
      default: null,
    },
    idPenyelesaianLaporan: {
      type: Schema.Types.ObjectId,
      ref: 'PenyelesaianLaporan',
      default: null,
    },

    // ─── Review ────────────────────────────────────────────────────────
    catatanReview: {
      type: String,
      trim: true,
      default: null,
    },

    riwayatReview: [
      {
        status: {
          type: String,
          enum: ['disetujui', 'ditolak'],
          required: true,
        },
        catatan: {
          type: String,
          trim: true,
          default: null,
        },
        oleh: {
          type: Schema.Types.ObjectId,
          ref: 'TeknisiPerumdam',
          required: true,
        },
        tanggal: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'pekerjaanteknisis',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

PekerjaanTeknisiSchema.index({ idKoneksiData: 1, jenisPekerjaan: 1 });
PekerjaanTeknisiSchema.index({ teknisiPenanggungJawab: 1, status: 1 });
PekerjaanTeknisiSchema.index({ status: 1, jenisPekerjaan: 1 });
PekerjaanTeknisiSchema.index({ teknisiPenanggungJawab: 1, statusRespon: 1 });
PekerjaanTeknisiSchema.index({ workOrderSebelumnya: 1 });

// Unique partial index: hanya boleh 1 WO aktif per jenis per koneksi data
PekerjaanTeknisiSchema.index(
  { idKoneksiData: 1, jenisPekerjaan: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'dibatalkan' } },
    name: 'unique_active_wo_per_jenis_per_koneksi',
  }
);

// ─── Pre-validate ─────────────────────────────────────────────────────────────

PekerjaanTeknisiSchema.pre('validate', function () {
  // Immutability: jenisPekerjaan tidak boleh diubah setelah dibuat
  if (!this.isNew && this.isModified('jenisPekerjaan')) {
    throw new Error('Jenis pekerjaan tidak dapat diubah setelah work order dibuat');
  }

  // Immutability: idKoneksiData tidak boleh diubah setelah dibuat
  if (!this.isNew && this.isModified('idKoneksiData')) {
    throw new Error('ID koneksi data tidak dapat diubah setelah work order dibuat');
  }

  // Immutability: workOrderSebelumnya tidak boleh diubah setelah dibuat
  if (!this.isNew && this.isModified('workOrderSebelumnya')) {
    throw new Error('Referensi work order sebelumnya tidak dapat diubah setelah work order dibuat');
  }

  // Validasi: referensi dokumen harus sesuai dengan jenisPekerjaan
  const refField = JENIS_KE_REF_FIELD[this.jenisPekerjaan];
  if (!refField) return;

  const allRefFields = Object.values(JENIS_KE_REF_FIELD);
  for (const field of allRefFields) {
    const value = (this as unknown as Record<string, unknown>)[field];
    if (field === refField) continue;
    if (value !== null && value !== undefined) {
      throw new Error(
        `Field '${field}' tidak boleh diisi untuk jenis pekerjaan '${this.jenisPekerjaan}'`
      );
    }
  }
});

// ─── Pre-save ─────────────────────────────────────────────────────────────────

PekerjaanTeknisiSchema.pre('save', async function () {
  // Proteksi: work order yang sudah selesai/dibatalkan tidak boleh diubah
  if (!this.isNew && this.isModified('status')) {
    const original = await mongoose
      .model<IPekerjaanTeknisiDocument>('PekerjaanTeknisi')
      .findById(this._id)
      .lean();

    if (original?.status === 'selesai') {
      throw new Error('Work order yang sudah selesai tidak dapat diubah statusnya');
    }

    if (original?.status === 'dibatalkan') {
      throw new Error('Work order yang sudah dibatalkan tidak dapat diubah statusnya');
    }
  }
});

export default model<IPekerjaanTeknisiDocument>(
  'PekerjaanTeknisi',
  PekerjaanTeknisiSchema
);
