/**
 * FULL FIELD NAME MIGRATION SCRIPT
 *
 * Purpose: Migrate ALL field names to 100% ERD compliance (Indonesian)
 *
 * Collections to migrate:
 * 1. teknisis: fullName→namaLengkap, phone→noHP, add nip & divisi
 * 2. notifikasis: title→judul, message→pesan, category→kategori, add isRead
 * 3. adminaccounts: add NIP
 * 4. pekerjaanteknisis: surveiId→idSurvei, etc.
 *
 * CRITICAL: Creates backups before migration
 *
 * Usage: node scripts/migrate-field-names-full.js
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
  log('\n' + '='.repeat(70), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(70), 'cyan');
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

async function migrateTeknisis() {
  logSection('MIGRATION 1: Teknisis (Technician) Field Names');

  const collectionName = 'teknisis';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  // Step 0: Drop unique indexes on old fields
  log(`\n🔄 Step 0: Dropping old indexes (phone_1)...`, 'blue');
  try {
    await collection.dropIndex('phone_1');
    log(`  ✓ Dropped index: phone_1`, 'green');
  } catch (error) {
    if (error.code === 27 || error.codeName === 'IndexNotFound') {
      log(`  ⏭️  Index phone_1 not found, skipping`, 'yellow');
    } else {
      throw error;
    }
  }

  log(`\n🔄 Step 1: Renaming English fields to Indonesian...`, 'blue');

  // Rename fullName → namaLengkap, phone → noHP
  const renameResult = await collection.updateMany(
    {},
    {
      $rename: {
        'fullName': 'namaLengkap',
        'phone': 'noHP'
      }
    }
  );

  log(`  ✓ Renamed ${renameResult.modifiedCount} documents`, 'green');

  // Step 1b: Create new unique index on noHP
  log(`\n🔄 Step 1b: Creating unique index on noHP...`, 'blue');
  try {
    await collection.createIndex({ noHP: 1 }, { unique: true, sparse: true });
    log(`  ✓ Created unique index: noHP_1`, 'green');
  } catch (error) {
    if (error.code === 85 || error.code === 86 || error.codeName === 'IndexOptionsConflict' || error.codeName === 'IndexKeySpecsConflict') {
      log(`  ⏭️  Index already exists, skipping`, 'yellow');
    } else {
      throw error;
    }
  }

  log(`\n🔄 Step 2: Adding missing fields (nip, divisi)...`, 'blue');

  // Add nip field for documents that don't have it
  const nipResult = await collection.updateMany(
    { nip: { $exists: false } },
    { $set: { nip: null } }
  );

  log(`  ✓ Added nip field to ${nipResult.modifiedCount} documents`, 'green');

  // Add divisi field for documents that don't have it
  const divisiResult = await collection.updateMany(
    { divisi: { $exists: false } },
    { $set: { divisi: null } }
  );

  log(`  ✓ Added divisi field to ${divisiResult.modifiedCount} documents`, 'green');

  // Verify
  const sample = await collection.findOne({});
  if (sample) {
    log(`\n✓ Verification:`, 'cyan');
    log(`  namaLengkap: ${sample.namaLengkap || 'N/A'}`, 'yellow');
    log(`  noHP: ${sample.noHP || 'N/A'}`, 'yellow');
    log(`  nip: ${sample.nip || 'null (OK)'}`, 'yellow');
    log(`  divisi: ${sample.divisi || 'null (OK)'}`, 'yellow');
    log(`  fullName exists: ${sample.fullName !== undefined}`, sample.fullName !== undefined ? 'red' : 'green');
    log(`  phone exists: ${sample.phone !== undefined}`, sample.phone !== undefined ? 'red' : 'green');
  }

  log(`\n✅ Teknisis migration complete!`, 'green');
}

async function migrateNotifikasis() {
  logSection('MIGRATION 2: Notifikasis (Notification) Field Names');

  const collectionName = 'notifikasis';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Step 1: Renaming English fields to Indonesian...`, 'blue');

  // Rename title→judul, message→pesan, category→kategori
  const renameResult = await collection.updateMany(
    {},
    {
      $rename: {
        'title': 'judul',
        'message': 'pesan',
        'category': 'kategori'
      }
    }
  );

  log(`  ✓ Renamed ${renameResult.modifiedCount} documents`, 'green');

  log(`\n🔄 Step 2: Adding isRead field (default: false)...`, 'blue');

  const isReadResult = await collection.updateMany(
    { isRead: { $exists: false } },
    { $set: { isRead: false } }
  );

  log(`  ✓ Added isRead to ${isReadResult.modifiedCount} documents`, 'green');

  // Verify
  const sample = await collection.findOne({});
  if (sample) {
    log(`\n✓ Verification:`, 'cyan');
    log(`  judul: ${sample.judul || 'N/A'}`, 'yellow');
    log(`  pesan: ${(sample.pesan || '').substring(0, 30)}...`, 'yellow');
    log(`  kategori: ${sample.kategori || 'N/A'}`, 'yellow');
    log(`  isRead: ${sample.isRead}`, 'yellow');
    log(`  title exists: ${sample.title !== undefined}`, sample.title !== undefined ? 'red' : 'green');
    log(`  message exists: ${sample.message !== undefined}`, sample.message !== undefined ? 'red' : 'green');
  }

  log(`\n✅ Notifikasis migration complete!`, 'green');
}

async function migrateAdminAccounts() {
  logSection('MIGRATION 3: AdminAccounts - Add NIP Field');

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

  // Generate temporary NIPs based on email
  for (const admin of adminsWithoutNIP) {
    const emailPrefix = admin.email.split('@')[0].toUpperCase();
    const tempNIP = `NIP-${emailPrefix}-${Date.now().toString().slice(-4)}`;

    await collection.updateOne(
      { _id: admin._id },
      { $set: { NIP: tempNIP } }
    );

    log(`  ✓ Added NIP to ${admin.email} → ${tempNIP}`, 'cyan');
  }

  log(`\n✅ Added NIP to ${adminsWithoutNIP.length} admins`, 'green');
  log(`⚠️  IMPORTANT: Update temporary NIPs with real employee IDs!`, 'yellow');
}

async function migratePekerjaanTeknisis() {
  logSection('MIGRATION 4: PekerjaanTeknisis - Field Name Consistency');

  const collectionName = 'pekerjaanteknisis';
  const collection = mongoose.connection.db.collection(collectionName);

  const count = await collection.countDocuments();
  log(`\n📊 Found ${count} documents`, 'cyan');

  if (count === 0) {
    log(`⏭️  No documents to migrate`, 'yellow');
    return;
  }

  await createBackup(collectionName);

  log(`\n🔄 Standardizing field names to ERD convention (id prefix)...`, 'blue');

  // Rename to add 'id' prefix for consistency
  const renameResult = await collection.updateMany(
    {},
    {
      $rename: {
        'surveiId': 'idSurvei',
        'penyelesaianLaporanId': 'idPenyelesaianLaporan',
        'pemasanganId': 'idPemasangan',
        'pengawasanPemasanganId': 'idPengawasanPemasangan',
        'pengawasanSetelahPemasanganId': 'idPengawasanSetelahPemasangan'
      }
    }
  );

  log(`  ✓ Renamed ${renameResult.modifiedCount} documents`, 'green');

  // Verify
  const sample = await collection.findOne({});
  if (sample) {
    log(`\n✓ Verification:`, 'cyan');
    log(`  idSurvei: ${sample.idSurvei || 'null'}`, 'yellow');
    log(`  idPenyelesaianLaporan: ${sample.idPenyelesaianLaporan || 'null'}`, 'yellow');
    log(`  idPemasangan: ${sample.idPemasangan || 'null'}`, 'yellow');
    log(`  idPengawasanPemasangan: ${sample.idPengawasanPemasangan || 'null'}`, 'yellow');
    log(`  idPengawasanSetelahPemasangan: ${sample.idPengawasanSetelahPemasangan || 'null'}`, 'yellow');
    log(`  surveiId exists: ${sample.surveiId !== undefined}`, sample.surveiId !== undefined ? 'red' : 'green');
  }

  log(`\n✅ PekerjaanTeknisis migration complete!`, 'green');
}

async function verifyAllMigrations() {
  logSection('FULL MIGRATION VERIFICATION');

  const checks = [
    {
      collection: 'teknisis',
      expectedFields: ['namaLengkap', 'noHP', 'nip', 'divisi'],
      deprecatedFields: ['fullName', 'phone'],
    },
    {
      collection: 'notifikasis',
      expectedFields: ['judul', 'pesan', 'kategori', 'isRead'],
      deprecatedFields: ['title', 'message', 'category'],
    },
    {
      collection: 'adminaccounts',
      expectedFields: ['NIP'],
      deprecatedFields: [],
    },
    {
      collection: 'pekerjaanteknisis',
      expectedFields: ['idSurvei', 'idPenyelesaianLaporan', 'idPemasangan'],
      deprecatedFields: ['surveiId', 'penyelesaianLaporanId', 'pemasanganId'],
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
    let allExpectedExist = true;
    for (const field of check.expectedFields) {
      const exists = sample[field] !== undefined;
      if (exists) {
        log(`  ✅ ${field}: exists`, 'green');
      } else {
        log(`  ❌ ${field}: MISSING!`, 'red');
        allExpectedExist = false;
      }
    }

    // Check deprecated fields removed
    let allDeprecatedRemoved = true;
    for (const field of check.deprecatedFields) {
      const exists = sample[field] !== undefined;
      if (!exists) {
        log(`  ✅ ${field}: removed`, 'green');
      } else {
        log(`  ⚠️  ${field}: STILL EXISTS!`, 'red');
        allDeprecatedRemoved = false;
      }
    }

    if (allExpectedExist && allDeprecatedRemoved) {
      log(`  ✅ ${check.collection}: FULLY COMPLIANT`, 'green');
    } else {
      log(`  ⚠️  ${check.collection}: NEEDS ATTENTION`, 'yellow');
    }
  }
}

async function main() {
  log('\n' + '█'.repeat(70), 'magenta');
  log('█' + ' '.repeat(68) + '█', 'magenta');
  log('█' + '  FULL FIELD NAME MIGRATION TO ERD COMPLIANCE'.padEnd(69) + '█', 'magenta');
  log('█' + '  100% Indonesian Naming Convention'.padEnd(69) + '█', 'magenta');
  log('█' + ' '.repeat(68) + '█', 'magenta');
  log('█'.repeat(70), 'magenta');

  log(`\n⏰ Timestamp: ${new Date().toISOString()}`, 'cyan');
  log(`🌐 Database: Flowin`, 'cyan');

  try {
    await connectDB();

    // Run all migrations
    await migrateTeknisis();
    await migrateNotifikasis();
    await migrateAdminAccounts();
    await migratePekerjaanTeknisis();

    // Verify all changes
    await verifyAllMigrations();

    logSection('MIGRATION COMPLETED SUCCESSFULLY');

    log(`\n📌 MIGRATION SUMMARY:`, 'yellow');
    log(`  ✅ Teknisis: fullName→namaLengkap, phone→noHP, +nip, +divisi`, 'green');
    log(`  ✅ Notifikasis: title→judul, message→pesan, category→kategori, +isRead`, 'green');
    log(`  ✅ AdminAccounts: +NIP (temporary values)`, 'green');
    log(`  ✅ PekerjaanTeknisis: surveiId→idSurvei, etc.`, 'green');

    log(`\n📌 IMPORTANT NEXT STEPS:`, 'yellow');
    log(`  1. Update model definitions to match new field names`, 'yellow');
    log(`  2. Update GraphQL resolvers (if needed)`, 'yellow');
    log(`  3. Test all GraphQL queries with new field names`, 'yellow');
    log(`  4. Replace temporary admin NIPs with real employee IDs`, 'yellow');
    log(`  5. Update frontend code to use new field names`, 'yellow');

    log(`\n✅ All field migrations completed successfully!`, 'green');
    log(`📁 Backups created: [collection]_fieldbackup`, 'cyan');

  } catch (error) {
    log(`\n❌ MIGRATION FAILED:`, 'red');
    console.error(error);
    log(`\n⚠️  Check field backups: [collection]_fieldbackup`, 'red');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log(`\n🔌 Database connection closed\n`, 'blue');
  }
}

main();
