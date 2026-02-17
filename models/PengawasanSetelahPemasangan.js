/**
 * PengawasanSetelahPemasangan Model (ERD Compliant)
 *
 * Collection: pengawasansetelahpemasangans
 *
 * Purpose: Track supervision AFTER meter installation is complete
 * Follow-up inspection to ensure installation quality and meter functionality
 *
 * ERD Reference: PengawasanSetelahPemasangan entity
 */

import mongoose from "mongoose";

const PengawasanSetelahPemasanganSchema = new mongoose.Schema(
  {
    // Reference to Installation (Pemasangan)
    idPemasangan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pemasangan",  // Collection: pemasangans
      required: true,
    },

    // Post-installation supervision photos (array of URLs)
    // Photos showing final installation result, meter readings, etc.
    urlGambar: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          // Must have at least 1 photo for verification
          return v && v.length > 0;
        },
        message: "Minimal 1 foto pengawasan diperlukan"
      }
    },

    // Supervision notes/report
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

    // Post-installation supervision date
    tanggalPengawasan: {
      type: Date,
      default: Date.now,
    },

    // Days after installation this supervision was conducted
    hariSetelahPemasangan: {
      type: Number,  // calculated from installation date
      default: null,
    },

    // Supervision result
    hasilPengawasan: {
      type: String,
      enum: ["Baik", "Perlu Perbaikan", "Bermasalah"],
      required: true,
    },

    // Meter functionality status
    statusMeteran: {
      type: String,
      enum: ["Berfungsi Normal", "Bermasalah", "Perlu Kalibrasi"],
      default: "Berfungsi Normal",
    },

    // Initial meter reading (for verification)
    bacaanAwal: {
      type: Number,
      default: 0,
      min: [0, "Bacaan meteran tidak boleh negatif"],
    },

    // Issues found (if any)
    masalahDitemukan: {
      type: [String],
      default: [],
    },

    // Actions taken
    tindakan: {
      type: String,
      default: "",
      trim: true,
    },

    // Recommendations for follow-up
    rekomendasi: {
      type: String,
      default: "",
      trim: true,
    },

    // Requires additional action
    perluTindakLanjut: {
      type: Boolean,
      default: false,
    },

    // Post-installation checklist
    checklist: {
      // Meter reads correctly
      meteranBacaCorrect: {
        type: Boolean,
        default: true,
      },
      // No leaks detected
      tidakAdaKebocoran: {
        type: Boolean,
        default: true,
      },
      // Pipe connection secure
      sambunganAman: {
        type: Boolean,
        default: true,
      },
      // Meter accessible for readings
      mudahDibaca: {
        type: Boolean,
        default: true,
      },
      // Customer satisfaction
      pelangganPuas: {
        type: Boolean,
        default: true,
      },
      // Documentation complete
      dokumentasiLengkap: {
        type: Boolean,
        default: true,
      },
    },

    // Customer feedback (optional)
    feedbackPelanggan: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      komentar: {
        type: String,
        default: "",
      },
    }
  },
  {
    timestamps: true,
    collection: "pengawasansetelahpemasangans"
  }
);

// Indexes
PengawasanSetelahPemasanganSchema.index({ idPemasangan: 1 });
PengawasanSetelahPemasanganSchema.index({ supervisorId: 1 });
PengawasanSetelahPemasanganSchema.index({ tanggalPengawasan: -1 });
PengawasanSetelahPemasanganSchema.index({ hasilPengawasan: 1 });
PengawasanSetelahPemasanganSchema.index({ statusMeteran: 1 });

// Virtual populates
PengawasanSetelahPemasanganSchema.virtual('pemasanganDetails', {
  ref: 'Pemasangan',
  localField: 'idPemasangan',
  foreignField: '_id',
  justOne: true
});

PengawasanSetelahPemasanganSchema.virtual('supervisorDetails', {
  ref: 'Teknisi',
  localField: 'supervisorId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
PengawasanSetelahPemasanganSchema.methods.isOK = function() {
  return this.hasilPengawasan === "Baik" && this.statusMeteran === "Berfungsi Normal";
};

PengawasanSetelahPemasanganSchema.methods.hasIssues = function() {
  return this.masalahDitemukan && this.masalahDitemukan.length > 0;
};

PengawasanSetelahPemasanganSchema.methods.needsFollowUp = function() {
  return this.perluTindakLanjut === true;
};

PengawasanSetelahPemasanganSchema.methods.getAllChecksPassed = function() {
  const checks = this.checklist;
  return (
    checks.meteranBacaCorrect &&
    checks.tidakAdaKebocoran &&
    checks.sambunganAman &&
    checks.mudahDibaca &&
    checks.pelangganPuas &&
    checks.dokumentasiLengkap
  );
};

PengawasanSetelahPemasanganSchema.methods.getCustomerRating = function() {
  return this.feedbackPelanggan?.rating || null;
};

// Static methods
PengawasanSetelahPemasanganSchema.statics.findByPemasangan = function(pemasanganId) {
  return this.find({ idPemasangan: pemasanganId })
    .populate('supervisorDetails')
    .sort({ tanggalPengawasan: -1 });
};

PengawasanSetelahPemasanganSchema.statics.findBySupervisor = function(supervisorId) {
  return this.find({ supervisorId: supervisorId })
    .populate('pemasanganDetails')
    .sort({ tanggalPengawasan: -1 });
};

PengawasanSetelahPemasanganSchema.statics.findProblematic = function() {
  return this.find({
    $or: [
      { hasilPengawasan: "Bermasalah" },
      { statusMeteran: { $ne: "Berfungsi Normal" } },
      { perluTindakLanjut: true }
    ]
  })
    .populate('pemasanganDetails')
    .populate('supervisorDetails')
    .sort({ tanggalPengawasan: -1 });
};

PengawasanSetelahPemasanganSchema.statics.getAverageRating = async function() {
  const result = await this.aggregate([
    {
      $match: {
        'feedbackPelanggan.rating': { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$feedbackPelanggan.rating" },
        count: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? result[0] : { avgRating: 0, count: 0 };
};

// Pre-save hooks
PengawasanSetelahPemasanganSchema.pre('save', async function(next) {
  // Calculate days after installation
  if (this.isNew && this.idPemasangan) {
    try {
      const Pemasangan = mongoose.model('Pemasangan');
      const pemasangan = await Pemasangan.findById(this.idPemasangan);

      if (pemasangan && pemasangan.tanggalPemasangan) {
        const diffTime = this.tanggalPengawasan - pemasangan.tanggalPemasangan;
        this.hariSetelahPemasangan = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    } catch (error) {
      console.error('Error calculating days after installation:', error);
    }
  }

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

export default mongoose.model("PengawasanSetelahPemasangan", PengawasanSetelahPemasanganSchema);
