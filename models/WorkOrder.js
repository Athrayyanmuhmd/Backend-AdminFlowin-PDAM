import mongoose from "mongoose";

const WorkOrder = new mongoose.Schema(
  {
    workOrderNumber: {
      type: String,
      required: true,
      unique: true,
      // Format: WO-YYYYMMDD-XXXX (e.g., WO-20260212-0001)
    },
    type: {
      type: String,
      enum: ["installation", "repair", "survey", "inspection", "complaint", "maintenance"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled", "rejected"],
      default: "pending",
    },
    // Relasi ke User/Customer
    customerId: {
      type: mongoose.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    customerName: {
      type: String,
      default: null,
    },
    customerPhone: {
      type: String,
      default: null,
    },
    // Relasi ke ConnectionData (optional, untuk WO tipe installation/survey)
    connectionDataId: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      default: null,
    },
    // Relasi ke Meteran (optional, untuk WO tipe repair/maintenance)
    meteranId: {
      type: mongoose.Types.ObjectId,
      ref: "Meteran",
      default: null,
    },
    // Assignment info
    assignedTechnicianId: {
      type: mongoose.Types.ObjectId,
      ref: "Technician",
      default: null,
    },
    assignedBy: {
      type: mongoose.Types.ObjectId,
      ref: "AdminAccount",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    // Timestamps untuk tracking
    scheduledDate: {
      type: Date,
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    // Durasi
    estimatedDuration: {
      type: Number, // dalam menit
      default: 120, // default 2 jam
    },
    actualDuration: {
      type: Number, // dalam menit
      default: null,
    },
    // Lokasi
    location: {
      address: {
        type: String,
        required: true,
      },
      kecamatan: {
        type: String,
        default: null,
      },
      kelurahan: {
        type: String,
        default: null,
      },
      coordinates: {
        latitude: {
          type: Number,
          default: null,
        },
        longitude: {
          type: Number,
          default: null,
        },
      },
    },
    // Deskripsi pekerjaan
    description: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: null,
    },
    // Admin notes (internal)
    adminNotes: {
      type: String,
      default: null,
    },
    // Completion report (diisi oleh teknisi)
    completionReport: {
      summary: {
        type: String,
        default: null,
      },
      workDone: {
        type: String,
        default: null,
      },
      materialsUsed: [{
        materialName: String,
        quantity: Number,
        unit: String,
      }],
      issues: {
        type: String,
        default: null,
      },
      recommendations: {
        type: String,
        default: null,
      },
      technicianSignature: {
        type: String, // URL to signature image
        default: null,
      },
    },
    // Photos (before & after)
    photos: {
      before: [{
        url: String,
        description: String,
        uploadedAt: Date,
      }],
      after: [{
        url: String,
        description: String,
        uploadedAt: Date,
      }],
    },
    // Cancellation/rejection info
    cancellationReason: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    // Request for additional technician
    additionalTechnicianRequest: {
      isRequested: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      isApproved: {
        type: Boolean,
        default: false,
      },
      approvedBy: {
        type: mongoose.Types.ObjectId,
        ref: "AdminAccount",
        default: null,
      },
      additionalTechnicianId: {
        type: mongoose.Types.ObjectId,
        ref: "Technician",
        default: null,
      },
    },
    // Rating & feedback (optional, dari customer)
    customerRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      feedback: {
        type: String,
        default: null,
      },
      ratedAt: {
        type: Date,
        default: null,
      },
    },
    // Activity log
    activityLog: [{
      action: String, // e.g., "created", "assigned", "started", "completed", "updated"
      performedBy: {
        userId: mongoose.Types.ObjectId,
        userType: String, // "admin", "technician"
        userName: String,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      details: String,
    }],
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

// Index untuk query performance
// Note: workOrderNumber already indexed via unique: true
WorkOrder.index({ status: 1 });
WorkOrder.index({ assignedTechnicianId: 1 });
WorkOrder.index({ customerId: 1 });
WorkOrder.index({ scheduledDate: 1 });
WorkOrder.index({ createdAt: -1 });

// Virtual untuk menghitung apakah WO terlambat
WorkOrder.virtual('isOverdue').get(function() {
  if (this.status !== 'completed' && this.status !== 'cancelled') {
    return new Date() > this.scheduledDate;
  }
  return false;
});

// Method untuk generate work order number
WorkOrder.statics.generateWorkOrderNumber = async function() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Cari WO terakhir hari ini
  const lastWO = await this.findOne({
    workOrderNumber: new RegExp(`^WO-${dateStr}-`)
  }).sort({ workOrderNumber: -1 });

  let sequence = 1;
  if (lastWO) {
    const lastSeq = parseInt(lastWO.workOrderNumber.split('-')[2]);
    sequence = lastSeq + 1;
  }

  const seqStr = sequence.toString().padStart(4, '0');
  return `WO-${dateStr}-${seqStr}`;
};

export default mongoose.model("WorkOrder", WorkOrder);
