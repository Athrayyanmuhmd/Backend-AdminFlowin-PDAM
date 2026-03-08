/**
 * Migration: statusVerifikasi Boolean → String enum
 * false → 'Menunggu', true → 'Disetujui'
 * Run once: node scripts/migrate-status-verifikasi.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected to MongoDB');

const db = mongoose.connection.db;
const col = db.collection('koneksidatas');

const falseResult = await col.updateMany(
  { statusVerifikasi: false },
  { $set: { statusVerifikasi: 'Menunggu' } }
);
console.log(`false → 'Menunggu': ${falseResult.modifiedCount} docs`);

const trueResult = await col.updateMany(
  { statusVerifikasi: true },
  { $set: { statusVerifikasi: 'Disetujui' } }
);
console.log(`true → 'Disetujui': ${trueResult.modifiedCount} docs`);

const nullResult = await col.updateMany(
  { statusVerifikasi: { $exists: false } },
  { $set: { statusVerifikasi: 'Menunggu' } }
);
console.log(`null/missing → 'Menunggu': ${nullResult.modifiedCount} docs`);

console.log('Migration complete');
await mongoose.disconnect();
