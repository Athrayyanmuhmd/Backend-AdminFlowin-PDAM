/**
 * CHECK FIELD NAMES SCRIPT
 *
 * Purpose: Inspect actual field names in database collections
 * Before running field migration
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('✅ Connected to MongoDB', 'green');
  } catch (error) {
    log('❌ Connection failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

async function checkCollectionFields(collectionName, description, erdFields) {
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`  ${description.toUpperCase()}`, 'cyan');
  log(`${'='.repeat(70)}`, 'cyan');

  const collection = mongoose.connection.db.collection(collectionName);
  const count = await collection.countDocuments();

  log(`\n📊 Collection: ${collectionName} (${count} documents)`, 'blue');

  if (count === 0) {
    log(`⏭️  No documents to check`, 'yellow');
    return;
  }

  // Get sample document
  const sample = await collection.findOne({});

  if (!sample) {
    log(`⚠️  No sample document found`, 'yellow');
    return;
  }

  log(`\n📋 Sample Document Fields:`, 'yellow');

  const actualFields = Object.keys(sample).filter(key => !key.startsWith('_') && key !== '__v');

  for (const field of actualFields) {
    const value = sample[field];
    const valueType = Array.isArray(value) ? 'Array' : typeof value;
    const displayValue = typeof value === 'object' && value !== null
      ? JSON.stringify(value).substring(0, 50)
      : String(value).substring(0, 30);

    log(`  - ${field.padEnd(30)} (${valueType.padEnd(10)}) = ${displayValue}`, 'cyan');
  }

  // Check against ERD expected fields
  if (erdFields && erdFields.length > 0) {
    log(`\n✓ ERD Compliance Check:`, 'yellow');

    for (const erdField of erdFields) {
      const exists = actualFields.includes(erdField);
      if (exists) {
        log(`  ✅ ${erdField} - exists`, 'green');
      } else {
        log(`  ❌ ${erdField} - MISSING!`, 'red');
      }
    }

    // Check for unexpected fields (not in ERD)
    const unexpectedFields = actualFields.filter(f => !erdFields.includes(f) && f !== 'createdAt' && f !== 'updatedAt');
    if (unexpectedFields.length > 0) {
      log(`\n⚠️  Unexpected fields (not in ERD):`, 'yellow');
      for (const field of unexpectedFields) {
        log(`  - ${field}`, 'yellow');
      }
    }
  }
}

async function main() {
  log('\n' + '█'.repeat(70), 'magenta');
  log('█' + '  FIELD NAME INSPECTION REPORT'.padEnd(69) + '█', 'magenta');
  log('█'.repeat(70), 'magenta');

  try {
    await connectDB();

    // Check collections with data
    await checkCollectionFields('penggunas', 'User/Customer Data', [
      'email', 'namaLengkap', 'noHP', 'nik',
      'alamat', 'jenisKelamin', 'tanggalLahir', 'pekerjaan',
      'lokasi', 'tipePelanggan', 'statusAkun',
      'password', 'token', 'isVerified'
    ]);

    await checkCollectionFields('teknisis', 'Technician Data', [
      'namaLengkap', 'nip', 'email', 'noHP', 'divisi',
      'password', 'token'
    ]);

    await checkCollectionFields('notifikasis', 'Notification Data', [
      'userId', 'judul', 'pesan', 'kategori', 'link', 'isRead'
    ]);

    await checkCollectionFields('adminaccounts', 'Admin Account Data', [
      'NIP', 'namaLengkap', 'email', 'noHP', 'password', 'token'
    ]);

    await checkCollectionFields('wallets', 'Wallet Data', [
      'userId', 'balance', 'pendingBalance', 'conservationToken'
    ]);

    await checkCollectionFields('pekerjaanteknisis', 'Work Assignment Data', [
      'idSurvei', 'rabId', 'idPenyelesaianLaporan',
      'idPemasangan', 'idPengawasanPemasangan', 'idPengawasanSetelahPemasangan',
      'tim', 'status', 'disetujui', 'catatan'
    ]);

    // Also check empty but important collections
    await checkCollectionFields('kelompokpelanggans', 'Customer Group Data', [
      'namaKelompok', 'hargaDiBawah10mKubik', 'hargaDiAtas10mKubik', 'biayaBeban'
    ]);

    await checkCollectionFields('rabconnections', 'RAB Connection Data', [
      'connectionDataId', 'userId', 'technicianId',
      'totalBiaya', 'statusPembayaran', 'urlRab', 'catatan'
    ]);

    await checkCollectionFields('meterans', 'Meteran Data', [
      'connectionDataId', 'nomorMeteran', 'nomorAkun',
      'kelompokPelangganId', 'totalPemakaian', 'pemakaianBelumTerbayar',
      'jatuhTempo', 'userId'
    ]);

    log('\n' + '='.repeat(70), 'green');
    log('  ✅ INSPECTION COMPLETE', 'green');
    log('='.repeat(70), 'green');

  } catch (error) {
    log('\n❌ ERROR:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log('\n🔌 Connection closed\n', 'blue');
  }
}

main();
