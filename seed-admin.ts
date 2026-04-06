/**
 * Script untuk membuat / reset akun admin test.
 * Jalankan: npx tsx seed-admin.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import AdminAccount from './models/AdminAccount.js';

const MONGO_URI = process.env.MONGO_URI!;

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAMA = 'Administrator Test';
const ADMIN_NIP = 'ADM001';
const ADMIN_NOHP = '081234567890';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await AdminAccount.findOne({ email: ADMIN_EMAIL });

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (existing) {
    existing.password = hashed;
    existing.namaLengkap = ADMIN_NAMA;
    await existing.save();
    console.log(`✅ Password admin "${ADMIN_EMAIL}" berhasil direset ke "${ADMIN_PASSWORD}"`);
  } else {
    await AdminAccount.create({
      email: ADMIN_EMAIL,
      password: hashed,
      namaLengkap: ADMIN_NAMA,
      NIP: ADMIN_NIP,
      noHP: ADMIN_NOHP,
    });
    console.log(`✅ Akun admin baru dibuat: "${ADMIN_EMAIL}" / "${ADMIN_PASSWORD}"`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
