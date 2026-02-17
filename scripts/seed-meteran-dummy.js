/**
 * Seed Dummy Meteran Data for Testing GraphQL
 * Run: node scripts/seed-meteran-dummy.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Meteran from '../models/Meteran.js';
import User from '../models/User.js';
import KelompokPelanggan from '../models/KelompokPelanggan.js';
import ConnectionData from '../models/ConnectionData.js';

dotenv.config();

const seedMeteranData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get existing data
    const users = await User.find().limit(5);
    const kelompokPelanggan = await KelompokPelanggan.find();

    if (users.length === 0) {
      console.log('❌ No users found. Please seed users first.');
      process.exit(1);
    }

    if (kelompokPelanggan.length === 0) {
      console.log('❌ No kelompok pelanggan found. Please create tariff groups first.');
      process.exit(1);
    }

    console.log(`\n📊 Found ${users.length} users and ${kelompokPelanggan.length} tariff groups`);

    // Create ConnectionData first (required for Meteran)
    const connectionDataList = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      // Check if connection data already exists for this user
      const existingConnection = await ConnectionData.findOne({ userId: user._id });

      if (!existingConnection) {
        const connectionData = await ConnectionData.create({
          userId: user._id,
          nik: `3201${Math.random().toString().slice(2, 18)}`, // 16 digits
          nikUrl: `https://cloudinary.com/dummy/nik-${i}.pdf`,
          noKK: `3201${Math.random().toString().slice(2, 18)}`,
          kkUrl: `https://cloudinary.com/dummy/kk-${i}.pdf`,
          noImb: `IMB-${Date.now()}-${i}`,
          imbUrl: `https://cloudinary.com/dummy/imb-${i}.pdf`,
          alamat: `Jl. Testing No. ${i + 1}, Banda Aceh`,
          kelurahan: 'Lampaseh Kota',
          kecamatan: 'Kuta Alam',
          luasBangunan: Math.floor(Math.random() * 200) + 50, // 50-250 m²
          isVerifiedByData: true,
          isVerifiedByTechnician: true,
        });

        connectionDataList.push(connectionData);
        console.log(`✅ Created ConnectionData for ${user.namaLengkap}`);
      } else {
        connectionDataList.push(existingConnection);
        console.log(`⚠️  ConnectionData already exists for ${user.namaLengkap}`);
      }
    }

    // Create Meteran for each connection
    const meteranList = [];
    for (let i = 0; i < connectionDataList.length; i++) {
      const connection = connectionDataList[i];

      // Check if meteran already exists for this connection
      const existingMeteran = await Meteran.findOne({ connectionDataId: connection._id });

      if (!existingMeteran) {
        const randomKelompok = kelompokPelanggan[Math.floor(Math.random() * kelompokPelanggan.length)];
        const user = users[i];

        const meteran = await Meteran.create({
          nomorMeteran: `MTR-${Date.now()}-${String(i + 1).padStart(4, '0')}`,
          nomorAkun: `AKN-${Date.now()}-${String(i + 1).padStart(4, '0')}`,
          kelompokPelangganId: randomKelompok._id,
          connectionDataId: connection._id,
          userId: user._id,
        });

        meteranList.push(meteran);
        console.log(`✅ Created Meteran ${meteran.nomorMeteran} for connection ${connection._id}`);
      } else {
        meteranList.push(existingMeteran);
        console.log(`⚠️  Meteran already exists for connection ${connection._id}`);
      }
    }

    console.log(`\n✅ Seeding completed!`);
    console.log(`📊 Created ${connectionDataList.length} ConnectionData`);
    console.log(`📊 Created ${meteranList.length} Meteran`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedMeteranData();
