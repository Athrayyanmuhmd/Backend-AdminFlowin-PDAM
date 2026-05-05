/**
 * One-time migration: hapus field yang bernilai null dari collection penggunas.
 *
 * Field-field berikut tidak lagi punya default:null di schema, sehingga dokumen BARU
 * tidak menyimpannya kecuali diisi eksplisit. Script ini membersihkan dokumen LAMA
 * agar konsisten dengan schema baru dan dengan dokumen dari backend Ahmad.
 *
 * Field yang dibersihkan (hanya jika nilainya null):
 *   - SambunganDataId, meteranId, iotConnectionId  (legacy IoT, tidak dipakai di alur baru)
 *   - gender, birthDate, occupation, location       (profil opsional, hanya simpan jika ada isi)
 *
 * Catatan: birthDate yang sudah terisi nilai nyata TIDAK dihapus.
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
  // Field yang hanya dihapus jika nilainya null (bukan jika ada isi nyata)
  const nullFields = [
    'SambunganDataId', 'meteranId', 'iotConnectionId',
    'gender', 'birthDate', 'occupation', 'location',
  ];

  const orConditions = nullFields.map(f => ({ [f]: { $exists: true, $eq: null } }));
  const total = await col.countDocuments({ $or: orConditions });

  console.log(`📋 Ditemukan ${total} dokumen dengan field null yang perlu dibersihkan...`);

  const unsetFields: Record<string, ''> = {};
  nullFields.forEach(f => { unsetFields[f] = ''; });

  const result = await col.updateMany(
    { $or: orConditions },
    { $unset: unsetFields }
  );

  console.log(`✅ Selesai — ${result.modifiedCount} dokumen diperbarui`);

  // Verifikasi menggunakan $exists:true $eq:null agar tidak salah hitung
  const sisaExplicitNull = await col.countDocuments({ $or: orConditions });
  const adaIsiNyata = await col.countDocuments({
    $or: nullFields.map(f => ({ [f]: { $exists: true, $ne: null } })),
  });

  console.log(`\n📊 Hasil verifikasi:`);
  console.log(`   Field null yang masih ada (harus 0) : ${sisaExplicitNull}`);
  console.log(`   Field dengan isi nyata (dipertahankan): ${adaIsiNyata}`);

  await mongoose.disconnect();
  console.log('\n✅ Migration selesai.');
}

run().catch(err => {
  console.error('❌ Migration gagal:', err);
  process.exit(1);
});
