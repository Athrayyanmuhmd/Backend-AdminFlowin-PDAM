import { Schema, model, Document } from 'mongoose';

// Legacy model — kept for backward compat, do not add new features here
export interface ITransaction {
  name: string;
  userID: string;
  recieverID: string;
  amount: number;
  category: string;
}

export interface ITransactionDocument extends ITransaction, Document {}

const TransactionsSchema = new Schema<ITransaction>(
  {
    name: { type: String, required: true },
    userID: { type: String, required: true },
    recieverID: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
  },
  { timestamps: true }
);

TransactionsSchema.index({ userID: 1, createdAt: -1 });
TransactionsSchema.index({ category: 1 });

export default model<ITransaction>("Transactions", TransactionsSchema);
