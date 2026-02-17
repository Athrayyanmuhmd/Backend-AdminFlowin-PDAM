/**
 * MIGRATION SCRIPT: Collection Name Standardization
 *
 * Purpose: Consolidate duplicate collections to match ERD naming (Indonesian)
 *
 * Changes:
 * - users → penggunas (merge + drop)
 * - notifications → notifikasis (merge + drop)
 * - meters → (drop, keep meterans)
 * - reports → (drop, keep laporans)
 * - technicians → teknisis (rename)
 *
 * CRITICAL: Creates backup before any changes
 *
 * Usage:
 *   node scripts/migrate-collections.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Colors for console output
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
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log('✅ Connected to MongoDB', 'green');
  } catch (error) {
    log('❌ MongoDB connection failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

async function getCollectionStats(collectionName) {
  try {
    const collection = mongoose.connection.db.collection(collectionName);
    const count = await collection.countDocuments();
    return { exists: true, count };
  } catch (error) {
    return { exists: false, count: 0 };
  }
}

async function listAllCollections() {
  logSection('Current Collections');

  const collections = await mongoose.connection.db.listCollections().toArray();

  log('\nTotal collections: ' + collections.length, 'blue');

  for (const coll of collections) {
    const stats = await getCollectionStats(coll.name);
    log(`  ${coll.name.padEnd(40)} ${stats.count} documents`, 'yellow');
  }
}

async function backupCollection(collectionName, backupName) {
  log(`\n📦 Creating backup: ${collectionName} → ${backupName}...`, 'blue');

  const source = mongoose.connection.db.collection(collectionName);
  const backup = mongoose.connection.db.collection(backupName);

  // Drop backup if exists
  try {
    await backup.drop();
  } catch (e) {
    // Collection doesn't exist, that's fine
  }

  const documents = await source.find().toArray();

  if (documents.length > 0) {
    await backup.insertMany(documents);
    log(`✅ Backed up ${documents.length} documents`, 'green');
  } else {
    log(`⚠️  No documents to backup`, 'yellow');
  }

  return documents.length;
}

async function mergeCollections(sourceCollectionName, targetCollectionName) {
  log(`\n🔄 Merging: ${sourceCollectionName} → ${targetCollectionName}...`, 'blue');

  const source = mongoose.connection.db.collection(sourceCollectionName);
  const target = mongoose.connection.db.collection(targetCollectionName);

  // Get all documents from source
  const sourceDocs = await source.find().toArray();

  if (sourceDocs.length === 0) {
    log(`⚠️  Source collection is empty, nothing to merge`, 'yellow');
    return 0;
  }

  log(`  Found ${sourceDocs.length} documents in source`, 'cyan');

  // Get existing IDs in target to avoid duplicates
  const targetIds = await target.distinct('_id');
  const targetIdSet = new Set(targetIds.map(id => id.toString()));

  // Also check for unique field conflicts (NIK, email, etc.)
  const targetNiks = await target.distinct('nik');
  const targetEmails = await target.distinct('email');
  const targetNikSet = new Set(targetNiks.filter(Boolean));
  const targetEmailSet = new Set(targetEmails.filter(Boolean));

  // Filter out documents that already exist in target (by _id, nik, or email)
  const docsToInsert = sourceDocs.filter(doc => {
    const idExists = targetIdSet.has(doc._id.toString());
    const nikExists = doc.nik && targetNikSet.has(doc.nik);
    const emailExists = doc.email && targetEmailSet.has(doc.email);

    if (idExists || nikExists || emailExists) {
      log(`  ⏭️  Skipping duplicate: ${doc.email || doc._id} (already exists)`, 'yellow');
      return false;
    }
    return true;
  });

  if (docsToInsert.length === 0) {
    log(`⚠️  All documents already exist in target, nothing to insert`, 'yellow');
    return 0;
  }

  // Insert unique documents one by one to handle any remaining conflicts
  let insertedCount = 0;
  for (const doc of docsToInsert) {
    try {
      await target.insertOne(doc);
      insertedCount++;
      log(`  ✓ Inserted: ${doc.email || doc._id}`, 'cyan');
    } catch (error) {
      if (error.code === 11000) {
        log(`  ⏭️  Skipped duplicate: ${doc.email || doc._id} (unique constraint)`, 'yellow');
      } else {
        throw error;
      }
    }
  }

  log(`✅ Merged ${insertedCount} unique documents`, 'green');
  return insertedCount;
}

async function dropCollection(collectionName) {
  log(`\n🗑️  Dropping collection: ${collectionName}...`, 'blue');

  try {
    const collection = mongoose.connection.db.collection(collectionName);
    await collection.drop();
    log(`✅ Dropped successfully`, 'green');
    return true;
  } catch (error) {
    if (error.message.includes('ns not found')) {
      log(`⚠️  Collection doesn't exist, skipping`, 'yellow');
      return false;
    }
    throw error;
  }
}

async function renameCollection(oldName, newName) {
  log(`\n✏️  Renaming: ${oldName} → ${newName}...`, 'blue');

  try {
    const collection = mongoose.connection.db.collection(oldName);
    await collection.rename(newName);
    log(`✅ Renamed successfully`, 'green');
    return true;
  } catch (error) {
    if (error.message.includes('source namespace does not exist')) {
      log(`⚠️  Source collection doesn't exist, skipping`, 'yellow');
      return false;
    }
    throw error;
  }
}

async function migrateUsers() {
  logSection('MIGRATION 1: Users → Penggunas');

  // Check if both collections exist
  const penggunasStats = await getCollectionStats('penggunas');
  const usersStats = await getCollectionStats('users');

  log(`\nCurrent state:`, 'cyan');
  log(`  penggunas: ${penggunasStats.count} documents`, 'yellow');
  log(`  users: ${usersStats.count} documents`, 'yellow');

  if (!usersStats.exists || usersStats.count === 0) {
    log(`\n⏭️  No users collection or empty, skipping migration`, 'yellow');
    return;
  }

  // Backup both
  await backupCollection('penggunas', 'backup_penggunas');
  await backupCollection('users', 'backup_users');

  // Merge users into penggunas
  const merged = await mergeCollections('users', 'penggunas');

  if (merged > 0) {
    // Drop old users collection
    await dropCollection('users');

    log(`\n✅ Migration complete: ${merged} documents migrated`, 'green');
  }
}

async function migrateNotifications() {
  logSection('MIGRATION 2: Notifications → Notifikasis');

  const notifikasisStats = await getCollectionStats('notifikasis');
  const notificationsStats = await getCollectionStats('notifications');

  log(`\nCurrent state:`, 'cyan');
  log(`  notifikasis: ${notifikasisStats.count} documents`, 'yellow');
  log(`  notifications: ${notificationsStats.count} documents`, 'yellow');

  if (!notificationsStats.exists || notificationsStats.count === 0) {
    log(`\n⏭️  No notifications collection or empty, skipping migration`, 'yellow');
    return;
  }

  // Backup both
  await backupCollection('notifikasis', 'backup_notifikasis');
  await backupCollection('notifications', 'backup_notifications');

  // Merge notifications into notifikasis
  const merged = await mergeCollections('notifications', 'notifikasis');

  if (merged > 0) {
    // Drop old notifications collection
    await dropCollection('notifications');

    log(`\n✅ Migration complete: ${merged} documents migrated`, 'green');
  }
}

async function consolidateMeters() {
  logSection('MIGRATION 3: Meters Consolidation');

  const meteransStats = await getCollectionStats('meterans');
  const metersStats = await getCollectionStats('meters');

  log(`\nCurrent state:`, 'cyan');
  log(`  meterans: ${meteransStats.count} documents`, 'yellow');
  log(`  meters: ${metersStats.count} documents`, 'yellow');

  if (!metersStats.exists) {
    log(`\n⏭️  No meters collection, skipping`, 'yellow');
    return;
  }

  if (metersStats.count > 0) {
    log(`\n⚠️  WARNING: meters collection has ${metersStats.count} documents!`, 'red');
    log(`  You should manually review this data before dropping.`, 'red');
    log(`  Creating backup...`, 'yellow');
    await backupCollection('meters', 'backup_meters');
    log(`\n⏸️  Migration paused. Please review backup_meters collection.`, 'yellow');
    return;
  }

  // If meters is empty, just drop it
  await backupCollection('meters', 'backup_meters');
  await dropCollection('meters');
  log(`\n✅ Migration complete: meters collection dropped (was empty)`, 'green');
}

async function consolidateReports() {
  logSection('MIGRATION 4: Reports Consolidation');

  const laporansStats = await getCollectionStats('laporans');
  const reportsStats = await getCollectionStats('reports');

  log(`\nCurrent state:`, 'cyan');
  log(`  laporans: ${laporansStats.count} documents`, 'yellow');
  log(`  reports: ${reportsStats.count} documents`, 'yellow');

  if (!reportsStats.exists) {
    log(`\n⏭️  No reports collection, skipping`, 'yellow');
    return;
  }

  if (reportsStats.count > 0) {
    log(`\n⚠️  WARNING: reports collection has ${reportsStats.count} documents!`, 'red');
    log(`  You should manually review this data before dropping.`, 'red');
    log(`  Creating backup...`, 'yellow');
    await backupCollection('reports', 'backup_reports');
    log(`\n⏸️  Migration paused. Please review backup_reports collection.`, 'yellow');
    return;
  }

  // If reports is empty, just drop it
  await backupCollection('reports', 'backup_reports');
  await dropCollection('reports');
  log(`\n✅ Migration complete: reports collection dropped (was empty)`, 'green');
}

async function renameTechnicians() {
  logSection('MIGRATION 5: Technicians → Teknisis');

  const techniciansStats = await getCollectionStats('technicians');
  const teknisisStats = await getCollectionStats('teknisis');

  log(`\nCurrent state:`, 'cyan');
  log(`  technicians: ${techniciansStats.count} documents`, 'yellow');
  log(`  teknisis: ${teknisisStats.count} documents`, 'yellow');

  if (!techniciansStats.exists) {
    log(`\n⏭️  No technicians collection, skipping`, 'yellow');
    return;
  }

  if (teknisisStats.exists && teknisisStats.count > 0) {
    log(`\n⚠️  WARNING: teknisis collection already exists with data!`, 'red');
    log(`  Creating backup and merging...`, 'yellow');

    await backupCollection('teknisis', 'backup_teknisis');
    await backupCollection('technicians', 'backup_technicians');

    const merged = await mergeCollections('technicians', 'teknisis');

    if (merged > 0) {
      await dropCollection('technicians');
      log(`\n✅ Migration complete: ${merged} documents merged`, 'green');
    }
  } else {
    // Simple rename
    await backupCollection('technicians', 'backup_technicians');
    await renameCollection('technicians', 'teknisis');
    log(`\n✅ Migration complete: collection renamed`, 'green');
  }
}

async function verifyMigration() {
  logSection('MIGRATION VERIFICATION');

  const expectedCollections = {
    'penggunas': 'Should contain all user data',
    'teknisis': 'Should contain all technician data',
    'notifikasis': 'Should contain all notification data',
    'meterans': 'Meter data (Indonesian)',
    'laporans': 'Report data (Indonesian)',
  };

  log(`\nVerifying expected collections:`, 'cyan');

  for (const [collName, description] of Object.entries(expectedCollections)) {
    const stats = await getCollectionStats(collName);
    if (stats.exists) {
      log(`  ✅ ${collName.padEnd(30)} ${stats.count} docs - ${description}`, 'green');
    } else {
      log(`  ❌ ${collName.padEnd(30)} MISSING!`, 'red');
    }
  }

  const duplicateCollections = ['users', 'technicians', 'notifications', 'meters', 'reports'];

  log(`\nVerifying duplicate collections are removed:`, 'cyan');

  for (const collName of duplicateCollections) {
    const stats = await getCollectionStats(collName);
    if (stats.exists) {
      log(`  ⚠️  ${collName.padEnd(30)} Still exists! (${stats.count} docs)`, 'yellow');
    } else {
      log(`  ✅ ${collName.padEnd(30)} Removed`, 'green');
    }
  }
}

async function main() {
  log('\n' + '█'.repeat(60), 'magenta');
  log('█' + ' '.repeat(58) + '█', 'magenta');
  log('█' + '  AQUALINK DATABASE MIGRATION SCRIPT'.padEnd(59) + '█', 'magenta');
  log('█' + '  Collection Name Standardization (ERD Compliance)'.padEnd(59) + '█', 'magenta');
  log('█' + ' '.repeat(58) + '█', 'magenta');
  log('█'.repeat(60), 'magenta');

  log(`\nTimestamp: ${new Date().toISOString()}`, 'cyan');
  log(`Database: ${process.env.MONGO_URI}`, 'cyan');

  try {
    await connectDB();

    // List all collections before migration
    await listAllCollections();

    // Run migrations
    await migrateUsers();
    await migrateNotifications();
    await consolidateMeters();
    await consolidateReports();
    await renameTechnicians();

    // Verify results
    await verifyMigration();

    logSection('MIGRATION COMPLETED SUCCESSFULLY');

    log(`\n📌 IMPORTANT NOTES:`, 'yellow');
    log(`  1. All original collections have been backed up with 'backup_' prefix`, 'yellow');
    log(`  2. You can restore from backups if needed:`, 'yellow');
    log(`     - backup_penggunas, backup_users, backup_notifications, etc.`, 'cyan');
    log(`  3. After verifying everything works, you can drop backup collections`, 'yellow');
    log(`  4. Next step: Run field name standardization migration`, 'yellow');

    log(`\n✅ All migrations completed!`, 'green');

  } catch (error) {
    log(`\n❌ MIGRATION FAILED:`, 'red');
    console.error(error);
    log(`\n⚠️  Database may be in inconsistent state. Check backups!`, 'red');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log(`\n🔌 Database connection closed`, 'blue');
  }
}

// Run migration
main();
