/**
 * Seed satu data KoneksiData dummy untuk testing stepper koneksi baru
 * Run: node seed-koneksi-test.cjs
 */

const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✓ Connected to MongoDB'))
  .catch(err => { console.error('MongoDB error:', err); process.exit(1); });

// --- Inline schemas (minimal, matching existing collections) ---

const PenggunaSchema = new mongoose.Schema({
  namaLengkap: String,
  email: String,
  noHP: String,
  password: String,
  isVerified: { type: Boolean, default: true },
}, { collection: 'penggunas', timestamps: true });

const TeknisiSchema = new mongoose.Schema({
  namaLengkap: String,
  email: String,
  noHP: String,
  NIP: String,
  divisi: String,
  password: String,
}, { collection: 'teknisis', timestamps: true });

const KoneksiDataSchema = new mongoose.Schema({
  idPelanggan: { type: mongoose.Schema.Types.ObjectId, ref: 'Pengguna', default: null },
  statusVerifikasi: { type: String, enum: ['Menunggu', 'Disetujui', 'Ditolak'], default: 'Menunggu' },
  NIK: String,
  NIKUrl: String,
  noKK: String,
  KKUrl: String,
  IMB: String,
  IMBUrl: String,
  alamat: String,
  kelurahan: String,
  kecamatan: String,
  luasBangunan: Number,
  catatan: String,
  alasanPenolakan: String,
  tanggalVerifikasi: Date,
  idTeknisi: { type: mongoose.Schema.Types.ObjectId, ref: 'Teknisi', default: null },
  idTeknisiDED: { type: mongoose.Schema.Types.ObjectId, ref: 'Teknisi', default: null },
  assignedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
}, { collection: 'koneksidatas', timestamps: true });

const Pengguna = mongoose.model('Pengguna', PenggunaSchema);
const Teknisi = mongoose.model('Teknisi', TeknisiSchema);
const KoneksiData = mongoose.model('KoneksiData', KoneksiDataSchema);

async function seed() {
  try {
    // --- 1. Cari atau buat user dummy ---
    let user = await Pengguna.findOne({ email: 'dummy.pelanggan@test.com' });
    if (!user) {
      user = await Pengguna.create({
        namaLengkap: 'Budi Santoso (Dummy)',
        email: 'dummy.pelanggan@test.com',
        noHP: '08123456789',
        password: 'dummy_hashed',
        isVerified: true,
      });
      console.log('✓ Pengguna dummy dibuat:', user.namaLengkap);
    } else {
      console.log('✓ Pengguna dummy sudah ada:', user.namaLengkap);
    }

    // --- 2. Cari atau buat teknisi dummy ---
    let teknisi = await Teknisi.findOne({ email: 'teknisi.dummy@test.com' });
    if (!teknisi) {
      teknisi = await Teknisi.create({
        namaLengkap: 'Ahmad Teknisi (Dummy)',
        email: 'teknisi.dummy@test.com',
        noHP: '08187654321',
        NIP: 'TK-DUMMY-001',
        divisi: 'Lapangan',
        password: 'dummy_hashed',
      });
      console.log('✓ Teknisi dummy dibuat:', teknisi.namaLengkap);
    } else {
      console.log('✓ Teknisi dummy sudah ada:', teknisi.namaLengkap);
    }

    // --- 3. Cek apakah KoneksiData test sudah ada ---
    const existing = await KoneksiData.findOne({ 'NIK': '1234567890123456' });
    if (existing) {
      console.log('\n⚠ KoneksiData test sudah ada, ID:', existing._id.toString());
      console.log('  Buka: /operations/connection-data/' + existing._id.toString());
      process.exit(0);
    }

    // --- 4. Buat KoneksiData dummy ---
    const koneksi = await KoneksiData.create({
      idPelanggan: user._id,
      statusVerifikasi: 'Menunggu',
      NIK: '1234567890123456',
      NIKUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      noKK: '1234567890123456',
      KKUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      IMB: 'IMB-2024-001',
      IMBUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      alamat: 'Jl. Contoh No. 10, Banda Aceh',
      kelurahan: 'Lamlagang',
      kecamatan: 'Banda Raya',
      luasBangunan: 72,
      catatan: null,
    });

    console.log('\n✓ KoneksiData dummy berhasil dibuat!');
    console.log('  ID:', koneksi._id.toString());
    console.log('  Pelanggan:', user.namaLengkap);
    console.log('  Status:', koneksi.statusVerifikasi);
    console.log('\n  Buka di browser:');
    console.log('  /operations/connection-data/' + koneksi._id.toString());
    console.log('\n  ID Teknisi dummy (untuk assign):');
    console.log('  ' + teknisi._id.toString(), '-', teknisi.namaLengkap);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

mongoose.connection.once('open', seed);
