/**
 * DATABASE STATE VERIFICATION SCRIPT
 *
 * Purpose: Check current state before migration
 * - List all collections
 * - Count documents in each collection
 * - Identify duplicates
 * - Generate migration strategy
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
    log('\n🔌 Connecting to MongoDB Atlas...', 'cyan');
    await mongoose.connect(process.env.MONGO_URI);
    log('✅ Connected successfully!', 'green');
    log(`📦 Database: ${mongoose.connection.name}`, 'blue');
  } catch (error) {
    log('❌ Connection failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

async function listAllCollections() {
  log('\n' + '='.repeat(70), 'cyan');
  log('  CURRENT DATABASE STATE', 'cyan');
  log('='.repeat(70), 'cyan');

  const collections = await mongoose.connection.db.listCollections().toArray();

  log(`\n📊 Total Collections: ${collections.length}`, 'blue');
  log('─'.repeat(70), 'yellow');

  const collectionData = [];

  for (const coll of collections) {
    const collection = mongoose.connection.db.collection(coll.name);
    const count = await collection.countDocuments();
    const sampleDoc = await collection.findOne({});

    collectionData.push({
      name: coll.name,
      count: count,
      hasData: count > 0,
      sampleFields: sampleDoc ? Object.keys(sampleDoc).slice(0, 5) : []
    });

    const icon = count > 0 ? '📄' : '📭';
    const color = count > 0 ? 'green' : 'yellow';
    log(`${icon} ${coll.name.padEnd(40)} ${count.toString().padStart(5)} docs`, color);
  }

  return collectionData;
}

async function identifyDuplicates(collectionData) {
  log('\n' + '='.repeat(70), 'cyan');
  log('  DUPLICATE COLLECTIONS ANALYSIS', 'cyan');
  log('='.repeat(70), 'cyan');

  const duplicatePairs = [
    { old: 'users', new: 'penggunas', description: 'User/Customer data' },
    { old: 'technicians', new: 'teknisis', description: 'Technician data' },
    { old: 'notifications', new: 'notifikasis', description: 'Notification data' },
    { old: 'meters', new: 'meterans', description: 'Water meter data' },
    { old: 'reports', new: 'laporans', description: 'Customer reports' },
  ];

  let foundDuplicates = 0;

  for (const pair of duplicatePairs) {
    const oldColl = collectionData.find(c => c.name === pair.old);
    const newColl = collectionData.find(c => c.name === pair.new);

    if (oldColl || newColl) {
      foundDuplicates++;
      log(`\n🔍 ${pair.description.toUpperCase()}:`, 'yellow');

      if (oldColl && newColl) {
        log(`  ⚠️  DUPLICATE FOUND!`, 'red');
        log(`    ${pair.old.padEnd(30)} ${oldColl.count} docs`, 'yellow');
        log(`    ${pair.new.padEnd(30)} ${newColl.count} docs`, 'yellow');
        log(`  📋 Action: Merge ${pair.old} → ${pair.new}, then drop ${pair.old}`, 'cyan');
      } else if (oldColl && !newColl) {
        log(`  ✓ Only ${pair.old} exists (${oldColl.count} docs)`, 'green');
        log(`  📋 Action: Rename ${pair.old} → ${pair.new}`, 'cyan');
      } else if (!oldColl && newColl) {
        log(`  ✓ Only ${pair.new} exists (${newColl.count} docs)`, 'green');
        log(`  📋 Action: No change needed`, 'cyan');
      }
    }
  }

  if (foundDuplicates === 0) {
    log('\n✅ No duplicates found! Collections already standardized.', 'green');
  }

  return foundDuplicates;
}

async function checkFieldNaming() {
  log('\n' + '='.repeat(70), 'cyan');
  log('  FIELD NAME VERIFICATION', 'cyan');
  log('='.repeat(70), 'cyan');

  // Check KelompokPelanggan
  const kelompok = await mongoose.connection.db.collection('kelompokpelanggans').findOne({});
  if (kelompok) {
    log('\n📋 KelompokPelanggan fields:', 'yellow');
    const hasOldNames = kelompok.hargaPenggunaanDibawah10 !== undefined;
    const hasNewNames = kelompok.hargaDiBawah10mKubik !== undefined;

    if (hasOldNames) {
      log('  ❌ hargaPenggunaanDibawah10 (OLD - needs migration)', 'red');
      log('  ❌ hargaPenggunaanDiatas10 (OLD - needs migration)', 'red');
    }
    if (hasNewNames) {
      log('  ✅ hargaDiBawah10mKubik (NEW - correct)', 'green');
      log('  ✅ hargaDiAtas10mKubik (NEW - correct)', 'green');
    }
    if (!hasOldNames && !hasNewNames) {
      log('  ⚠️  No pricing fields found!', 'yellow');
    }
  } else {
    log('\n⏭️  No KelompokPelanggan documents', 'yellow');
  }

  // Check User/Pengguna
  const penggunaColl = await mongoose.connection.db.collection('penggunas').findOne({});
  const userColl = await mongoose.connection.db.collection('users').findOne({});
  const user = penggunaColl || userColl;

  if (user) {
    log('\n📋 User/Pengguna fields:', 'yellow');
    const hasEnglish = user.address !== undefined || user.gender !== undefined;
    const hasIndonesian = user.alamat !== undefined || user.jenisKelamin !== undefined;

    if (hasEnglish) {
      log('  ❌ address, gender, birthDate (ENGLISH - needs migration)', 'red');
    }
    if (hasIndonesian) {
      log('  ✅ alamat, jenisKelamin, tanggalLahir (INDONESIAN - correct)', 'green');
    }
  } else {
    log('\n⏭️  No User/Pengguna documents', 'yellow');
  }

  // Check RabConnection
  const rab = await mongoose.connection.db.collection('rabconnections').findOne({});
  if (rab) {
    log('\n📋 RabConnection fields:', 'yellow');
    const hasIsPaid = rab.isPaid !== undefined;
    const hasStatusPembayaran = rab.statusPembayaran !== undefined;
    const hasRabUrl = rab.rabUrl !== undefined;
    const hasUrlRab = rab.urlRab !== undefined;

    if (hasIsPaid) {
      log('  ❌ isPaid (boolean - needs conversion to enum)', 'red');
    }
    if (hasStatusPembayaran) {
      log('  ✅ statusPembayaran (enum - correct)', 'green');
    }
    if (hasRabUrl) {
      log('  ❌ rabUrl (needs rename to urlRab)', 'red');
    }
    if (hasUrlRab) {
      log('  ✅ urlRab (correct)', 'green');
    }
  } else {
    log('\n⏭️  No RabConnection documents', 'yellow');
  }
}

async function generateMigrationPlan(collectionData, duplicateCount) {
  log('\n' + '='.repeat(70), 'magenta');
  log('  RECOMMENDED MIGRATION PLAN', 'magenta');
  log('='.repeat(70), 'magenta');

  log('\n📌 PHASE 1A: Collection Consolidation', 'cyan');

  if (duplicateCount > 0) {
    log('  Step 1: Run migrate-collections.js', 'yellow');
    log('    - Backup all collections', 'cyan');
    log('    - Merge duplicates', 'cyan');
    log('    - Drop old collections', 'cyan');
  } else {
    log('  ✅ No collection migration needed!', 'green');
  }

  log('\n📌 PHASE 1B: Field Name Standardization', 'cyan');
  log('  Step 2: Run migrate-field-names.js', 'yellow');
  log('    - KelompokPelanggan: hargaPenggunaanDibawah10 → hargaDiBawah10mKubik', 'cyan');
  log('    - User: address → alamat, gender → jenisKelamin, etc.', 'cyan');
  log('    - RabConnection: isPaid → statusPembayaran, rabUrl → urlRab', 'cyan');
  log('    - Add missing fields: AdminAccount.NIP, Notification.isRead', 'cyan');

  log('\n📌 PHASE 2: Model Updates', 'cyan');
  log('  Step 3: Update model files to match new schema', 'yellow');

  log('\n📌 PHASE 3: GraphQL Testing', 'cyan');
  log('  Step 4: Test all queries and mutations', 'yellow');

  log('\n🎯 ESTIMATED TIME: 1-2 days for complete migration', 'green');
}

async function main() {
  log('\n' + '█'.repeat(70), 'magenta');
  log('█' + ' '.repeat(68) + '█', 'magenta');
  log('█' + '  AQUALINK DATABASE STATE VERIFICATION'.padEnd(69) + '█', 'magenta');
  log('█' + '  Before Migration Check'.padEnd(69) + '█', 'magenta');
  log('█' + ' '.repeat(68) + '█', 'magenta');
  log('█'.repeat(70), 'magenta');

  log(`\n⏰ Timestamp: ${new Date().toISOString()}`, 'cyan');
  log(`🌐 Database URI: ${process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`, 'cyan');

  try {
    await connectDB();

    const collectionData = await listAllCollections();
    const duplicateCount = await identifyDuplicates(collectionData);
    await checkFieldNaming();
    await generateMigrationPlan(collectionData, duplicateCount);

    log('\n' + '='.repeat(70), 'green');
    log('  ✅ VERIFICATION COMPLETE', 'green');
    log('='.repeat(70), 'green');

    log('\n📝 NEXT STEPS:', 'yellow');
    log('  1. Review the analysis above', 'cyan');
    log('  2. Confirm migration strategy', 'cyan');
    log('  3. Run: node scripts/migrate-collections.js', 'cyan');
    log('  4. Run: node scripts/migrate-field-names.js', 'cyan');

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
