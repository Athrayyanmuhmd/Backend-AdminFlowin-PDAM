/**
 * seed-demo-data.cjs
 * Seeds realistic demo data for Aqualink admin panel demo/sidang
 * Collections: koneksidatas, surveydatas, rabconnections, pemasangans,
 *              pengawasanpemasangans, pengawasansetelahpemasangans, pekerjaanteknisis
 *
 * Requires existing data: adminaccounts, teknisis, penggunas, kelompokpelanggans
 * Run: node seed-demo-data.cjs
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Models
const AdminAccount   = require('./models/AdminAccount');
const Teknisi        = require('./models/Teknisi');
const Pengguna       = require('./models/Pengguna');
const ConnectionData = require('./models/ConnectionData');
const SurveyData     = require('./models/SurveyData');
const RabConnection  = require('./models/RabConnection');
const Pemasangan     = require('./models/Pemasangan');
const PengawasanPemasangan          = require('./models/PengawasanPemasangan');
const PengawasanSetelahPemasangan   = require('./models/PengawasanSetelahPemasangan');
const PekerjaanTeknisi              = require('./models/PekerjaanTeknisi');
const Meteran        = require('./models/Meteran');
const KelompokPelanggan = require('./models/KelompokPelanggan');

// Fake photo/document URLs (Cloudinary placeholders)
const FOTO_RUMAH    = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400';
const FOTO_METERAN  = 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400';
const FOTO_GABUNGAN = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400';
const URL_JARINGAN  = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400';
const URL_BAK       = 'https://images.unsplash.com/photo-1534237710431-e2fc698436d0?w=400';
const URL_RAB       = 'https://res.cloudinary.com/demo/image/upload/sample.pdf';

const ALAMAT_LIST = [
  'Jl. T. Nyak Arief No. 12, Syiah Kuala, Banda Aceh',
  'Jl. Tgk. Daud Beureueh No. 45, Baiturrahman, Banda Aceh',
  'Jl. Tgk. Chik Ditiro No. 8, Kuta Alam, Banda Aceh',
  'Jl. Diponegoro No. 21, Lueng Bata, Banda Aceh',
  'Jl. Cut Nyak Dhien No. 33, Meuraxa, Banda Aceh',
  'Jl. Tgk. Imum Lueng Bata No. 5, Lueng Bata, Banda Aceh',
  'Jl. Pango Raya No. 17, Ulee Kareng, Banda Aceh',
  'Jl. Teuku Umar No. 9, Baiturrahman, Banda Aceh',
];

const NAMA_LIST = [
  { namaLengkap: 'Ahmad Fauzi', email: 'ahmad.fauzi@gmail.com', noHP: '081234567890' },
  { namaLengkap: 'Siti Rahayu', email: 'siti.rahayu@gmail.com', noHP: '082345678901' },
  { namaLengkap: 'Budi Santoso', email: 'budi.santoso@gmail.com', noHP: '083456789012' },
  { namaLengkap: 'Dewi Lestari', email: 'dewi.lestari@gmail.com', noHP: '084567890123' },
  { namaLengkap: 'Rudi Hartono', email: 'rudi.hartono@gmail.com', noHP: '085678901234' },
  { namaLengkap: 'Aminah Binti Ali', email: 'aminah.ali@gmail.com', noHP: '086789012345' },
  { namaLengkap: 'Zulkifli Ibrahim', email: 'zulkifli.ibrahim@gmail.com', noHP: '087890123456' },
  { namaLengkap: 'Nurhayati Syahputra', email: 'nurhayati.s@gmail.com', noHP: '088901234567' },
];

const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo  = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // ─── Fetch existing data ───────────────────────────────────────────────
  const admins   = await AdminAccount.find().limit(3);
  const teknisis = await Teknisi.find().limit(5);
  const pengguna = await Pengguna.find().limit(10);
  const kelompok = await KelompokPelanggan.find().limit(3);

  if (!admins.length) { console.error('❌ No admins found. Run seed-dummy-data.cjs first.'); process.exit(1); }
  if (!teknisis.length) { console.error('❌ No teknisi found. Run seed-dummy-data.cjs first.'); process.exit(1); }

  console.log(`Found: ${admins.length} admins, ${teknisis.length} teknisis, ${pengguna.length} pengguna, ${kelompok.length} kelompok\n`);

  // ─── 1. KoneksiData ───────────────────────────────────────────────────
  console.log('📋 Seeding KoneksiData...');
  const existingKoneksi = await ConnectionData.countDocuments();
  let koneksiList = [];

  if (existingKoneksi >= 6) {
    koneksiList = await ConnectionData.find().limit(8);
    console.log(`  ↩ Using ${koneksiList.length} existing KoneksiData`);
  } else {
    // Create new pengguna + koneksi pairs
    for (let i = 0; i < 8; i++) {
      const namaData = NAMA_LIST[i];
      // Try to find or create pengguna
      let p = await Pengguna.findOne({ email: namaData.email });
      if (!p) {
        p = await Pengguna.create({
          namaLengkap: namaData.namaLengkap,
          email: namaData.email,
          noHP: namaData.noHP,
          password: '$2b$10$dummyhashedpassword123456789012',
          alamat: ALAMAT_LIST[i],
        });
      }

      const koneksi = await ConnectionData.create({
        idPelanggan: p._id,
        NIK: `1101${String(randInt(100000000000, 999999999999))}`,
        NIKUrl: FOTO_RUMAH,
        noKK: `1101${String(randInt(100000000000, 999999999999))}`,
        KKUrl: FOTO_RUMAH,
        IMB: `IMB-${randInt(1000, 9999)}/2024`,
        IMBUrl: URL_RAB,
        alamat: ALAMAT_LIST[i],
        kelurahan: 'Syiah Kuala',
        kecamatan: 'Syiah Kuala',
        kota: 'Banda Aceh',
        statusVerifikasi: i < 6 ? true : false,
        idTeknisi: teknisis[i % teknisis.length]._id,
        catatan: i < 6 ? 'Dokumen lengkap dan valid' : 'Menunggu verifikasi',
      });
      koneksiList.push(koneksi);
    }
    console.log(`  ✅ Created ${koneksiList.length} KoneksiData`);
  }

  const verifiedKoneksi = koneksiList.filter(k => k.statusVerifikasi === true);
  console.log(`  📌 Verified koneksi: ${verifiedKoneksi.length}\n`);

  // ─── 2. SurveyData ────────────────────────────────────────────────────
  console.log('🔍 Seeding SurveyData...');
  const existingSurvey = await SurveyData.countDocuments();
  let surveyList = [];

  if (existingSurvey >= 5) {
    surveyList = await SurveyData.find().limit(6);
    console.log(`  ↩ Using ${surveyList.length} existing SurveyData`);
  } else {
    for (let i = 0; i < Math.min(6, verifiedKoneksi.length); i++) {
      const k = verifiedKoneksi[i];
      // check if survey already exists
      const existing = await SurveyData.findOne({ idKoneksiData: k._id });
      if (existing) { surveyList.push(existing); continue; }

      const survey = await SurveyData.create({
        idKoneksiData: k._id,
        idTeknisi: teknisis[i % teknisis.length]._id,
        urlJaringan: URL_JARINGAN,
        diameterPipa: randItem([0.5, 0.75, 1.0]),
        urlPosisiBak: URL_BAK,
        posisiMeteran: randItem(['Depan Rumah', 'Samping Kanan', 'Samping Kiri', 'Dalam Pagar']),
        jumlahPenghuni: String(randInt(2, 8)),
        koordinat: { latitude: 5.5 + Math.random() * 0.1, longitude: 95.3 + Math.random() * 0.1 },
        standar: i < 5,
        catatan: i < 5 ? 'Lokasi mudah diakses, instalasi standar' : 'Perlu penggalian tambahan',
      });
      surveyList.push(survey);
    }
    console.log(`  ✅ Created/found ${surveyList.length} SurveyData`);
  }

  // ─── 3. RabConnection ─────────────────────────────────────────────────
  console.log('💰 Seeding RabConnection...');
  const existingRab = await RabConnection.countDocuments();
  let rabList = [];
  const biayaOptions = [1500000, 2000000, 2500000, 3000000, 3500000];

  if (existingRab >= 5) {
    rabList = await RabConnection.find().limit(6);
    console.log(`  ↩ Using ${rabList.length} existing RabConnection`);
  } else {
    for (let i = 0; i < Math.min(6, verifiedKoneksi.length); i++) {
      const k = verifiedKoneksi[i];
      const existing = await RabConnection.findOne({ idKoneksiData: k._id });
      if (existing) { rabList.push(existing); continue; }

      const rab = await RabConnection.create({
        idKoneksiData: k._id,
        totalBiaya: randItem(biayaOptions),
        statusPembayaran: i < 4 ? 'Settlement' : 'Pending',
        urlRab: URL_RAB,
        catatan: 'Estimasi biaya pemasangan termasuk material dan jasa',
      });
      rabList.push(rab);
    }
    console.log(`  ✅ Created/found ${rabList.length} RabConnection`);
  }

  // ─── 4. Meteran (cek existing, buat jika perlu) ────────────────────────
  console.log('⚙️  Checking Meteran...');
  const existingMeteran = await Meteran.find({ idKoneksiData: { $in: verifiedKoneksi.map(k => k._id) } });
  console.log(`  Found ${existingMeteran.length} existing meteran for verified koneksi\n`);

  // ─── 5. Pemasangan ────────────────────────────────────────────────────
  console.log('🔧 Seeding Pemasangan...');
  const existingPemasangan = await Pemasangan.countDocuments();
  let pemasanganList = [];

  const statusVerifOptions = ['Pending', 'Disetujui', 'Disetujui', 'Disetujui', 'Ditolak', 'Disetujui'];

  if (existingPemasangan >= 5) {
    pemasanganList = await Pemasangan.find().limit(8);
    console.log(`  ↩ Using ${pemasanganList.length} existing Pemasangan`);
  } else {
    for (let i = 0; i < Math.min(6, verifiedKoneksi.length); i++) {
      const k = verifiedKoneksi[i];
      const existing = await Pemasangan.findOne({ idKoneksiData: k._id });
      if (existing) { pemasanganList.push(existing); continue; }

      const status = statusVerifOptions[i] || 'Pending';
      const teknisi = teknisis[i % teknisis.length];
      const admin = admins[0];

      const pemasangan = await Pemasangan.create({
        idKoneksiData: k._id,
        seriMeteran: `WM-ACH-2025-${String(1000 + i).padStart(4, '0')}`,
        fotoRumah: FOTO_RUMAH,
        fotoMeteran: FOTO_METERAN,
        fotoMeteranDanRumah: FOTO_GABUNGAN,
        catatan: status === 'Ditolak'
          ? 'Lokasi pemasangan tidak sesuai standar teknis'
          : 'Pemasangan berjalan lancar sesuai rencana',
        teknisiId: teknisi._id,
        tanggalPemasangan: daysAgo(randInt(5, 60)),
        statusVerifikasi: status,
        ...(status !== 'Pending' && {
          diverifikasiOleh: admin._id,
          tanggalVerifikasi: daysAgo(randInt(1, 4)),
        }),
        detailPemasangan: {
          diameterPipa: randItem([0.5, 0.75, 1.0]),
          lokasiPemasangan: randItem(['Depan Rumah', 'Samping Kanan', 'Samping Kiri']),
          koordinat: { latitude: 5.5 + Math.random() * 0.1, longitude: 95.3 + Math.random() * 0.1 },
          materialDigunakan: ['Pipa PVC 1/2 inch', 'Klem pipa', 'Sealant', randItem(['Stop kran', 'Ball valve'])],
        },
      });
      pemasanganList.push(pemasangan);
    }
    console.log(`  ✅ Created/found ${pemasanganList.length} Pemasangan`);
  }

  const disetujuiPemasangan = pemasanganList.filter(p => p.statusVerifikasi === 'Disetujui');
  console.log(`  📌 Disetujui: ${disetujuiPemasangan.length}\n`);

  // ─── 6. PengawasanPemasangan ──────────────────────────────────────────
  console.log('👁️  Seeding PengawasanPemasangan...');
  const existingPP = await PengawasanPemasangan.countDocuments();
  let ppList = [];

  const hasilOptions = ['Sesuai', 'Sesuai', 'Sesuai', 'Perbaikan Diperlukan', 'Tidak Sesuai'];
  const checklistOptions = ['Baik', 'Baik', 'Cukup'];

  if (existingPP >= 4) {
    ppList = await PengawasanPemasangan.find().limit(6);
    console.log(`  ↩ Using ${ppList.length} existing PengawasanPemasangan`);
  } else {
    for (let i = 0; i < Math.min(5, pemasanganList.length); i++) {
      const p = pemasanganList[i];
      const existing = await PengawasanPemasangan.findOne({ idPemasangan: p._id });
      if (existing) { ppList.push(existing); continue; }

      const hasil = hasilOptions[i] || 'Sesuai';
      const perluTL = hasil !== 'Sesuai';

      const pp = await PengawasanPemasangan.create({
        idPemasangan: p._id,
        urlGambar: [FOTO_METERAN, FOTO_GABUNGAN],
        catatan: hasil === 'Sesuai'
          ? 'Semua aspek pemasangan sesuai standar teknis yang ditetapkan'
          : hasil === 'Perbaikan Diperlukan'
          ? 'Terdapat beberapa poin yang memerlukan perbaikan minor sebelum serah terima'
          : 'Pemasangan tidak memenuhi standar, perlu dilakukan ulang',
        supervisorId: teknisis[(i + 1) % teknisis.length]._id,
        tanggalPengawasan: daysAgo(randInt(1, 7)),
        hasilPengawasan: hasil,
        temuan: perluTL
          ? ['Posisi meteran kurang optimal', 'Sambungan pipa perlu pengecekan ulang']
          : [],
        rekomendasi: perluTL ? 'Lakukan perbaikan dalam 3 hari kerja' : '',
        perluTindakLanjut: perluTL,
        checklist: {
          kualitasSambunganPipa: randItem(checklistOptions),
          posisiMeteran: i < 3 ? 'Tepat' : 'Perlu Penyesuaian',
          kebersihanPemasangan: randItem(checklistOptions),
          kepatuhanK3: 'Baik',
        },
      });
      ppList.push(pp);
    }
    console.log(`  ✅ Created/found ${ppList.length} PengawasanPemasangan`);
  }

  // ─── 7. PengawasanSetelahPemasangan ───────────────────────────────────
  console.log('✅ Seeding PengawasanSetelahPemasangan...');
  const existingPSP = await PengawasanSetelahPemasangan.countDocuments();
  let pspList = [];

  const hasilSetelahOptions = ['Baik', 'Baik', 'Baik', 'Perlu Perbaikan', 'Bermasalah'];
  const statusMeteranOptions = ['Berfungsi Normal', 'Berfungsi Normal', 'Berfungsi Normal', 'Perlu Kalibrasi', 'Bermasalah'];
  const ratingOptions = [5, 4, 5, 3, 2];

  if (existingPSP >= 4) {
    pspList = await PengawasanSetelahPemasangan.find().limit(6);
    console.log(`  ↩ Using ${pspList.length} existing PengawasanSetelahPemasangan`);
  } else {
    for (let i = 0; i < Math.min(5, disetujuiPemasangan.length); i++) {
      const p = disetujuiPemasangan[i];
      const existing = await PengawasanSetelahPemasangan.findOne({ idPemasangan: p._id });
      if (existing) { pspList.push(existing); continue; }

      const hasil = hasilSetelahOptions[i] || 'Baik';
      const statusMeter = statusMeteranOptions[i] || 'Berfungsi Normal';
      const perluTL = hasil !== 'Baik';
      const rating = ratingOptions[i] || 4;

      const psp = await PengawasanSetelahPemasangan.create({
        idPemasangan: p._id,
        urlGambar: [FOTO_METERAN, FOTO_GABUNGAN],
        catatan: hasil === 'Baik'
          ? 'Meteran berfungsi dengan baik, pelanggan puas dengan layanan pemasangan'
          : hasil === 'Perlu Perbaikan'
          ? 'Terdapat sedikit kebocoran pada sambungan, perlu perbaikan segera'
          : 'Meteran tidak berfungsi normal, perlu penggantian unit',
        supervisorId: teknisis[(i + 2) % teknisis.length]._id,
        tanggalPengawasan: daysAgo(randInt(1, 5)),
        hariSetelahPemasangan: randItem([3, 7, 14]),
        hasilPengawasan: hasil,
        statusMeteran: statusMeter,
        bacaanAwal: randInt(0, 5),
        masalahDitemukan: perluTL
          ? [hasil === 'Perlu Perbaikan' ? 'Kebocoran kecil pada sambungan' : 'Unit meteran error, tidak mencatat']
          : [],
        tindakan: perluTL ? 'Teknisi akan datang kembali untuk perbaikan' : '',
        rekomendasi: perluTL ? 'Segera lakukan perbaikan dalam 48 jam' : 'Lakukan pemeriksaan berkala 6 bulan sekali',
        perluTindakLanjut: perluTL,
        checklist: {
          meteranBacaCorrect: !perluTL,
          tidakAdaKebocoran: hasil === 'Baik',
          sambunganAman: i < 3,
          mudahDibaca: true,
          pelangganPuas: rating >= 4,
          dokumentasiLengkap: true,
        },
        feedbackPelanggan: {
          rating,
          komentar: rating >= 4
            ? 'Pelayanan sangat baik, teknisi ramah dan profesional'
            : rating === 3
            ? 'Cukup baik, ada sedikit masalah yang perlu diperbaiki'
            : 'Kecewa dengan hasilnya, masih ada kebocoran',
        },
      });
      pspList.push(psp);
    }
    console.log(`  ✅ Created/found ${pspList.length} PengawasanSetelahPemasangan`);
  }

  // ─── 8. PekerjaanTeknisi (Work Orders) ────────────────────────────────
  console.log('📋 Seeding PekerjaanTeknisi (Work Orders)...');
  const existingWO = await PekerjaanTeknisi.countDocuments();
  let woList = [];

  const statusWOOptions = ['Ditugaskan', 'SedangDikerjakan', 'Selesai', 'Selesai', 'DitinjauAdmin', 'Dibatalkan'];

  if (existingWO >= 5) {
    woList = await PekerjaanTeknisi.find().limit(8);
    console.log(`  ↩ Using ${woList.length} existing PekerjaanTeknisi`);
  } else {
    for (let i = 0; i < Math.min(6, surveyList.length); i++) {
      const survey = surveyList[i];
      const rab = rabList[i] || rabList[0];
      const pemasangan = pemasanganList[i] || null;
      const pp = ppList[i] || null;
      const psp = pspList[i] || null;
      const status = statusWOOptions[i] || 'Ditugaskan';

      const tim = [
        teknisis[i % teknisis.length]._id,
        ...(teknisis.length > 1 ? [teknisis[(i + 1) % teknisis.length]._id] : []),
      ];

      const wo = await PekerjaanTeknisi.create({
        idSurvei: survey._id,
        rabId: rab._id,
        ...(pemasangan && { idPemasangan: pemasangan._id }),
        ...(pp && { idPengawasanPemasangan: pp._id }),
        ...(psp && { idPengawasanSetelahPemasangan: psp._id }),
        tim,
        status,
        disetujui: status === 'Selesai' ? true : status === 'Dibatalkan' ? false : null,
        catatan: status === 'Selesai'
          ? 'Pekerjaan selesai tepat waktu dan sesuai standar'
          : status === 'Dibatalkan'
          ? 'Dibatalkan atas permintaan pelanggan'
          : status === 'SedangDikerjakan'
          ? 'Teknisi sedang di lapangan'
          : null,
      });
      woList.push(wo);
    }
    console.log(`  ✅ Created ${woList.length} PekerjaanTeknisi`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Seed demo data selesai!\n');

  const counts = {
    KoneksiData: await ConnectionData.countDocuments(),
    SurveyData: await SurveyData.countDocuments(),
    RabConnection: await RabConnection.countDocuments(),
    Pemasangan: await Pemasangan.countDocuments(),
    PengawasanPemasangan: await PengawasanPemasangan.countDocuments(),
    PengawasanSetelahPemasangan: await PengawasanSetelahPemasangan.countDocuments(),
    PekerjaanTeknisi: await PekerjaanTeknisi.countDocuments(),
    Meteran: await Meteran.countDocuments(),
  };

  Object.entries(counts).forEach(([col, count]) => {
    console.log(`  ${col.padEnd(30)} ${count} dokumen`);
  });

  console.log('\n✅ Database siap untuk demo!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed error:', err);
  mongoose.disconnect();
  process.exit(1);
});
