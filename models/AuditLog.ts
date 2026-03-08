import { Schema, model, Types, Document } from 'mongoose';

export interface IAuditLog {
  idAdmin?: Types.ObjectId | null;
  namaAdmin: string;
  aksi: string;
  resource: string;
  resourceId?: string | null;
  nilaiBefore?: any;
  nilaiAfter?: any;
  catatan?: string | null;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    idAdmin: { type: Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    namaAdmin: { type: String, required: true },
    aksi: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String, default: null },
    nilaiBefore: { type: Schema.Types.Mixed, default: null },
    nilaiAfter: { type: Schema.Types.Mixed, default: null },
    catatan: { type: String, default: null },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ aksi: 1 });
AuditLogSchema.index({ idAdmin: 1 });

export default model<IAuditLog>('AuditLog', AuditLogSchema);
