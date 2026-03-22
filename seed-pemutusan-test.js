/**
 * Seed script: fix tarif Rp 0 + buat test data pemutusan
 * Run: npx tsx seed-pemutusan-test.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import KelompokPelanggan from './models/KelompokPelanggan.js';
import User from './models/User.js';
import Meteran from './models/Meteran.js';
import ConnectionData from './models/ConnectionData.js';
import Billing from './models/Billing.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // ── 1. Fix KelompokPelanggan dengan nilai 0 ───────────────────────────────
  console.log('1. Fixing KelompokPelanggan dengan nilai 0...');

  const TARIF_DEFAULT = [
    { namaKelompok: 'Rumah Tangga A',  hargaDiBawah10mKubik: 1500,  hargaDiAtas10mKubik: 2000,  biayaBeban: 7500  },
    { namaKelompok: 'Rumah Tangga B',  hargaDiBawah10mKubik: 2000,  hargaDiAtas10mKubik: 3000,  biayaBeban: 10000 },
    { namaKelompok: 'Niaga Kecil',     hargaDiBawah10mKubik: 4500,  hargaDiAtas10mKubik: 6000,  biayaBeban: 15000 },
    { namaKelompok: 'Niaga Besar',     hargaDiBawah10mKubik: 7000,  hargaDiAtas10mKubik: 9000,  biayaBeban: 20000 },
    { namaKelompok: 'Industri',        hargaDiBawah10mKubik: 8000,  hargaDiAtas10mKubik: 10000, biayaBeban: 25000 },
    { namaKelompok: 'Sosial Umum',     hargaDiBawah10mKubik: 500,   hargaDiAtas10mKubik: 750,   biayaBeban: 3000  },
  ];

  const kelompoks = await KelompokPelanggan.find({}).lean();
  let fixedCount = 0;

  for (let i = 0; i < kelompoks.length; i++) {
    const k = kelompoks[i];
    const needsFix = !k.namaKelompok || k.hargaDiBawah10mKubik === 0 || k.hargaDiAtas10mKubik === 0;
    if (needsFix) {
      const tarif = TARIF_DEFAULT[i % TARIF_DEFAULT.length];
      await KelompokPelanggan.findByIdAndUpdate(k._id, {
        namaKelompok:        k.namaKelompok || tarif.namaKelompok,
        hargaDiBawah10mKubik: k.hargaDiBawah10mKubik || tarif.hargaDiBawah10mKubik,
        hargaDiAtas10mKubik:  k.hargaDiAtas10mKubik  || tarif.hargaDiAtas10mKubik,
        biayaBeban:           k.biayaBeban            || tarif.biayaBeban,
      });
      console.log(`   ✅ Fixed: ${tarif.namaKelompok}`);
      fixedCount++;
    }
  }

  // Jika tidak ada kelompok sama sekali, buat dari default
  if (kelompoks.length === 0) {
    await KelompokPelanggan.insertMany(TARIF_DEFAULT);
    console.log('   ✅ Created 6 default KelompokPelanggan');
  } else {
    console.log(`   Total fixed: ${fixedCount} records\n`);
  }

  // ── 2. Buat test data untuk pemutusan ────────────────────────────────────
  console.log('2. Membuat test data pemutusan...');

  // Cari atau buat user test
  let testUser = await User.findOne({ email: 'test.pemutusan@aqualink.test' }).lean();
  if (!testUser) {
    testUser = await User.create({
      email:        'test.pemutusan@aqualink.test',
      namaLengkap:  'Ahmad Penunggak (TEST)',
      noHP:         '081234560001',
      nik:          'TEST-NIK-PEMUTUSAN-001',
      accountStatus: 'active',
    });
    console.log('   ✅ Created test user: Ahmad Penunggak (TEST)');
  } else {
    console.log('   ℹ️  Test user sudah ada, skip buat user');
  }

  // Cari kelompok untuk meteran test
  const kelompokForTest = await KelompokPelanggan.findOne({}).lean();

  // Cari atau buat meteran test
  let testMeteran = await Meteran.findOne({ nomorMeteran: 'TEST-001-PEMUTUSAN' }).lean();
  if (!testMeteran) {
    // Buat koneksi data dulu
    const koneksiData = await ConnectionData.create({
      idPelanggan:      testUser._id,
      statusVerifikasi: 'Disetujui',
      NIK:              '9999000000000001',
      noKK:             '9999000000000001',
      alamat:           'Jl. Test Pemutusan No. 1, Banda Aceh',
    });

    testMeteran = await Meteran.create({
      nomorMeteran:          'TEST-001-PEMUTUSAN',
      nomorAkun:             'TEST-AKUN-001',
      idKelompokPelanggan:   kelompokForTest?._id,
      idKoneksiData:         koneksiData._id,
      statusAktif:           true,
      totalPemakaian:        150,
      pemakaianBelumTerbayar: 45,
    });
    console.log('   ✅ Created test meteran: TEST-001-PEMUTUSAN');
  } else {
    console.log('   ℹ️  Test meteran sudah ada, skip buat meteran');
  }

  // Hapus billing test lama jika ada agar tidak duplikat
  await Billing.deleteMany({ idMeteran: testMeteran._id });

  // Buat 3 billing Pending berturut-turut (Jan, Feb, Mar 2026)
  const now = new Date();
  const bulan1 = new Date(2026, 0, 1); // Januari 2026
  const bulan2 = new Date(2026, 1, 1); // Februari 2026
  const bulan3 = new Date(2026, 2, 1); // Maret 2026

  const biaya1 = 15 * 1500 + 7500; // 15m³ di bawah 10 = 10*1500 + 5*2000 = 25000 + 7500
  const biaya2 = 20 * 1500 + 7500;
  const biaya3 = 10 * 1500 + 7500;

  // Tagihan bulan 1 (Januari) — akan di-merge
  const bill1 = await Billing.create({
    userId:            testUser._id,
    idMeteran:         testMeteran._id,
    periode:           bulan1,
    penggunaanSebelum: 100,
    penggunaanSekarang: 115,
    totalPemakaian:    15,
    biaya:             biaya1 - 7500,
    biayaBeban:        7500,
    totalBiaya:        biaya1,
    statusPembayaran:  'Merged',
    tenggatWaktu:      new Date(2026, 0, 25),
    menunggak:         true,
    jenisBilling:      'normal',
    bulanCakupan:      1,
  });

  // Tagihan bulan 2 (Februari) — akan di-merge
  const bill2 = await Billing.create({
    userId:            testUser._id,
    idMeteran:         testMeteran._id,
    periode:           bulan2,
    penggunaanSebelum: 115,
    penggunaanSekarang: 135,
    totalPemakaian:    20,
    biaya:             biaya2 - 7500,
    biayaBeban:        7500,
    totalBiaya:        biaya2,
    statusPembayaran:  'Merged',
    tenggatWaktu:      new Date(2026, 1, 25),
    menunggak:         true,
    jenisBilling:      'normal',
    bulanCakupan:      1,
  });

  // Tagihan gabungan (Jan + Feb) — ini yang muncul di pemutusan
  const mergedBill = await Billing.create({
    userId:            testUser._id,
    idMeteran:         testMeteran._id,
    periode:           bulan1,
    penggunaanSebelum: 100,
    penggunaanSekarang: 135,
    totalPemakaian:    35,
    biaya:             (biaya1 - 7500) + (biaya2 - 7500),
    biayaBeban:        7500 + 7500,
    totalBiaya:        biaya1 + biaya2,
    statusPembayaran:  'Pending',
    tenggatWaktu:      new Date(2026, 1, 25),
    menunggak:         true,
    jenisBilling:      'normal',
    isMergedBilling:   true,
    bulanCakupan:      2,
    mergedFromIds:     [bill1._id, bill2._id],
    catatan:           'Tagihan gabungan periode Januari 2026 dan Februari 2026',
  });

  // Update bill1 dan bill2 agar punya pointer ke merged
  await Billing.updateMany(
    { _id: { $in: [bill1._id, bill2._id] } },
    { $set: { mergedIntoBillingId: mergedBill._id } }
  );

  // Tagihan bulan 3 (Maret) — berdiri sendiri
  await Billing.create({
    userId:            testUser._id,
    idMeteran:         testMeteran._id,
    periode:           bulan3,
    penggunaanSebelum: 135,
    penggunaanSekarang: 145,
    totalPemakaian:    10,
    biaya:             biaya3 - 7500,
    biayaBeban:        7500,
    totalBiaya:        biaya3,
    statusPembayaran:  'Pending',
    tenggatWaktu:      new Date(2026, 2, 25),
    menunggak:         true,
    jenisBilling:      'normal',
    bulanCakupan:      1,
    catatan:           'Tagihan Maret 2026',
  });

  console.log('   ✅ Created: 2 Merged billings (Jan+Feb) + 1 merged gabungan + 1 Pending (Mar)');
  console.log('   👤 Test user: Ahmad Penunggak (TEST) — jumlah tunggak: 3 bulan');
  console.log('   🔗 Akan muncul di Daftar Pemutusan > "Perlu Diputus"\n');

  await mongoose.connection.close();
  console.log('✅ Selesai! Restart backend lalu refresh halaman pemutusan.\n');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
