/**
 * Test GraphQL Queries After Collection Name Fixes
 *
 * This tests that all models still work correctly with explicit collection names.
 */

import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';

// Import models (this will use the new explicit collection names)
import User from './models/User.js';
import Notification from './models/Notification.js';
import Technician from './models/Technician.js';
import Meteran from './models/Meteran.js';

configDotenv();

async function testModels() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n✅ Connected to MongoDB\n');

    console.log('🧪 TESTING MODELS WITH EXPLICIT COLLECTION NAMES\n');

    // Test 1: User/Pengguna model
    console.log('Test 1: User (Pengguna) Model');
    const users = await User.find().limit(1);
    console.log(`  ✅ Found ${users.length > 0 ? users.length : 0} user(s)`);
    console.log(`  Collection: ${User.collection.name}`);
    if (users.length > 0) {
      console.log(`  Sample: ${users[0].namaLengkap} (${users[0].email})`);
    }
    console.log('');

    // Test 2: Notification/Notifikasi model
    console.log('Test 2: Notification (Notifikasi) Model');
    const notifications = await Notification.find().limit(1);
    const totalNotif = await Notification.countDocuments();
    console.log(`  ✅ Found ${totalNotif} notification(s)`);
    console.log(`  Collection: ${Notification.collection.name}`);
    if (notifications.length > 0) {
      console.log(`  Sample: ${notifications[0].judul}`);
    }
    console.log('');

    // Test 3: Technician/Teknisi model
    console.log('Test 3: Technician (Teknisi) Model');
    const technicians = await Technician.find().limit(1);
    console.log(`  ✅ Found ${technicians.length > 0 ? technicians.length : 0} technician(s)`);
    console.log(`  Collection: ${Technician.collection.name}`);
    if (technicians.length > 0) {
      console.log(`  Sample: ${technicians[0].namaLengkap} (${technicians[0].divisi || 'No division'})`);
    }
    console.log('');

    // Test 4: Meteran model
    console.log('Test 4: Meteran Model');
    const meterans = await Meteran.find().limit(1);
    const totalMeteran = await Meteran.countDocuments();
    console.log(`  ✅ Collection name: ${Meteran.collection.name}`);
    console.log(`  Total: ${totalMeteran} meter(s)`);
    console.log('');

    // Test 5: Verify collection names
    console.log('📋 COLLECTION NAME VERIFICATION:\n');
    const expectedCollections = {
      'User': 'penggunas',
      'Notification': 'notifikasis',
      'Technician': 'teknisis',
      'Meteran': 'meterans'
    };

    let allCorrect = true;

    for (const [modelName, expectedCollection] of Object.entries(expectedCollections)) {
      let actualCollection;
      switch (modelName) {
        case 'User':
          actualCollection = User.collection.name;
          break;
        case 'Notification':
          actualCollection = Notification.collection.name;
          break;
        case 'Technician':
          actualCollection = Technician.collection.name;
          break;
        case 'Meteran':
          actualCollection = Meteran.collection.name;
          break;
      }

      const match = actualCollection === expectedCollection;
      console.log(`  ${modelName}: ${actualCollection} ${match ? '✅' : '❌ (expected: ' + expectedCollection + ')'}`);
      if (!match) allCorrect = false;
    }

    console.log('');

    if (allCorrect) {
      console.log('✅ All collection names are correct!\n');
      console.log('📝 Summary:');
      console.log('   - User model → penggunas collection ✅');
      console.log('   - Notification model → notifikasis collection ✅');
      console.log('   - Technician model → teknisis collection ✅');
      console.log('   - Meteran model → meterans collection ✅');
      console.log('');
      console.log('🎯 GraphQL queries will now use the correct ERD-compliant collection names.');
    } else {
      console.log('❌ Some collection names are incorrect. Please check the models.\n');
    }

    await mongoose.connection.close();
    console.log('\n✅ Test complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testModels();
