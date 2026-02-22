/**
 * Migration: connectiondatas (old) -> koneksidatas (new ERD fields)
 * userId -> idPelanggan
 * nik -> NIK, nikUrl -> NIKUrl, kkUrl -> KKUrl, noImb -> IMB, imbUrl -> IMBUrl
 * isVerifiedByData -> statusVerifikasi
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    console.log('Connected!\n');

    const oldCol = db.collection('connectiondatas');
    const newCol = db.collection('koneksidatas');

    const oldDocs = await oldCol.find({}).toArray();
    console.log(`Found ${oldDocs.length} documents in connectiondatas`);

    if (oldDocs.length === 0) {
      console.log('Nothing to migrate.');
      process.exit(0);
    }

    // Map each old doc to new ERD format
    const newDocs = oldDocs.map(doc => ({
      _id: doc._id, // keep same _id so meterans.idKoneksiData refs still valid
      idPelanggan: doc.userId || null,
      statusVerifikasi: doc.isVerifiedByData || false,
      NIK: doc.nik || null,
      NIKUrl: doc.nikUrl || null,
      noKK: doc.noKK || null,
      KKUrl: doc.kkUrl || null,
      IMB: doc.noImb || null,
      IMBUrl: doc.imbUrl || null,
      alamat: doc.alamat || null,
      kelurahan: doc.kelurahan || null,
      kecamatan: doc.kecamatan || null,
      luasBangunan: doc.luasBangunan || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    // Insert into new collection (skip if already exists)
    const existingCount = await newCol.countDocuments();
    if (existingCount > 0) {
      console.log(`koneksidatas already has ${existingCount} docs. Clearing before re-insert...`);
      await newCol.deleteMany({});
    }

    const insertResult = await newCol.insertMany(newDocs);
    console.log(`Inserted ${insertResult.insertedCount} documents into koneksidatas`);

    // Verify a sample
    const sample = await newCol.findOne({});
    if (sample) {
      console.log('\nSample koneksidatas document fields:', Object.keys(sample).join(', '));
      console.log('idPelanggan:', sample.idPelanggan);
      console.log('alamat:', sample.alamat);
      console.log('NIK:', sample.NIK);
    }

    // Update meterans to make sure idKoneksiData refs are pointing to koneksidatas
    // (they should still be valid since we kept the same _id)
    const meteranCheck = await db.collection('meterans').findOne({ idKoneksiData: { $exists: true } });
    if (meteranCheck) {
      console.log('\nMeteran sample idKoneksiData:', meteranCheck.idKoneksiData);
      const matchingKoneksi = await newCol.findOne({ _id: meteranCheck.idKoneksiData });
      console.log('Matching koneksidata found:', matchingKoneksi ? 'YES ✅' : 'NO ❌');
    }

    await mongoose.connection.close();
    console.log('\nMigration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
