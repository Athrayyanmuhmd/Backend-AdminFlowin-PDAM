/**
 * Seed Script: Isi tagihans dengan data realistis 6 bulan
 *
 * Strategi:
 * - Gunakan meteran yang sudah ada di database (5 dokumen di meterans)
 * - Buat tagihan untuk 6 bulan terakhir (Agu 2025 - Jan 2026)
 * - Variasikan status: sebagian Settlement (lunas), sebagian Pending, sebagian menunggak
 * - Data KelompokPelanggan diambil dari meteran yang sudah ada
 *
 * Run: node seed-tagihan.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Billing from './models/Billing.js';
import Meteran from './models/Meteran.js';
import KelompokPelanggan from './models/KelompokPelanggan.js';
import User from './models/User.js';

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log('✅ Terhubung ke MongoDB\n');

// Ambil data yang sudah ada
const meteranList = await Meteran.find().populate('kelompokPelangganId');
const penggunaList = await User.find();

if (meteranList.length === 0) {
  console.error('❌ Tidak ada meteran di database. Jalankan seed meteran dulu.');
  process.exit(1);
}

console.log(`📊 Ditemukan ${meteranList.length} meteran, ${penggunaList.length} pengguna\n`);

// Hapus tagihan lama jika ada
const hapusLama = await Billing.deleteMany({});
console.log(`🗑️  Hapus ${hapusLama.deletedCount} tagihan lama\n`);

// Helper: hitung biaya berdasarkan kelompok dan pemakaian
function hitungBiaya(kelompok, totalPemakaian) {
  if (!kelompok) return { biaya: totalPemakaian * 2500, biayaBeban: 5000 };
  const harga = totalPemakaian <= 10
    ? kelompok.hargaDiBawah10mKubik
    : kelompok.hargaDiBawah10mKubik * 10 + (totalPemakaian - 10) * kelompok.hargaDiAtas10mKubik;
  return {
    biaya: Math.round(harga),
    biayaBeban: kelompok.biayaBeban || 5000,
  };
}

// 6 bulan: Agustus 2025 s/d Januari 2026
const periodeList = [
  { tahun: 2025, bulan: 8,  label: 'Agustus 2025' },
  { tahun: 2025, bulan: 9,  label: 'September 2025' },
  { tahun: 2025, bulan: 10, label: 'Oktober 2025' },
  { tahun: 2025, bulan: 11, label: 'November 2025' },
  { tahun: 2025, bulan: 12, label: 'Desember 2025' },
  { tahun: 2026, bulan: 1,  label: 'Januari 2026' },
];

// Pemakaian awal per meteran (m³) — berbeda-beda sesuai tipe pelanggan
const pemakaianAwalPerMeteran = {};
meteranList.forEach((m, idx) => {
  pemakaianAwalPerMeteran[m._id.toString()] = 100 + idx * 80;
});

const tagihanDibuat = [];
let totalTagihanDibuat = 0;

for (const periode of periodeList) {
  console.log(`📅 Membuat tagihan periode: ${periode.label}`);

  const tanggalPeriode = new Date(periode.tahun, periode.bulan - 1, 1);
  const tenggatWaktu = new Date(periode.tahun, periode.bulan, 20); // tanggal 20 bulan berikutnya
  const isLaluDanLunas = periode.bulan <= 12 && periode.tahun <= 2025 && periode.bulan < 12;
  const isBulanIni = periode.tahun === 2026 && periode.bulan === 1;

  for (let i = 0; i < meteranList.length; i++) {
    const meteran = meteranList[i];
    const kelompok = meteran.kelompokPelangganId;
    const mId = meteran._id.toString();

    // Pemakaian bulan ini: antara 8-25 m³ tergantung meteran
    const variasiPemakaian = [12, 18, 8, 22, 15];
    const totalPemakaian = variasiPemakaian[i % variasiPemakaian.length] + Math.round((periode.bulan % 3) * 2);

    const penggunaanSebelum = pemakaianAwalPerMeteran[mId];
    const penggunaanSekarang = penggunaanSebelum + totalPemakaian;
    pemakaianAwalPerMeteran[mId] = penggunaanSekarang; // update untuk bulan berikutnya

    const { biaya, biayaBeban } = hitungBiaya(kelompok, totalPemakaian);
    const totalBiaya = biaya + biayaBeban;

    // Tentukan status: bulan-bulan lalu sebagian besar lunas, bulan ini ada yang pending/menunggak
    let statusPembayaran, tanggalPembayaran, menunggak, denda;

    if (isLaluDanLunas && i < meteranList.length - 1) {
      // Bulan lalu, sebagian besar lunas
      statusPembayaran = 'Settlement';
      tanggalPembayaran = new Date(periode.tahun, periode.bulan - 1, 10 + i);
      menunggak = false;
      denda = 0;
    } else if (i === meteranList.length - 1 && !isBulanIni) {
      // Satu meteran di setiap bulan lampau: menunggak
      statusPembayaran = 'Pending';
      tanggalPembayaran = null;
      menunggak = true;
      denda = Math.round(totalBiaya * 0.02); // denda 2%
    } else {
      // Bulan ini: semua pending belum bayar
      statusPembayaran = 'Pending';
      tanggalPembayaran = null;
      menunggak = false;
      denda = 0;
    }

    // userId — cari dari pengguna yang punya meteran ini, atau fallback ke pengguna pertama
    const userId = penggunaList[i % penggunaList.length]?._id || penggunaList[0]._id;

    tagihanDibuat.push({
      userId,
      idMeteran: meteran._id,
      periode: tanggalPeriode,
      penggunaanSebelum,
      penggunaanSekarang,
      totalPemakaian,
      biaya,
      biayaBeban,
      totalBiaya,
      statusPembayaran,
      tanggalPembayaran,
      tenggatWaktu,
      menunggak,
      denda,
      catatan: '',
      metodePembayaran: statusPembayaran === 'Settlement' ? 'Transfer Bank' : null,
      createdAt: tanggalPeriode,
      updatedAt: tanggalPeriode,
    });
    totalTagihanDibuat++;
  }

  console.log(`   ✅ ${meteranList.length} tagihan dibuat untuk ${periode.label}`);
}

// Insert semua sekaligus
await Billing.insertMany(tagihanDibuat);

console.log('\n' + '='.repeat(50));
console.log('✅ SEEDING TAGIHAN SELESAI');
console.log('='.repeat(50));
console.log(`Total tagihan dibuat : ${totalTagihanDibuat}`);
console.log(`Periode              : Agustus 2025 – Januari 2026`);
console.log(`Meteran digunakan    : ${meteranList.length}`);

// Ringkasan status
const lunas = tagihanDibuat.filter(t => t.statusPembayaran === 'Settlement').length;
const pending = tagihanDibuat.filter(t => t.statusPembayaran === 'Pending' && !t.menunggak).length;
const tunggakan = tagihanDibuat.filter(t => t.menunggak).length;
console.log(`\nRingkasan status:`);
console.log(`  Settlement (lunas) : ${lunas}`);
console.log(`  Pending            : ${pending}`);
console.log(`  Menunggak          : ${tunggakan}`);

await mongoose.connection.close();
console.log('\n✅ Selesai. Koneksi ditutup.');
