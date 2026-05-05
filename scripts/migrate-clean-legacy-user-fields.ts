/**
 * One-time migration: hapus field legacy IoT yang bernilai null dari collection penggunas.
 *
 * Field SambunganDataId, meteranId, iotConnectionId tidak lagi punya default: null di schema,
 * sehingga dokumen BARU tidak menyimpannya. Script ini membersihkan dokumen LAMA
 * agar konsisten dengan schema baru dan dengan dokumen yang dibuat oleh backend Ahmad.
 *
 * Aman dijalankan berkali-kali (idempotent).
 *
 * Cara pakai:
 *   cd BE_backend
 *   npx tsx scripts/migrate-clean-legacy-user-fields.ts
 */

import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';

configDotenv();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI tidak ditemukan di .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI!);
  console.log('✅ MongoDB terhubung');

  const db = mongoose.connection.db!;
  const col = db.collection('penggunas');

  // Hitung dokumen yang akan diproses
  const total = await col.countDocuments({
    $or: [
      { SambunganDataId: null },
      { meteranId: null },
      { iotConnectionId: null },
    ],
  });

  console.log(`📋 Ditemukan ${total} dokumen dengan field legacy null — mulai $unset...`);

  const result = await col.updateMany(
    {
      $or: [
        { SambunganDataId: null },
        { meteranId: null },
        { iotConnectionId: null },
      ],
    },
    {
      $unset: {
        SambunganDataId: '',
        meteranId: '',
        iotConnectionId: '',
      },
    }
  );

  console.log(`✅ Selesai — ${result.modifiedCount} dokumen diperbarui dari ${result.matchedCount} yang cocok`);

  // Verifikasi
  const sisaNull = await col.countDocuments({
    $or: [
      { SambunganDataId: null },
      { meteranId: null },
      { iotConnectionId: null },
    ],
  });
  const sisaField = await col.countDocuments({
    $or: [
      { SambunganDataId: { $exists: true } },
      { meteranId: { $exists: true } },
      { iotConnectionId: { $exists: true } },
    ],
  });

  console.log(`\n📊 Hasil verifikasi:`);
  console.log(`   Dokumen dengan field legacy null  : ${sisaNull} (target: 0)`);
  console.log(`   Dokumen dengan field legacy ada   : ${sisaField} (ini yang punya IoT aktif — dibiarkan)`);

  await mongoose.disconnect();
  console.log('\n✅ Migration selesai.');
}

run().catch(err => {
  console.error('❌ Migration gagal:', err);
  process.exit(1);
});
