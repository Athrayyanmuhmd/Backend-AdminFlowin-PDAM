import { Schema, model, Types, Document } from 'mongoose';

/**
 * ⚠️ JANGAN rename field userId / meteranId
 * IoT REST pipeline di historyUsageController.js bergantung pada nama field ini.
 */
export interface IHistoryUsage {
  userId: Types.ObjectId;
  meteranId: Types.ObjectId;
  penggunaanAir: number;
}

export interface IHistoryUsageDocument extends IHistoryUsage, Document {}

const historyUsageSchema = new Schema<IHistoryUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: true },
    meteranId: { type: Schema.Types.ObjectId, ref: 'Meteran', required: true },
    penggunaanAir: { type: Number, required: true },
  },
  {
    timestamps: true,
    collection: 'riwayatpenggunaans',
  }
);

historyUsageSchema.index({ meteranId: 1, createdAt: -1 });
historyUsageSchema.index({ userId: 1, createdAt: -1 });
historyUsageSchema.index({ userId: 1, meteranId: 1, createdAt: -1 });

export default model<IHistoryUsage>('RiwayatPenggunaan', historyUsageSchema);
