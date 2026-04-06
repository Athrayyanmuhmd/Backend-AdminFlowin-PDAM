import { Schema, model, Types, Document } from 'mongoose';

export interface IIoTConnection {
  userId: Types.ObjectId;
  meteranId: Types.ObjectId;
  deviceId?: string | null;
  pairingCode?: string | null;
  pairingCodeExpiry?: Date | null;
  status?: 'pending' | 'connected' | 'disconnected' | 'error';
  connectedAt?: Date | null;
  lastSync?: Date | null;
  connectionMethod?: 'bluetooth' | 'wifi';
  errorMessage?: string | null;
}

export interface IIoTConnectionDocument extends IIoTConnection, Document {}

const IoTConnectionSchema = new Schema<IIoTConnection>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Pengguna', required: true },
    meteranId: { type: Schema.Types.ObjectId, ref: 'Meteran', required: true },
    deviceId: { type: String, default: null },
    pairingCode: { type: String, default: null },
    pairingCodeExpiry: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'connected', 'disconnected', 'error'], default: 'pending' },
    connectedAt: { type: Date, default: null },
    lastSync: { type: Date, default: null },
    connectionMethod: { type: String, enum: ['bluetooth', 'wifi'], default: 'bluetooth' },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

IoTConnectionSchema.index({ userId: 1 });
IoTConnectionSchema.index({ meteranId: 1 });
IoTConnectionSchema.index({ deviceId: 1 });
IoTConnectionSchema.index({ pairingCode: 1 });

export default model<IIoTConnection>('IoTConnection', IoTConnectionSchema);
