import { Schema, model, Document } from 'mongoose';

// Legacy model
export interface IWallet {
  userId: string;
  balance: number;
  pendingBalance: number;
  conservationToken: number;
}

export interface IWalletDocument extends IWallet, Document {}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, required: true, default: 0 },
    pendingBalance: { type: Number, required: true, default: 0 },
    conservationToken: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default model<IWallet>('Wallets', WalletSchema);
