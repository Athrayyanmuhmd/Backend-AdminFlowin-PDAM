/**
 * PengawasanPemasangan Model (ERD Compliant)
 *
 * Collection: pengawasanpemasangans
 *
 * Purpose: Track supervision during meter installation process
 * Supervisor inspects work while technician is installing
 *
 * ERD Reference: PengawasanPemasangan entity
 */

import mongoose from "mongoose";

const PengawasanPemasanganSchema = new mongoose.Schema(
  {
    // Reference to Installation (Pemasangan)
    idPemasangan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pemasangan",  // Collection: pemasangans
      required: true,
    },

    // Supervision photos (array of URLs)
    // Photos taken during installation process for quality assurance
    urlGambar: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          // Must have at least 1 supervision photo
          return v && v.length > 0;
        },
        message: "Minimal 1 foto pengawasan diperlukan"
      }
    },

    // Supervision notes/comments
    catatan: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, "Catatan minimal 10 karakter"],
    },

    // Supervisor (Technician from Pengawasan division)
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teknisi",
      required: true,
    },

    // Supervision date/time
    tanggalPengawasan: {
      type: Date,
      default: Date.now,
    },

    // Supervision result
    hasilPengawasan: {
      type: String,
      enum: ["Sesuai", "Perbaikan Diperlukan", "Tidak Sesuai"],
      required: true,
    },

    // Findings/issues discovered
    temuan: {
      type: [String],
      default: [],
    },

    // Recommendations
    rekomendasi: {
      type: String,
      default: "",
      trim: true,
    },

    // Follow-up required
    perluTindakLanjut: {
      type: Boolean,
      default: false,
    },

    // Checklist items (optional structured data)
    checklist: {
      // Pipe connection quality
      kualitasSambunganPipa: {
        type: String,
        enum: ["Baik", "Cukup", "Kurang"],
        default: "Baik",
      },
      // Meter position
      posisiMeteran: {
        type: String,
        enum: ["Tepat", "Perlu Penyesuaian"],
        default: "Tepat",
      },
      // Installation cleanliness
      kebersihanPemasangan: {
        type: String,
        enum: ["Baik", "Cukup", "Kurang"],
        default: "Baik",
      },
      // Safety compliance
      kepatuhanK3: {
        type: String,
        enum: ["Baik", "Cukup", "Kurang"],
        default: "Baik",
      },
    }
  },
  {
    timestamps: true,
    collection: "pengawasanpemasangans"
  }
);

// Indexes
PengawasanPemasanganSchema.index({ idPemasangan: 1 });
PengawasanPemasanganSchema.index({ supervisorId: 1 });
PengawasanPemasanganSchema.index({ tanggalPengawasan: -1 });
PengawasanPemasanganSchema.index({ hasilPengawasan: 1 });

// Virtual populates
PengawasanPemasanganSchema.virtual('pemasanganDetails', {
  ref: 'Pemasangan',
  localField: 'idPemasangan',
  foreignField: '_id',
  justOne: true
});

PengawasanPemasanganSchema.virtual('supervisorDetails', {
  ref: 'Teknisi',
  localField: 'supervisorId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
PengawasanPemasanganSchema.methods.isSesuai = function() {
  return this.hasilPengawasan === "Sesuai";
};

PengawasanPemasanganSchema.methods.needsFollowUp = function() {
  return this.perluTindakLanjut === true;
};

PengawasanPemasanganSchema.methods.hasFotos = function() {
  return this.urlGambar && this.urlGambar.length > 0;
};

PengawasanPemasanganSchema.methods.getFotoCount = function() {
  return this.urlGambar ? this.urlGambar.length : 0;
};

// Static methods
PengawasanPemasanganSchema.statics.findByPemasangan = function(pemasanganId) {
  return this.find({ idPemasangan: pemasanganId })
    .populate('supervisorDetails')
    .sort({ tanggalPengawasan: -1 });
};

PengawasanPemasanganSchema.statics.findBySupervisor = function(supervisorId) {
  return this.find({ supervisorId: supervisorId })
    .populate('pemasanganDetails')
    .sort({ tanggalPengawasan: -1 });
};

PengawasanPemasanganSchema.statics.findNeedingFollowUp = function() {
  return this.find({ perluTindakLanjut: true })
    .populate('pemasanganDetails')
    .populate('supervisorDetails')
    .sort({ tanggalPengawasan: -1 });
};

// Pre-save validation
PengawasanPemasanganSchema.pre('save', function(next) {
  // Validate photo URLs
  if (this.urlGambar && this.urlGambar.length > 0) {
    const invalidUrls = this.urlGambar.filter(url => {
      try {
        new URL(url);
        return false;
      } catch (e) {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      next(new Error(`URL gambar tidak valid: ${invalidUrls.join(', ')}`));
    } else {
      next();
    }
  } else {
    next(new Error('Minimal 1 foto pengawasan diperlukan'));
  }
});

export default mongoose.model("PengawasanPemasangan", PengawasanPemasanganSchema);
