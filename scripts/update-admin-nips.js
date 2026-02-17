/**
 * UPDATE ADMIN NIPs SCRIPT
 *
 * Purpose: Replace temporary NIPs with real employee IDs
 *
 * Current temporary NIPs:
 * - admin@test.com: NIP-ADMIN-5302
 * - adminflowin@gmail.com: NIP-ADMINFLOWIN-5366
 *
 * Usage: node scripts/update-admin-nips.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

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

async function updateAdminNIPs() {
  log('\n' + '='.repeat(70), 'cyan');
  log('  UPDATE ADMIN NIPs', 'cyan');
  log('='.repeat(70), 'cyan');

  const collection = mongoose.connection.db.collection('adminaccounts');

  // Get all admins with temporary NIPs
  const admins = await collection.find({
    NIP: { $regex: /^NIP-/ }
  }).toArray();

  if (admins.length === 0) {
    log('\n✅ No temporary NIPs found. All admins have proper NIPs.', 'green');
    return;
  }

  log(`\n📋 Found ${admins.length} admins with temporary NIPs:`, 'yellow');

  for (const admin of admins) {
    log(`\n  Email: ${admin.email}`, 'cyan');
    log(`  Current NIP: ${admin.NIP}`, 'yellow');
    log(`  Name: ${admin.namaLengkap}`, 'cyan');
  }

  log('\n' + '='.repeat(70), 'yellow');
  log('  RECOMMENDED ACTIONS:', 'yellow');
  log('='.repeat(70), 'yellow');

  log('\nOption 1: Update manually via MongoDB Compass:', 'cyan');
  log('  1. Open MongoDB Compass', 'white');
  log('  2. Navigate to Flowin database → adminaccounts collection', 'white');
  log('  3. Find admin by email', 'white');
  log('  4. Edit NIP field with real employee ID', 'white');

  log('\nOption 2: Update via this script (interactive):', 'cyan');
  log('  Run with --interactive flag (not implemented yet)', 'white');

  log('\nOption 3: Update via MongoDB shell:', 'cyan');
  for (const admin of admins) {
    log(`\n  db.adminaccounts.updateOne(`, 'yellow');
    log(`    { email: "${admin.email}" },`, 'yellow');
    log(`    { $set: { NIP: "YOUR_REAL_NIP_HERE" } }`, 'yellow');
    log(`  )`, 'yellow');
  }

  log('\n' + '='.repeat(70), 'green');
  log('  ℹ️  For now, temporary NIPs are acceptable', 'green');
  log('  ℹ️  Update them when you have real employee IDs', 'green');
  log('='.repeat(70), 'green');
}

async function main() {
  log('\n' + '█'.repeat(70), 'magenta');
  log('█' + '  ADMIN NIP UPDATE UTILITY'.padEnd(69) + '█', 'magenta');
  log('█'.repeat(70), 'magenta');

  try {
    await connectDB();
    await updateAdminNIPs();

    log('\n✅ Script completed successfully\n', 'green');
  } catch (error) {
    log('\n❌ ERROR:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log('🔌 Connection closed\n', 'blue');
  }
}

main();
