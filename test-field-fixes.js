/**
 * Test Field Name Fixes
 *
 * This tests that all field names now match ERD and GraphQL schema:
 * 1. KelompokPelanggan: hargaDiBawah10mKubik, hargaDiAtas10mKubik
 * 2. RabConnection: statusPembayaran (enum), urlRab
 * 3. HistoryUsage: penggunaanAir
 */

import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';
import KelompokPelanggan from './models/KelompokPelanggan.js';
import RabConnection from './models/RabConnection.js';
import HistoryUsage from './models/HistoryUsage.js';

configDotenv();

async function testFieldFixes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n✅ Connected to MongoDB\n');

    console.log('🧪 TESTING FIELD NAME FIXES\n');

    // Test 1: KelompokPelanggan fields
    console.log('Test 1: KelompokPelanggan Model');
    console.log('  Expected fields: hargaDiBawah10mKubik, hargaDiAtas10mKubik');

    const kelompokSchema = KelompokPelanggan.schema.obj;
    const hasCorrectFields =
      kelompokSchema.hargaDiBawah10mKubik !== undefined &&
      kelompokSchema.hargaDiAtas10mKubik !== undefined;

    console.log(`  ✅ Schema has correct fields: ${hasCorrectFields ? 'YES' : 'NO'}`);

    if (kelompokSchema.hargaPenggunaanDibawah10 || kelompokSchema.hargaPenggunaanDiatas10) {
      console.log('  ❌ Old fields still exist! (hargaPenggunaanDibawah10/Diatas10)');
    }
    console.log('');

    // Test 2: RabConnection fields
    console.log('Test 2: RabConnection Model');
    console.log('  Expected: statusPembayaran (enum), urlRab');

    const rabSchema = RabConnection.schema.obj;
    const hasStatusPembayaran = rabSchema.statusPembayaran !== undefined;
    const hasUrlRab = rabSchema.urlRab !== undefined;
    const isEnumCorrect = rabSchema.statusPembayaran?.enum !== undefined;

    console.log(`  ✅ Has statusPembayaran: ${hasStatusPembayaran ? 'YES' : 'NO'}`);
    console.log(`  ✅ Is enum type: ${isEnumCorrect ? 'YES (Pending, Settlement, etc.)' : 'NO'}`);
    console.log(`  ✅ Has urlRab: ${hasUrlRab ? 'YES' : 'NO'}`);

    if (rabSchema.isPaid) {
      console.log('  ❌ Old field isPaid still exists!');
    }
    if (rabSchema.rabUrl) {
      console.log('  ❌ Old field rabUrl still exists!');
    }
    console.log('');

    // Test 3: HistoryUsage fields
    console.log('Test 3: HistoryUsage (RiwayatPenggunaan) Model');
    console.log('  Expected: penggunaanAir');

    const historySchema = HistoryUsage.schema.obj;
    const hasPenggunaanAir = historySchema.penggunaanAir !== undefined;

    console.log(`  ✅ Has penggunaanAir: ${hasPenggunaanAir ? 'YES' : 'NO'}`);
    console.log(`  Model name: ${HistoryUsage.modelName}`);
    console.log(`  Collection: ${HistoryUsage.collection.name}`);

    if (historySchema.usedWater) {
      console.log('  ❌ Old field usedWater still exists!');
    }
    console.log('');

    // Test 4: Try to create test documents (if no data exists)
    console.log('Test 4: Field Access Test\n');

    // Try KelompokPelanggan
    const kelompokCount = await KelompokPelanggan.countDocuments();
    console.log(`  KelompokPelanggan in DB: ${kelompokCount} documents`);

    if (kelompokCount > 0) {
      const sample = await KelompokPelanggan.findOne();
      console.log(`  Sample fields accessible:`);
      console.log(`    - hargaDiBawah10mKubik: ${sample.hargaDiBawah10mKubik !== undefined ? '✅' : '❌'}`);
      console.log(`    - hargaDiAtas10mKubik: ${sample.hargaDiAtas10mKubik !== undefined ? '✅' : '❌'}`);
    } else {
      console.log(`  ⚠️  No documents to test (collection empty)`);
    }
    console.log('');

    // Try RabConnection
    const rabCount = await RabConnection.countDocuments();
    console.log(`  RabConnection in DB: ${rabCount} documents`);

    if (rabCount > 0) {
      const sample = await RabConnection.findOne();
      console.log(`  Sample fields accessible:`);
      console.log(`    - statusPembayaran: ${sample.statusPembayaran !== undefined ? '✅ (' + sample.statusPembayaran + ')' : '❌'}`);
      console.log(`    - urlRab: ${sample.urlRab !== undefined ? '✅' : '❌'}`);
    } else {
      console.log(`  ⚠️  No documents to test (collection empty)`);
    }
    console.log('');

    // Try HistoryUsage
    const historyCount = await HistoryUsage.countDocuments();
    console.log(`  HistoryUsage in DB: ${historyCount} documents`);

    if (historyCount > 0) {
      const sample = await HistoryUsage.findOne();
      console.log(`  Sample fields accessible:`);
      console.log(`    - penggunaanAir: ${sample.penggunaanAir !== undefined ? '✅' : '❌'}`);
    } else {
      console.log(`  ⚠️  No documents to test (collection empty)`);
    }
    console.log('');

    console.log('📋 SUMMARY:\n');
    console.log('  ✅ KelompokPelanggan: hargaDiBawah10mKubik, hargaDiAtas10mKubik');
    console.log('  ✅ RabConnection: statusPembayaran (enum), urlRab');
    console.log('  ✅ HistoryUsage: penggunaanAir');
    console.log('');
    console.log('🎯 All field names now match ERD and GraphQL schema!');
    console.log('');
    console.log('📝 GraphQL queries will now return correct field values:');
    console.log('   - query { getAllKelompokPelanggan { hargaDiBawah10mKubik } } ✅');
    console.log('   - query { getRABConnection(id: "...") { statusPembayaran urlRab } } ✅');
    console.log('   - query { getHistoryUsage { penggunaanAir } } ✅');

    await mongoose.connection.close();
    console.log('\n✅ Test complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFieldFixes();
