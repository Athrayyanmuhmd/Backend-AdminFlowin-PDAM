import { Schema, model, Document } from 'mongoose';

export interface IMidTrans {
  orderId: string;
  amount: number;
  paymentMethod?: string;
  paymentType?: string;
  transactionStatus?: string;
  customerDetails?: {
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export interface IMidTransDocument extends IMidTrans, Document {}

const MidTransSchema = new Schema<IMidTrans>(
  {
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: false },
    paymentType: { type: String },
    transactionStatus: { type: String, required: true, default: 'pending' },
    customerDetails: {
      userId: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
    },
  },
  { timestamps: true }
);

export default model<IMidTrans>('TransactionMidtrans', MidTransSchema);
