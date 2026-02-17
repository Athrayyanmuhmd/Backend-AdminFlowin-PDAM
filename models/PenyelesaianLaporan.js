/**
 * PenyelesaianLaporan Model (ERD Compliant)
 *
 * Collection: penyelesaianlaporans
 *
 * Purpose: Track resolution details for customer reports/complaints
 * Links to Laporan (Report) entity
 *
 * ERD Reference: PenyelesaianLaporan entity
 */

import mongoose from "mongoose";

const PenyelesaianLaporanSchema = new mongoose.Schema(
  {
    // Reference to Report (Laporan)
    idLaporan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Laporan",  // Collection: laporans
      required: true,
    },

    // Resolution images (array of URLs)
    // Photos showing work completed, issue resolved, etc.
    urlGambar: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          // Must have at least 1 photo for verification
          return v && v.length > 0;
        },
        message: "Minimal 1 foto penyelesaian diperlukan"
      }
    },

    // Resolution notes/description
    catatan: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, "Catatan minimal 10 karakter"],
    },

    // Technician who resolved the issue (optional)
    teknisiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teknisi",
      default: null,
    },

    // Resolution timestamp (auto-set)
    tanggalSelesai: {
      type: Date,
      default: Date.now,
    },

    // Additional metadata
    metadata: {
      // Work duration in minutes
      durasiPengerjaan: {
        type: Number,  // minutes
        default: null,
      },
      // Materials used
      materialDigunakan: {
        type: [String],
        default: [],
      },
      // Cost (if any)
      biaya: {
        type: Number,
        default: 0,
      },
    }
  },
  {
    timestamps: true,  // Adds createdAt and updatedAt
    collection: "penyelesaianlaporans"
  }
);

// Indexes for better query performance
PenyelesaianLaporanSchema.index({ idLaporan: 1 });
PenyelesaianLaporanSchema.index({ teknisiId: 1 });
PenyelesaianLaporanSchema.index({ tanggalSelesai: -1 });
PenyelesaianLaporanSchema.index({ createdAt: -1 });

// Virtual populate for Laporan details
PenyelesaianLaporanSchema.virtual('laporanDetails', {
  ref: 'Laporan',
  localField: 'idLaporan',
  foreignField: '_id',
  justOne: true
});

// Virtual populate for Teknisi details
PenyelesaianLaporanSchema.virtual('teknisiDetails', {
  ref: 'Teknisi',
  localField: 'teknisiId',
  foreignField: '_id',
  justOne: true
});

// Instance method: Check if resolution has photos
PenyelesaianLaporanSchema.methods.hasFotos = function() {
  return this.urlGambar && this.urlGambar.length > 0;
};

// Instance method: Get photo count
PenyelesaianLaporanSchema.methods.getFotoCount = function() {
  return this.urlGambar ? this.urlGambar.length : 0;
};

// Static method: Find by report ID
PenyelesaianLaporanSchema.statics.findByLaporan = function(laporanId) {
  return this.findOne({ idLaporan: laporanId })
    .populate('teknisiDetails')
    .populate('laporanDetails');
};

// Static method: Find all by technician
PenyelesaianLaporanSchema.statics.findByTeknisi = function(teknisiId) {
  return this.find({ teknisiId: teknisiId })
    .populate('laporanDetails')
    .sort({ tanggalSelesai: -1 });
};

// Static method: Get resolution statistics
PenyelesaianLaporanSchema.statics.getStats = async function(startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        tanggalSelesai: {
          $gte: startDate || new Date(0),
          $lte: endDate || new Date()
        }
      }
    },
    {
      $group: {
        _id: null,
        totalResolutions: { $sum: 1 },
        avgDuration: { $avg: "$metadata.durasiPengerjaan" },
        totalCost: { $sum: "$metadata.biaya" },
        totalPhotos: { $sum: { $size: "$urlGambar" } }
      }
    }
  ]);
};

// Pre-save hook: Validate photo URLs
PenyelesaianLaporanSchema.pre('save', function(next) {
  if (this.urlGambar && this.urlGambar.length > 0) {
    // Check if all URLs are valid
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
    next(new Error('Minimal 1 foto penyelesaian diperlukan'));
  }
});

export default mongoose.model("PenyelesaianLaporan", PenyelesaianLaporanSchema);
