/**
 * Pemasangan Model (ERD Compliant)
 *
 * Collection: pemasangans
 *
 * Purpose: Track meter installation details including photos and serial numbers
 * Links to KoneksiData (Connection Application) entity
 *
 * ERD Reference: Pemasangan entity
 */

import mongoose from "mongoose";

const PemasanganSchema = new mongoose.Schema(
  {
    // Reference to Connection Data
    idKoneksiData: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectionData",  // Collection: connectiondatas
      required: true,
      unique: true,  // One installation per connection application
    },

    // Meter serial number (unique identifier)
    seriMeteran: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          // Serial number format validation (customize as needed)
          return /^[A-Z0-9]{6,20}$/.test(v);
        },
        message: "Format seri meteran tidak valid (harus 6-20 karakter alfanumerik)"
      }
    },

    // Installation Photos (ERD requires 3 specific photos)

    // Photo 1: House/Building exterior
    fotoRumah: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          try {
            new URL(v);
            return true;
          } catch (e) {
            return false;
          }
        },
        message: "URL foto rumah tidak valid"
      }
    },

    // Photo 2: Meter close-up
    fotoMeteran: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          try {
            new URL(v);
            return true;
          } catch (e) {
            return false;
          }
        },
        message: "URL foto meteran tidak valid"
      }
    },

    // Photo 3: Meter with house in frame (verification photo)
    fotoMeteranDanRumah: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          try {
            new URL(v);
            return true;
          } catch (e) {
            return false;
          }
        },
        message: "URL foto meteran dan rumah tidak valid"
      }
    },

    // Installation notes
    catatan: {
      type: String,
      default: "",
      trim: true,
    },

    // Technician who performed installation
    teknisiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teknisi",
      required: true,
    },

    // Installation date
    tanggalPemasangan: {
      type: Date,
      default: Date.now,
    },

    // Installation verification status
    statusVerifikasi: {
      type: String,
      enum: ["Pending", "Disetujui", "Ditolak"],
      default: "Pending",
    },

    // Admin who verified (if verified)
    diverifikasiOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminAccount",
      default: null,
    },

    // Verification date
    tanggalVerifikasi: {
      type: Date,
      default: null,
    },

    // Additional installation details
    detailPemasangan: {
      // Pipe diameter used
      diameterPipa: {
        type: Number,  // in mm
        default: null,
      },
      // Installation location details
      lokasiPemasangan: {
        type: String,
        default: "",
      },
      // GPS coordinates
      koordinat: {
        latitude: Number,
        longitude: Number,
      },
      // Materials used
      materialDigunakan: {
        type: [String],
        default: [],
      },
    }
  },
  {
    timestamps: true,
    collection: "pemasangans"
  }
);

// Indexes
// Note: idKoneksiData & seriMeteran already indexed via unique: true
PemasanganSchema.index({ teknisiId: 1 });
PemasanganSchema.index({ statusVerifikasi: 1 });
PemasanganSchema.index({ tanggalPemasangan: -1 });

// Virtual populates
PemasanganSchema.virtual('koneksiDataDetails', {
  ref: 'ConnectionData',
  localField: 'idKoneksiData',
  foreignField: '_id',
  justOne: true
});

PemasanganSchema.virtual('teknisiDetails', {
  ref: 'Teknisi',
  localField: 'teknisiId',
  foreignField: '_id',
  justOne: true
});

PemasanganSchema.virtual('adminDetails', {
  ref: 'AdminAccount',
  localField: 'diverifikasiOleh',
  foreignField: '_id',
  justOne: true
});

// Instance methods
PemasanganSchema.methods.isVerified = function() {
  return this.statusVerifikasi === "Disetujui";
};

PemasanganSchema.methods.isPending = function() {
  return this.statusVerifikasi === "Pending";
};

PemasanganSchema.methods.isRejected = function() {
  return this.statusVerifikasi === "Ditolak";
};

PemasanganSchema.methods.getAllPhotos = function() {
  return [
    { type: "Rumah", url: this.fotoRumah },
    { type: "Meteran", url: this.fotoMeteran },
    { type: "Meteran & Rumah", url: this.fotoMeteranDanRumah }
  ];
};

// Static methods
PemasanganSchema.statics.findByKoneksiData = function(koneksiDataId) {
  return this.findOne({ idKoneksiData: koneksiDataId })
    .populate('teknisiDetails')
    .populate('koneksiDataDetails');
};

PemasanganSchema.statics.findBySeriMeteran = function(seriMeteran) {
  return this.findOne({ seriMeteran: seriMeteran.toUpperCase() })
    .populate('teknisiDetails')
    .populate('koneksiDataDetails');
};

PemasanganSchema.statics.findPendingVerification = function() {
  return this.find({ statusVerifikasi: "Pending" })
    .populate('teknisiDetails')
    .populate('koneksiDataDetails')
    .sort({ tanggalPemasangan: -1 });
};

PemasanganSchema.statics.findByTeknisi = function(teknisiId) {
  return this.find({ teknisiId: teknisiId })
    .populate('koneksiDataDetails')
    .sort({ tanggalPemasangan: -1 });
};

// Pre-save hooks
PemasanganSchema.pre('save', function(next) {
  // Ensure seri meteran is uppercase
  if (this.seriMeteran) {
    this.seriMeteran = this.seriMeteran.toUpperCase();
  }
  next();
});

// Post-save hook: Update connection data status
PemasanganSchema.post('save', async function(doc) {
  try {
    // Update connection data to indicate installation completed
    const ConnectionData = mongoose.model('ConnectionData');
    await ConnectionData.updateOne(
      { _id: doc.idKoneksiData },
      {
        $set: {
          isPemasanganDone: true,
          meteranId: doc._id
        }
      }
    );
  } catch (error) {
    console.error('Error updating connection data:', error);
  }
});

export default mongoose.model("Pemasangan", PemasanganSchema);
