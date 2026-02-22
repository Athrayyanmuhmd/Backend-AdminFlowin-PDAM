/**
 * PekerjaanTeknisi Model (ERD Compliant)
 *
 * Collection: pekerjaanteknisis
 *
 * Purpose: Track technician work assignments for installations, surveys,
 * inspections, and maintenance tasks
 *
 * ERD Reference: PekerjaanTeknisi entity
 */

import mongoose from "mongoose";

const PekerjaanTeknisiSchema = new mongoose.Schema(
  {
    // Survey reference (optional)
    idSurvei: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SurveyData",  // Collection name: surveydatas
      default: null,
    },

    // RAB (Budget Estimate) reference (optional)
    rabId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RabConnection",  // Collection name: rabconnections
      default: null,
    },

    // Direct Laporan reference (optional) - for work orders created from customer reports
    idLaporan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Laporan",  // Collection name: laporans
      default: null,
    },

    // Report Resolution reference (optional)
    idPenyelesaianLaporan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PenyelesaianLaporan",  // Collection name: penyelesaianlaporans
      default: null,
    },

    // Installation reference (required for installation work)
    idPemasangan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pemasangan",  // Collection name: pemasangans
      default: null,
    },

    // Installation Supervision reference (optional)
    idPengawasanPemasangan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PengawasanPemasangan",  // Collection name: pengawasanpemasangans
      default: null,
    },

    // Post-Installation Supervision reference (optional)
    idPengawasanSetelahPemasangan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PengawasanSetelahPemasangan",  // Collection name: pengawasansetelahpemasangans
      default: null,
    },

    // Technician Team (array of technician IDs)
    tim: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Teknisi",  // Collection name: teknisis
      required: true,
      validate: {
        validator: function(v) {
          return v && v.length > 0;
        },
        message: "Tim harus minimal memiliki 1 teknisi"
      }
    },

    // Work Status (EnumWorkStatus from ERD)
    status: {
      type: String,
      enum: [
        "Ditunda",           // Postponed
        "Ditugaskan",        // Assigned
        "DitinjauAdmin",     // Under Admin Review
        "SedangDikerjakan",  // In Progress
        "Selesai",           // Completed
        "Dibatalkan"         // Cancelled
      ],
      required: true,
      default: "Ditugaskan"
    },

    // Approval Status
    disetujui: {
      type: Boolean,
      default: null,  // null = pending, true = approved, false = rejected
    },

    // Notes/Comments
    catatan: {
      type: String,
      default: null,
    }
  },
  {
    timestamps: true,  // Adds createdAt and updatedAt
    collection: "pekerjaanteknisis"  // Explicit collection name
  }
);

// Indexes for better query performance
PekerjaanTeknisiSchema.index({ status: 1 });
PekerjaanTeknisiSchema.index({ disetujui: 1 });
PekerjaanTeknisiSchema.index({ tim: 1 });
PekerjaanTeknisiSchema.index({ idSurvei: 1 });
PekerjaanTeknisiSchema.index({ rabId: 1 });

// Virtual populate for technician team details
PekerjaanTeknisiSchema.virtual('timDetails', {
  ref: 'Teknisi',
  localField: 'tim',
  foreignField: '_id'
});

// Instance method: Check if work is completed
PekerjaanTeknisiSchema.methods.isSelesai = function() {
  return this.status === "Selesai";
};

// Instance method: Check if work is in progress
PekerjaanTeknisiSchema.methods.isSedangDikerjakan = function() {
  return this.status === "SedangDikerjakan";
};

// Instance method: Check if approved
PekerjaanTeknisiSchema.methods.isDisetujui = function() {
  return this.disetujui === true;
};

// Static method: Find all by technician ID
PekerjaanTeknisiSchema.statics.findByTeknisi = function(teknisiId) {
  return this.find({ tim: teknisiId });
};

// Static method: Find all by status
PekerjaanTeknisiSchema.statics.findByStatus = function(status) {
  return this.find({ status: status });
};

// Static method: Find all pending approval
PekerjaanTeknisiSchema.statics.findPendingApproval = function() {
  return this.find({ disetujui: null, status: "DitinjauAdmin" });
};

// Pre-save hook: Validate references
PekerjaanTeknisiSchema.pre('save', function(next) {
  // At least one reference must be provided
  const hasReference =
    this.idSurvei ||
    this.rabId ||
    this.idLaporan ||
    this.idPenyelesaianLaporan ||
    this.idPemasangan ||
    this.idPengawasanPemasangan ||
    this.idPengawasanSetelahPemasangan;

  if (!hasReference) {
    next(new Error('Pekerjaan teknisi harus memiliki minimal 1 referensi (survei, RAB, laporan, pemasangan, atau pengawasan)'));
  } else {
    next();
  }
});

export default mongoose.model("PekerjaanTeknisi", PekerjaanTeknisiSchema);
