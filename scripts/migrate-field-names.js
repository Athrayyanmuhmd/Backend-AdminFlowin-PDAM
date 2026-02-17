/**
 * MIGRATION SCRIPT: Field Name Standardization
 *
 * Purpose: Update all field names to match ERD (Indonesian naming)
 *
 * Changes:
 * 1. KelompokPelanggan: hargaPenggunaanDibawah10 → hargaDiBawah10mKubik
 * 2. HistoryUsage: usedWater → penggunaanAir
 * 3. RabConnection: isPaid (boolean) → statusPembayaran (enum), rabUrl → urlRab
 * 4. User: English fields → Indonesian (address → alamat, etc.)
 * 5. AdminAccount: Add NIP field
 * 6. Notification: Add isRead field
 *
 * CRITICAL: Run after collection migration script
 *
 * Usage:
 *   node scripts/migrate-field-names.js
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

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('✅ Connected to MongoDB', 'green');
  } catch (error) {
    log('❌ MongoDB connection failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

async function createBackup(collectionName) {
  log(`\n📦 Creating backup: ${collectionName}_fieldbackup...`, 'blue');

  const source = mongoose.connection.db.collection(collectionName);
  const backup = mongoose.connection.db.collection(`${collectionName}_fieldbackup`);

  try {
    await backup.drop();
  } catch (e) {
    // Doesn't exist, that's fine
  }

  const documents = await source.find().toArray();

  if (documents.length > 0) {
    await backup.insertMany(documents);
    log(`✅ Backed up ${documents.length} documents`, 'green');
  } else {
    log(`⚠️  Collection empty, backup skipped`, 'yellow');
  }

  return documents.length;
}

async function migrateKelompokPelanggan() {
  logSection('MIGRATION 1: KelompokPelanggan Field Names');

  const collectionName = 'kelompokpelanggans';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Renaming fields...`, 'blue');

  const result = await collection.updateMany(
    {},
    {
      $rename: {
        'hargaPenggunaanDibawah10': 'hargaDiBawah10mKubik',
        'hargaPenggunaanDiatas10': 'hargaDiAtas10mKubik'
      }
    }
  );

  log(`✅ Updated ${result.modifiedCount} documents`, 'green');

  // Verify
  const sample = await collection.findOne({});
  if (sample) {
    log(`\n✓ Verification:`, 'cyan');
    log(`  hargaDiBawah10mKubik: ${sample.hargaDiBawah10mKubik}`, 'yellow');
    log(`  hargaDiAtas10mKubik: ${sample.hargaDiAtas10mKubik}`, 'yellow');
  }
}

async function migrateHistoryUsage() {
  logSection('MIGRATION 2: HistoryUsage Field Names');

  const collectionName = 'historyusages';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Renaming: usedWater → penggunaanAir...`, 'blue');

  const result = await collection.updateMany(
    {},
    {
      $rename: {
        'usedWater': 'penggunaanAir'
      }
    }
  );

  log(`✅ Updated ${result.modifiedCount} documents`, 'green');
}

async function migrateRabConnection() {
  logSection('MIGRATION 3: RabConnection Field Names & Types');

  const collectionName = 'rabconnections';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  // Step 1: Convert isPaid (boolean) → statusPembayaran (enum)
  log(`\n🔄 Converting isPaid (boolean) → statusPembayaran (enum)...`, 'blue');

  const paidDocs = await collection.updateMany(
    { isPaid: true },
    {
      $set: { statusPembayaran: 'Settlement' },
      $unset: { isPaid: '' }
    }
  );

  log(`  ✓ Converted ${paidDocs.modifiedCount} paid documents to 'Settlement'`, 'green');

  const unpaidDocs = await collection.updateMany(
    { isPaid: false },
    {
      $set: { statusPembayaran: 'Pending' },
      $unset: { isPaid: '' }
    }
  );

  log(`  ✓ Converted ${unpaidDocs.modifiedCount} unpaid documents to 'Pending'`, 'green');

  // Step 2: Rename rabUrl → urlRab
  log(`\n🔄 Renaming: rabUrl → urlRab...`, 'blue');

  const renameResult = await collection.updateMany(
    {},
    {
      $rename: {
        'rabUrl': 'urlRab'
      }
    }
  );

  log(`✅ Updated ${renameResult.modifiedCount} documents`, 'green');

  // Verify
  const sample = await collection.findOne({});
  if (sample) {
    log(`\n✓ Verification:`, 'cyan');
    log(`  statusPembayaran: ${sample.statusPembayaran}`, 'yellow');
    log(`  urlRab: ${sample.urlRab}`, 'yellow');
    log(`  isPaid exists: ${sample.isPaid !== undefined}`, sample.isPaid !== undefined ? 'red' : 'green');
  }
}

async function migrateUser() {
  logSection('MIGRATION 4: User/Pengguna Field Names (English → Indonesian)');

  const collectionName = 'penggunas'; // After collection migration
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Renaming English fields to Indonesian...`, 'blue');

  const renameMap = {
    'address': 'alamat',
    'gender': 'jenisKelamin',
    'birthDate': 'tanggalLahir',
    'occupation': 'pekerjaan',
    'location': 'lokasi',
    'customerType': 'tipePelanggan',
    'accountStatus': 'statusAkun',
  };

  const result = await collection.updateMany(
    {},
    { $rename: renameMap }
  );

  log(`✅ Updated ${result.modifiedCount} documents`, 'green');

  // Verify
  const sample = await collection.findOne({});
  if (sample) {
    log(`\n✓ Verification (Indonesian fields):`, 'cyan');
    log(`  alamat: ${sample.alamat || 'N/A'}`, 'yellow');
    log(`  jenisKelamin: ${sample.jenisKelamin || 'N/A'}`, 'yellow');
    log(`  tanggalLahir: ${sample.tanggalLahir || 'N/A'}`, 'yellow');
    log(`  tipePelanggan: ${sample.tipePelanggan || 'N/A'}`, 'yellow');
    log(`  statusAkun: ${sample.statusAkun || 'N/A'}`, 'yellow');

    log(`\n✓ Old English fields removed:`, 'cyan');
    log(`  address exists: ${sample.address !== undefined}`, sample.address !== undefined ? 'red' : 'green');
    log(`  gender exists: ${sample.gender !== undefined}`, sample.gender !== undefined ? 'red' : 'green');
  }
}

async function addMissingFieldsAdmin() {
  logSection('MIGRATION 5: AdminAccount - Add NIP Field');

  const collectionName = 'adminaccounts';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Adding NIP field to admins without it...`, 'blue');

  // Find admins without NIP
  const adminsWithoutNIP = await collection.find({ NIP: { $exists: false } }).toArray();

  if (adminsWithoutNIP.length === 0) {
    log(`✅ All admins already have NIP field`, 'green');
    return;
  }

  log(`  Found ${adminsWithoutNIP.length} admins without NIP`, 'yellow');

  // Generate temporary NIPs
  for (const admin of adminsWithoutNIP) {
    const tempNIP = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    await collection.updateOne(
      { _id: admin._id },
      { $set: { NIP: tempNIP } }
    );

    log(`  ✓ Added NIP to admin: ${admin.email} → ${tempNIP}`, 'cyan');
  }

  log(`\n✅ Added NIP to ${adminsWithoutNIP.length} admins`, 'green');
  log(`⚠️  IMPORTANT: Update temporary NIPs with real employee IDs!`, 'yellow');
}

async function addMissingFieldsNotification() {
  logSection('MIGRATION 6: Notification - Add isRead Field');

  const collectionName = 'notifikasis'; // After collection migration
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Adding isRead field (default: false)...`, 'blue');

  const result = await collection.updateMany(
    { isRead: { $exists: false } },
    { $set: { isRead: false } }
  );

  log(`✅ Updated ${result.modifiedCount} documents`, 'green');
}

async function verifyMigration() {
  logSection('FIELD MIGRATION VERIFICATION');

  const checks = [
    {
      collection: 'kelompokpelanggans',
      expectedFields: ['hargaDiBawah10mKubik', 'hargaDiAtas10mKubik'],
      deprecatedFields: ['hargaPenggunaanDibawah10', 'hargaPenggunaanDiatas10'],
    },
    {
      collection: 'historyusages',
      expectedFields: ['penggunaanAir'],
      deprecatedFields: ['usedWater'],
    },
    {
      collection: 'rabconnections',
      expectedFields: ['statusPembayaran', 'urlRab'],
      deprecatedFields: ['isPaid', 'rabUrl'],
    },
    {
      collection: 'penggunas',
      expectedFields: ['alamat', 'jenisKelamin', 'tanggalLahir', 'tipePelanggan', 'statusAkun'],
      deprecatedFields: ['address', 'gender', 'birthDate', 'customerType', 'accountStatus'],
    },
    {
      collection: 'adminaccounts',
      expectedFields: ['NIP'],
      deprecatedFields: [],
    },
    {
      collection: 'notifikasis',
      expectedFields: ['isRead'],
      deprecatedFields: [],
    },
  ];

  for (const check of checks) {
    const collection = mongoose.connection.db.collection(check.collection);
    const sample = await collection.findOne({});

    if (!sample) {
      log(`\n⏭️  ${check.collection}: No documents to verify`, 'yellow');
      continue;
    }

    log(`\n📋 ${check.collection}:`, 'cyan');

    // Check expected fields exist
    for (const field of check.expectedFields) {
      const exists = sample[field] !== undefined;
      if (exists) {
        log(`  ✅ ${field}: exists`, 'green');
      } else {
        log(`  ❌ ${field}: MISSING!`, 'red');
      }
    }

    // Check deprecated fields removed
    for (const field of check.deprecatedFields) {
      const exists = sample[field] !== undefined;
      if (!exists) {
        log(`  ✅ ${field}: removed`, 'green');
      } else {
        log(`  ⚠️  ${field}: STILL EXISTS!`, 'red');
      }
    }
  }
}

async function main() {
  log('\n' + '█'.repeat(60), 'magenta');
  log('█' + ' '.repeat(58) + '█', 'magenta');
  log('█' + '  AQUALINK FIELD NAME MIGRATION'.padEnd(59) + '█', 'magenta');
  log('█' + '  ERD Compliance - Indonesian Naming'.padEnd(59) + '█', 'magenta');
  log('█' + ' '.repeat(58) + '█', 'magenta');
  log('█'.repeat(60), 'magenta');

  log(`\nTimestamp: ${new Date().toISOString()}`, 'cyan');
  log(`Database: ${process.env.MONGO_URI}`, 'cyan');

  try {
    await connectDB();

    // Run all field migrations
    await migrateKelompokPelanggan();
    await migrateHistoryUsage();
    await migrateRabConnection();
    await migrateUser();
    await addMissingFieldsAdmin();
    await addMissingFieldsNotification();

    // Verify all changes
    await verifyMigration();

    logSection('FIELD MIGRATION COMPLETED');

    log(`\n📌 IMPORTANT NEXT STEPS:`, 'yellow');
    log(`  1. Update model definitions to match new field names`, 'yellow');
    log(`  2. Update GraphQL resolvers (if needed)`, 'yellow');
    log(`  3. Test all GraphQL queries with new field names`, 'yellow');
    log(`  4. Update frontend code to use new field names`, 'yellow');
    log(`  5. Replace temporary admin NIPs with real employee IDs`, 'yellow');

    log(`\n✅ All field migrations completed successfully!`, 'green');

  } catch (error) {
    log(`\n❌ MIGRATION FAILED:`, 'red');
    console.error(error);
    log(`\n⚠️  Check field backups: [collection]_fieldbackup`, 'red');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log(`\n🔌 Database connection closed`, 'blue');
  }
}

main();
