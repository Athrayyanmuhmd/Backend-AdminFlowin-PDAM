import { Schema, model, Document } from 'mongoose';

// Legacy model
export interface IWaterCredit {
  owner: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
  };
  cost: number;
  perLiter: number;
  billingTime: 'Perhari' | 'Perminggu' | 'Perbulan' | 'Pertahun';
  conservationToken: {
    rewardToken: number;
    maxWaterUse: number;
    tokenRewardTempo: 'Perhari' | 'Perminggu' | 'Perbulan' | 'Pertahun';
  };
  waterQuality: 'Kurang Bagus' | 'Bagus' | 'Sangat Bagus';
  income: number;
  totalIncome: number;
  withdrawl: number;
  totalUser: number;
  location: {
    address: string;
    coordinates: { long: number; lat: number };
  };
}

export interface IWaterCreditDocument extends IWaterCredit, Document {}

const WaterCreditSchema = new Schema<IWaterCredit>(
  {
    owner: {
      id: String,
      fullName: String,
      phone: String,
      email: String,
    },
    cost: { type: Number, required: true },
    perLiter: { type: Number, required: true },
    billingTime: { type: String, required: true, enum: ['Perhari', 'Perminggu', 'Perbulan', 'Pertahun'], default: 'Perbulan' },
    conservationToken: {
      rewardToken: { type: Number, required: true },
      maxWaterUse: { type: Number, required: true },
      tokenRewardTempo: { type: String, required: true, enum: ['Perhari', 'Perminggu', 'Perbulan', 'Pertahun'], default: 'Perbulan' },
    },
    waterQuality: { type: String, required: true, enum: ['Kurang Bagus', 'Bagus', 'Sangat Bagus'], default: 'Bagus' },
    income: { type: Number, required: true, default: 0 },
    totalIncome: { type: Number, required: true, default: 0 },
    withdrawl: { type: Number, required: true, default: 0 },
    totalUser: { type: Number, required: true, default: 0 },
    location: {
      address: { type: String, required: true },
      coordinates: {
        long: { type: Number, required: true },
        lat: { type: Number, required: true },
      },
    },
  },
  { timestamps: true }
);

export default model<IWaterCredit>('WaterCredits', WaterCreditSchema);
