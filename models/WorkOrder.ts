import { Schema, model, Types, Document, Model } from 'mongoose';

// Legacy model — uses English field names; kept for backward compat. Do NOT remove.
export interface IWorkOrder {
  workOrderNumber: string;
  type: 'installation' | 'repair' | 'survey' | 'inspection' | 'complaint' | 'maintenance';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'rejected';
  customerId?: Types.ObjectId | null;
  customerName?: string | null;
  customerPhone?: string | null;
  connectionDataId?: Types.ObjectId | null;
  meteranId?: Types.ObjectId | null;
  assignedTechnicianId?: Types.ObjectId | null;
  assignedBy?: Types.ObjectId | null;
  assignedAt?: Date | null;
  scheduledDate: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  estimatedDuration?: number;
  actualDuration?: number | null;
  location: {
    address: string;
    kecamatan?: string | null;
    kelurahan?: string | null;
    coordinates?: { latitude?: number | null; longitude?: number | null };
  };
  description: string;
  notes?: string | null;
  adminNotes?: string | null;
  completionReport?: {
    summary?: string | null;
    workDone?: string | null;
    materialsUsed?: { materialName: string; quantity: number; unit: string }[];
    issues?: string | null;
    recommendations?: string | null;
    technicianSignature?: string | null;
  };
  photos?: {
    before?: { url: string; description: string; uploadedAt: Date }[];
    after?: { url: string; description: string; uploadedAt: Date }[];
  };
  cancellationReason?: string | null;
  rejectionReason?: string | null;
  additionalTechnicianRequest?: {
    isRequested?: boolean;
    reason?: string | null;
    requestedAt?: Date | null;
    isApproved?: boolean;
    approvedBy?: Types.ObjectId | null;
    additionalTechnicianId?: Types.ObjectId | null;
  };
  customerRating?: {
    rating?: number | null;
    feedback?: string | null;
    ratedAt?: Date | null;
  };
  activityLog?: {
    action: string;
    performedBy: { userId: Types.ObjectId; userType: string; userName: string };
    timestamp: Date;
    details: string;
  }[];
}

export interface IWorkOrderDocument extends IWorkOrder, Document {
  isOverdue: boolean;
}

interface IWorkOrderModel extends Model<IWorkOrderDocument> {
  generateWorkOrderNumber(): Promise<string>;
}

const WorkOrderSchema = new Schema<IWorkOrderDocument>(
  {
    workOrderNumber: { type: String, required: true, unique: true },
    type: { type: String, enum: ['installation', 'repair', 'survey', 'inspection', 'complaint', 'maintenance'], required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['pending', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled', 'rejected'], default: 'pending' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Users', default: null },
    customerName: { type: String, default: null },
    customerPhone: { type: String, default: null },
    connectionDataId: { type: Schema.Types.ObjectId, ref: 'ConnectionData', default: null },
    meteranId: { type: Schema.Types.ObjectId, ref: 'Meteran', default: null },
    assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    assignedAt: { type: Date, default: null },
    scheduledDate: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    estimatedDuration: { type: Number, default: 120 },
    actualDuration: { type: Number, default: null },
    location: {
      address: { type: String, required: true },
      kecamatan: { type: String, default: null },
      kelurahan: { type: String, default: null },
      coordinates: { latitude: { type: Number, default: null }, longitude: { type: Number, default: null } },
    },
    description: { type: String, required: true },
    notes: { type: String, default: null },
    adminNotes: { type: String, default: null },
    completionReport: {
      summary: { type: String, default: null },
      workDone: { type: String, default: null },
      materialsUsed: [{ materialName: String, quantity: Number, unit: String }],
      issues: { type: String, default: null },
      recommendations: { type: String, default: null },
      technicianSignature: { type: String, default: null },
    },
    photos: {
      before: [{ url: String, description: String, uploadedAt: Date }],
      after: [{ url: String, description: String, uploadedAt: Date }],
    },
    cancellationReason: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    additionalTechnicianRequest: {
      isRequested: { type: Boolean, default: false },
      reason: { type: String, default: null },
      requestedAt: { type: Date, default: null },
      isApproved: { type: Boolean, default: false },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
      additionalTechnicianId: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    },
    customerRating: {
      rating: { type: Number, min: 1, max: 5, default: null },
      feedback: { type: String, default: null },
      ratedAt: { type: Date, default: null },
    },
    activityLog: [{
      action: String,
      performedBy: { userId: Schema.Types.ObjectId, userType: String, userName: String },
      timestamp: { type: Date, default: Date.now },
      details: String,
    }],
  },
  { timestamps: true }
);

WorkOrderSchema.index({ status: 1 });
WorkOrderSchema.index({ assignedTechnicianId: 1 });
WorkOrderSchema.index({ customerId: 1 });
WorkOrderSchema.index({ scheduledDate: 1 });
WorkOrderSchema.index({ createdAt: -1 });

WorkOrderSchema.virtual('isOverdue').get(function () {
  if (this.status !== 'completed' && this.status !== 'cancelled') {
    return new Date() > this.scheduledDate;
  }
  return false;
});

WorkOrderSchema.statics.generateWorkOrderNumber = async function (): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const lastWO = await this.findOne({ workOrderNumber: new RegExp(`^WO-${dateStr}-`) }).sort({ workOrderNumber: -1 });
  let sequence = 1;
  if (lastWO) {
    const lastSeq = parseInt(lastWO.workOrderNumber.split('-')[2]);
    sequence = lastSeq + 1;
  }
  return `WO-${dateStr}-${sequence.toString().padStart(4, '0')}`;
};

export default model<IWorkOrderDocument, IWorkOrderModel>('WorkOrder', WorkOrderSchema);
