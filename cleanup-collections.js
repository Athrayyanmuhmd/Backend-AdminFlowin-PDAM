/**
 * Cleanup Empty Duplicate Collections
 *
 * This script safely removes empty duplicate collections that were created
 * during development. It only removes collections with 0 documents.
 *
 * SAFE TO RUN: Only removes empty collections, never touches data.
 */

import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';

configDotenv();

async function cleanupCollections() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // List of empty duplicate collections to remove
    const collectionsToRemove = [
      'notifications',  // Empty (0 docs), correct one is 'notifikasis'
      'meters',         // Empty (0 docs), correct one is 'meterans'
    ];

    console.log('🧹 CLEANUP PLAN:\n');

    for (const collectionName of collectionsToRemove) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) {
        console.log(`  ⚪ ${collectionName}: Not found (already clean)`);
        continue;
      }

      // Double-check it's empty before removing
      const count = await db.collection(collectionName).countDocuments();

      if (count === 0) {
        console.log(`  🗑️  ${collectionName}: Empty (${count} docs) - WILL BE REMOVED`);
      } else {
        console.log(`  ⚠️  ${collectionName}: Has ${count} docs - SKIPPING (not empty!)`);
      }
    }

    console.log('\n');
    console.log('⚠️  This will remove empty duplicate collections.');
    console.log('    Data in correct collections (penggunas, notifikasis, teknisis, meterans) will NOT be affected.\n');

    // Proceed with cleanup
    console.log('🚀 Starting cleanup...\n');

    let removed = 0;
    let skipped = 0;

    for (const collectionName of collectionsToRemove) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        skipped++;
        continue;
      }

      const count = await db.collection(collectionName).countDocuments();

      if (count === 0) {
        await db.dropCollection(collectionName);
        console.log(`  ✅ Removed: ${collectionName}`);
        removed++;
      } else {
        console.log(`  ⏭️  Skipped: ${collectionName} (${count} documents)`);
        skipped++;
      }
    }

    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`   - Collections removed: ${removed}`);
    console.log(`   - Collections skipped: ${skipped}`);
    console.log('');

    // Verify final state
    console.log('📋 FINAL STATE:\n');

    const finalCollections = {
      'Pengguna': 'penggunas',
      'Notifikasi': 'notifikasis',
      'Teknisi': 'teknisis',
      'Meteran': 'meterans'
    };

    for (const [model, collection] of Object.entries(finalCollections)) {
      const count = await db.collection(collection).countDocuments();
      console.log(`   ${model}: ${collection} (${count} documents) ✅`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Cleanup complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupCollections();
