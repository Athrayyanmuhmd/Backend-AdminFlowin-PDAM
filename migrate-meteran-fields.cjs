/**
 * Migration script: rename Meteran document fields to ERD format
 * connectionDataId -> idKoneksiData
 * kelompokPelangganId -> idKelompokPelanggan
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const meteransCol = mongoose.connection.collection('meterans');

    // Check current state
    const total = await meteransCol.countDocuments();
    const oldFormat = await meteransCol.countDocuments({ connectionDataId: { $exists: true } });
    const newFormat = await meteransCol.countDocuments({ idKoneksiData: { $exists: true } });
    console.log(`Total meterans: ${total}, old format: ${oldFormat}, new format: ${newFormat}`);

    if (oldFormat > 0) {
      // Rename fields using aggregation pipeline update
      const result = await meteransCol.updateMany(
        { connectionDataId: { $exists: true } },
        [
          {
            $set: {
              idKoneksiData: '$connectionDataId',
              idKelompokPelanggan: '$kelompokPelangganId',
              statusAktif: { $ifNull: ['$statusAktif', true] },
              pemakaianBelumTerbayar: { $ifNull: ['$pemakaianBelumTerbayar', 0] },
            }
          },
          {
            $unset: ['connectionDataId', 'kelompokPelangganId', 'userId']
          }
        ]
      );
      console.log(`Migrated ${result.modifiedCount} meteran documents`);
    } else {
      console.log('No migration needed (already in new format or empty)');
    }

    // Verify
    const after = await meteransCol.findOne({});
    if (after) {
      console.log('Sample document fields:', Object.keys(after).join(', '));
    }

    await mongoose.connection.close();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
