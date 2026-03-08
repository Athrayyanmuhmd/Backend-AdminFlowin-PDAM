import { Schema, model, Document } from 'mongoose';

// Legacy model
export interface ISubscribe {
  customerDetail: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  waterCreditId: string;
  totalUsedWater: number;
  usedWaterInTempo: number;
  subscribeStatus: boolean;
  isPipeClose: boolean;
}

export interface ISubscribeDocument extends ISubscribe, Document {}

const SubscribeSchema = new Schema<ISubscribe>(
  {
    customerDetail: {
      id: { type: String, required: true },
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    waterCreditId: { type: String, required: true },
    totalUsedWater: { type: Number, required: true, default: 0 },
    usedWaterInTempo: { type: Number, required: true, default: 0 },
    subscribeStatus: { type: Boolean, required: true, default: true },
    isPipeClose: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export default model<ISubscribe>('Subscribes', SubscribeSchema);
