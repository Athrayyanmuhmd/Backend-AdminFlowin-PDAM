/**
 * Script untuk populate database dengan data dummy
 * Run: node seed-dummy-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Pengguna = require('./models/Pengguna');
const KelompokPelanggan = require('./models/KelompokPelanggan');
const KoneksiData = require('./models/KoneksiData');
const Meteran = require('./models/Meteran');
const Tagihan = require('./models/Tagihan');
const Teknisi = require('./models/Teknisi');
const RABConnection = require('./models/RABConnection');
const Survei = require('./models/Survei');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

async function seedData() {
  try {
    console.log('Starting to seed dummy data...\n');

    // 1. Create Kelompok Pelanggan
    console.log('1. Creating Kelompok Pelanggan...');
    const kelompokRT = await KelompokPelanggan.create({
      namaKelompok: 'Rumah Tangga 2A2',
      hargaDiBawah10mKubik: 2500,
      hargaDiAtas10mKubik: 3000,
      biayaBeban: 5000,
    });

    const kelompokKomersial = await KelompokPelanggan.create({
      namaKelompok: 'Komersial',
      hargaDiBawah10mKubik: 3500,
      hargaDiAtas10mKubik: 4500,
      biayaBeban: 10000,
    });
    console.log('   Created 2 Kelompok Pelanggan\n');

    // 2. Create Customers
    console.log('2. Creating Customers...');
    const customers = await Pengguna.create([
      {
        namaLengkap: 'Ahmad Rizki Pratama',
        email: 'ahmad.rizki@email.com',
        password: 'password123',
        noHP: '081234567890',
        nik: '1101010101010001',
        address: 'Jl. Teuku Umar No. 123, Banda Aceh',
        customerType: 'rumah_tangga',
        accountStatus: 'active',
        isVerified: true,
      },
      {
        namaLengkap: 'Siti Nurhaliza',
        email: 'siti.nurhaliza@email.com',
        password: 'password123',
        noHP: '081234567891',
        nik: '1101010101010002',
        address: 'Jl. Cut Nyak Dien No. 456, Banda Aceh',
        customerType: 'rumah_tangga',
        accountStatus: 'active',
        isVerified: true,
      },
      {
        namaLengkap: 'PT. Maju Jaya Abadi',
        email: 'info@majujaya.com',
        password: 'password123',
        noHP: '0651123456',
        nik: '1101010101010003',
        address: 'Jl. Industri No. 789, Banda Aceh',
        customerType: 'komersial',
        accountStatus: 'active',
        isVerified: true,
      },
    ]);
    console.log('   Created ' + customers.length + ' Customers\n');

    // 3. Create Teknisi
    console.log('3. Creating Teknisi...');
    const teknisi = await Teknisi.create([
      {
        namaLengkap: 'Budi Santoso',
        email: 'budi.teknisi@pdam.com',
        password: 'password123',
        noHP: '081298765432',
        NIP: 'NIP-TECH-001',
        divisi: 'INSTALASI',
      },
      {
        namaLengkap: 'Andi Wijaya',
        email: 'andi.teknisi@pdam.com',
        password: 'password123',
        noHP: '081298765433',
        NIP: 'NIP-TECH-002',
        divisi: 'PEMELIHARAAN',
      },
    ]);
    console.log('   Created ' + teknisi.length + ' Teknisi\n');

    // 4. Create Connection Data
    console.log('4. Creating Connection Data...');
    const connectionData = await KoneksiData.create([
      {
        idPelanggan: customers[0]._id,
        NIK: customers[0].nik,
        noKK: '1101010101010010',
        IMB: 'IMB-2024-001',
        alamat: customers[0].address,
        kelurahan: 'Kuta Alam',
        kecamatan: 'Kuta Alam',
        luasBangunan: 120,
        statusVerifikasi: true,
      },
      {
        idPelanggan: customers[1]._id,
        NIK: customers[1].nik,
        noKK: '1101010101010011',
        IMB: 'IMB-2024-002',
        alamat: customers[1].address,
        kelurahan: 'Syiah Kuala',
        kecamatan: 'Syiah Kuala',
        luasBangunan: 90,
        statusVerifikasi: true,
      },
      {
        idPelanggan: customers[2]._id,
        NIK: customers[2].nik,
        noKK: '1101010101010012',
        IMB: 'IMB-2024-003',
        alamat: customers[2].address,
        kelurahan: 'Ulee Kareng',
        kecamatan: 'Ulee Kareng',
        luasBangunan: 500,
        statusVerifikasi: false,
      },
    ]);
    console.log('   Created ' + connectionData.length + ' Connection Data\n');

    // 5. Create Survey Data
    console.log('5. Creating Survey Data...');
    const surveys = await Survei.create([
      {
        idKoneksiData: connectionData[0]._id,
        idTeknisi: teknisi[0]._id,
        diameterPipa: '1/2 inch',
        jumlahPenghuni: 4,
        standar: true,
        catatan: 'Lokasi strategis, akses mudah',
      },
      {
        idKoneksiData: connectionData[1]._id,
        idTeknisi: teknisi[1]._id,
        diameterPipa: '3/4 inch',
        jumlahPenghuni: 5,
        standar: true,
        catatan: 'Perlu pipa tambahan 20 meter',
      },
    ]);
    console.log('   Created ' + surveys.length + ' Survey Data\n');

    // 6. Create RAB Connections
    console.log('6. Creating RAB Connections...');
    const rabConnections = await RABConnection.create([
      {
        idKoneksiData: connectionData[0]._id,
        totalBiaya: 2500000,
        statusPembayaran: 'Pending',
        catatan: 'Instalasi standar rumah tangga',
      },
      {
        idKoneksiData: connectionData[1]._id,
        totalBiaya: 3200000,
        statusPembayaran: 'Settlement',
        catatan: 'Termasuk pipa tambahan',
      },
    ]);
    console.log('   Created ' + rabConnections.length + ' RAB Connections\n');

    // 7. Create Meteran
    console.log('7. Creating Meteran...');
    const meteran = await Meteran.create([
      {
        nomorMeteran: 'MTR-2024-001',
        nomorAkun: 'ACC-2024-001',
        idKelompokPelanggan: kelompokRT._id,
        idKoneksiData: connectionData[0]._id,
      },
      {
        nomorMeteran: 'MTR-2024-002',
        nomorAkun: 'ACC-2024-002',
        idKelompokPelanggan: kelompokRT._id,
        idKoneksiData: connectionData[1]._id,
      },
      {
        nomorMeteran: 'MTR-2024-003',
        nomorAkun: 'ACC-2024-003',
        idKelompokPelanggan: kelompokKomersial._id,
        idKoneksiData: connectionData[2]._id,
      },
    ]);
    console.log('   Created ' + meteran.length + ' Meteran\n');

    // 8. Create Tagihan
    console.log('8. Creating Tagihan...');
    const currentDate = new Date();
    const periode = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');

    const tagihan = await Tagihan.create([
      {
        idMeteran: meteran[0]._id,
        periode: periode,
        penggunaanSebelum: 100,
        penggunaanSekarang: 150,
        totalPemakaian: 50,
        biaya: 125000,
        biayaBeban: 5000,
        totalBiaya: 130000,
        statusPembayaran: 'Settlement',
        metodePembayaran: 'Transfer Bank',
        tanggalPembayaran: new Date(),
        tenggatWaktu: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        menunggak: false,
      },
      {
        idMeteran: meteran[1]._id,
        periode: periode,
        penggunaanSebelum: 200,
        penggunaanSekarang: 280,
        totalPemakaian: 80,
        biaya: 210000,
        biayaBeban: 5000,
        totalBiaya: 215000,
        statusPembayaran: 'Pending',
        tenggatWaktu: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        menunggak: false,
      },
    ]);
    console.log('   Created ' + tagihan.length + ' Tagihan\n');

    console.log('='.repeat(50));
    console.log('SEEDING COMPLETED!');
    console.log('='.repeat(50));
    console.log('Summary:');
    console.log('  - Kelompok Pelanggan: 2');
    console.log('  - Customers: ' + customers.length);
    console.log('  - Teknisi: ' + teknisi.length);
    console.log('  - Connection Data: ' + connectionData.length);
    console.log('  - Survey Data: ' + surveys.length);
    console.log('  - RAB Connections: ' + rabConnections.length);
    console.log('  - Meteran: ' + meteran.length);
    console.log('  - Tagihan: ' + tagihan.length);
    console.log('\nDatabase is now ready for testing!\n');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run seeding
seedData();
