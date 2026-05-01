// @ts-nocheck
import Meteran from '../../../models/Meteran.js';
import RiwayatPenggunaan from '../../../models/RiwayatPenggunaan.js';
import User from '../../../models/User.js';
import { verifyAdminToken } from '../helpers.js';
import { isRedisConnected, getRedisClient } from '../../../utils/redis.js';
import type { GraphQLContext } from '../../../types/index.js';

// ─── Konstanta timezone WIB (UTC+7) ──────────────────────────────────────────
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

// ─── Nama bulan Indonesia ─────────────────────────────────────────────────────
const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];

function periodeLabel(periode: string): string {
  const [tahun, bulan] = periode.split('-');
  return `${NAMA_BULAN[parseInt(bulan, 10) - 1]} ${tahun}`;
}

function periodeSebelumnya(periode: string): string {
  const [tahun, bulan] = periode.split('-').map(Number);
  const d = new Date(tahun, bulan - 2, 1); // bulan-2 karena bulan JS 0-based
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodeSekarang(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function hariDalamBulan(periode: string): number {
  const [tahun, bulan] = periode.split('-').map(Number);
  return new Date(tahun, bulan, 0).getDate();
}

function hariSekarangDalamBulan(): number {
  return new Date().getDate();
}

// ─── Resolve userId dari meteranId via Meteran → IdKoneksiData → IdPelanggan ──
// Kunci Redis flowin: iot:{userId}:{meteranId}
// Gunakan relasi ERD — bukan User.meteranId (legacy, sering null)
async function getUserIdByMeteranId(meteranId: string): Promise<string | null> {
  try {
    const meteran = await Meteran.findById(meteranId)
      .populate({ path: 'IdKoneksiData', select: 'IdPelanggan' })
      .select('IdKoneksiData')
      .lean() as any;
    return meteran?.IdKoneksiData?.IdPelanggan?.toString() ?? null;
  } catch {
    return null;
  }
}

// ─── Baca data bulanan dari Redis flowin ──────────────────────────────────────
// Format kunci flowin: iot:{userId}:{meteranId}  → Redis List
// Setiap entry: JSON.stringify({ usedWater: <liter float>, ts: <epoch ms UTC> })
// Data masuk via: POST /iot/:userId/:meterId di flowin-recieve-iot
async function bacaDataRedis(meteranId: string, userId: string, periode: string) {
  const client = getRedisClient();
  if (!client) return null;

  const key = `iot:${userId}:${meteranId}`;
  let rawEntries: any[];
  try {
    rawEntries = await client.lrange(key, 0, -1);
  } catch {
    return null;
  }

  if (!rawEntries || rawEntries.length === 0) return null;

  // Parse semua entry (handle baik string maupun object yang sudah di-deserialize oleh Upstash client)
  const entries = rawEntries
    .map((e) => {
      try {
        const parsed = typeof e === 'string' ? JSON.parse(e) : e;
        if (parsed && typeof parsed.usedWater === 'number' && typeof parsed.ts === 'number') {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  // Filter entries yang termasuk dalam periode yang diminta (berdasarkan WIB)
  // Contoh: periode "2026-05" → WIB 2026-05-01 00:00 s/d 2026-05-31 23:59
  const [tahun, bulan] = periode.split('-').map(Number);
  // Awal bulan dalam WIB dinyatakan sebagai epoch UTC
  const startMs = Date.UTC(tahun, bulan - 1, 1) - TZ_OFFSET_MS;
  const endMs   = Date.UTC(tahun, bulan,     1) - TZ_OFFSET_MS; // exclusive

  const filtered = entries.filter((e) => e.ts >= startMs && e.ts < endMs);
  if (filtered.length === 0) return null;

  // Agregasi per hari (WIB)
  const dailyMap: Record<string, number> = {};
  for (const e of filtered) {
    // Tambah offset WIB agar UTC method mengembalikan waktu WIB yang benar
    const wibDate = new Date(e.ts + TZ_OFFSET_MS);
    const day = String(wibDate.getUTCDate()).padStart(2, '0');
    dailyMap[day] = (dailyMap[day] ?? 0) + e.usedWater;
  }

  const dataHarian = Object.entries(dailyMap)
    .map(([tanggal, liter]) => ({ tanggal, liter }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const totalPenggunaan = filtered.reduce((s, e) => s + e.usedWater, 0);

  // Entry terbaru dari seluruh buffer (ts terbesar) sebagai bacaan real-time terakhir
  const latestEntry = entries.reduce(
    (best: any, e: any) => (!best || e.ts > best.ts ? e : best),
    null
  );
  const latestReading: number | null = latestEntry ? latestEntry.usedWater : null;

  return { dataHarian, totalPenggunaan, latestReading };
}

// ─── Baca data bulanan dari MongoDB flowin (riwayatpenggunaans) ───────────────
// Schema flowin: { MeterID: String, UserID: String, PenggunaanAir: Number, timestamp: Date }
// Berbeda dari schema Aqualink RiwayatPenggunaan.ts, tapi koleksi sama → pakai .lean() agar field-nya tidak difilter schema
async function bacaDataMongo(meteranId: string, periode: string) {
  const [tahun, bulan] = periode.split('-').map(Number);
  // Gunakan epoch eksplisit supaya benar di server UTC (bukan local time)
  const startDate = new Date(Date.UTC(tahun, bulan - 1, 1) - TZ_OFFSET_MS);
  const endDate   = new Date(Date.UTC(tahun, bulan,     1) - TZ_OFFSET_MS); // exclusive

  const records = await RiwayatPenggunaan.find({
    MeterID: meteranId,
    timestamp: { $gte: startDate, $lt: endDate },
  }).lean() as any[];

  if (!records.length) return null;

  // Agregasi per hari (WIB)
  const dailyMap: Record<string, number> = {};
  for (const r of records) {
    const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : Number(r.timestamp);
    const wibDate = new Date(ts + TZ_OFFSET_MS);
    const day = String(wibDate.getUTCDate()).padStart(2, '0');
    dailyMap[day] = (dailyMap[day] ?? 0) + (r.PenggunaanAir ?? 0);
  }

  const dataHarian = Object.entries(dailyMap)
    .map(([tanggal, liter]) => ({ tanggal, liter }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const totalPenggunaan = records.reduce((s, r) => s + (r.PenggunaanAir ?? 0), 0);

  return { dataHarian, totalPenggunaan, latestReading: null as number | null };
}

// ─── Hitung estimasi biaya berdasarkan tarif kelompok ────────────────────────
function hitungEstimasiBiaya(pemakaian: number, kelompok: any) {
  const batas = kelompok?.BatasRendah ?? 10;
  const tarifR = kelompok?.TarifRendah ?? 1500;
  const tarifT = kelompok?.TarifTinggi ?? 2000;
  const beban = kelompok?.BiayaBeban ?? 5000;

  const biayaPemakaian = pemakaian <= batas
    ? pemakaian * tarifR
    : batas * tarifR + (pemakaian - batas) * tarifT;

  return {
    pemakaianBelumTerbayar: pemakaian,
    estimasiBiaya: biayaPemakaian,
    biayaBeban: beban,
    totalEstimasi: biayaPemakaian + beban,
    namaKelompok: kelompok?.NamaKelompok ?? null,
  };
}

// ─── Evaluasi kategori pemakaian ─────────────────────────────────────────────
function evaluasiPemakaian(totalLiter: number): { kategori: string; deskripsi: string } {
  if (totalLiter < 5000) return { kategori: 'Hemat', deskripsi: 'Pemakaian air sangat efisien' };
  if (totalLiter < 15000) return { kategori: 'Normal', deskripsi: 'Pemakaian air dalam batas wajar' };
  return { kategori: 'Boros', deskripsi: 'Pemakaian air melebihi rata-rata normal' };
}

// ─── Build chart 7-14 hari terakhir ──────────────────────────────────────────
function buildChartHarian(dataHarian: { tanggal: string; liter: number }[], maxDays = 14) {
  return dataHarian.slice(-maxDays);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVERS
// ─────────────────────────────────────────────────────────────────────────────
export const monitoringResolvers = {
  Query: {
    // ── Dashboard monitoring bulan berjalan ─────────────────────────────────
    // Flow data: Redis (iot:{userId}:{meteranId} List) → fallback MongoDB flowin
    getMonitoringDashboard: async (_, { meteranId, periode: periodeParam }, { token }: GraphQLContext) => {
      verifyAdminToken(token);

      // Jalankan lookup meteran + resolve userId secara paralel
      const [meteran, userId] = await Promise.all([
        Meteran.findById(meteranId).populate('IdKelompokPelanggan').lean() as any,
        getUserIdByMeteranId(meteranId),
      ]);

      if (!meteran) throw new Error('Meteran tidak ditemukan');

      const kelompok = meteran.IdKelompokPelanggan as any;
      const periode = periodeParam ?? periodeSekarang();
      const periodeLalu = periodeSebelumnya(periode);

      // Coba Redis flowin (butuh userId), paralel dengan MongoDB bulan lalu
      const [redisData, mongoDataLalu] = await Promise.all([
        userId ? bacaDataRedis(meteranId, userId, periode) : Promise.resolve(null),
        bacaDataMongo(meteranId, periodeLalu),
      ]);

      // Fallback ke MongoDB bulan ini jika Redis kosong (data sudah dimigrasi cron flowin)
      const mongoDataIni = redisData ? null : await bacaDataMongo(meteranId, periode);

      const bulanIniSource = redisData ?? mongoDataIni;
      const dataHarianIni = bulanIniSource?.dataHarian ?? [];
      const totalIni = bulanIniSource?.totalPenggunaan ?? 0;
      const latestReading = redisData?.latestReading ?? null;

      const dataHarianLalu = mongoDataLalu?.dataHarian ?? [];
      const totalLalu = mongoDataLalu?.totalPenggunaan ?? 0;

      // Prediksi akhir bulan
      const hariTercatat = dataHarianIni.length;
      const hariTotal = hariDalamBulan(periode);
      const hariSekarang = hariSekarangDalamBulan();
      const hariTersisa = Math.max(0, hariTotal - hariSekarang);
      const rataRataHarian = hariTercatat > 0 ? totalIni / hariTercatat : 0;
      const prediksiAkhirBulan = totalIni + rataRataHarian * hariTersisa;

      // Perbandingan bulan ini vs bulan lalu
      let perbandingan = null;
      if (totalLalu > 0) {
        const selisih = totalIni - totalLalu;
        const persentase = (selisih / totalLalu) * 100;
        perbandingan = {
          bulanIni: totalIni,
          bulanLalu: totalLalu,
          selisih,
          persentase: Math.abs(persentase),
          status: selisih > 0 ? 'naik' : selisih < 0 ? 'turun' : 'sama',
        };
      }

      // Estimasi biaya — pemakaianM3 = totalIni (liter) / 1000
      const pemakaianM3 = totalIni / 1000;
      const estimasiBiaya = hitungEstimasiBiaya(pemakaianM3, kelompok);

      return {
        meteranId,
        nomorMeteran: meteran.NomorMeteran,
        nomorAkun: meteran.NomorAkun,
        namaKelompok: kelompok?.NamaKelompok ?? null,
        bulanIni: {
          periode,
          totalPenggunaan: totalIni,
          dataHarian: dataHarianIni,
          sumberData: redisData ? 'redis' : 'mongodb',
        },
        bulanLalu: mongoDataLalu
          ? {
              periode: periodeLalu,
              totalPenggunaan: totalLalu,
              dataHarian: dataHarianLalu,
              sumberData: 'mongodb',
            }
          : null,
        prediksi: { rataRataHarian, prediksiAkhirBulan, hariTersisa, hariTercatat },
        perbandingan,
        evaluasi: evaluasiPemakaian(totalIni),
        estimasiBiayaBulanIni: estimasiBiaya,
        chartHarian: buildChartHarian(dataHarianIni),
        latestReading,
        lastUpdate: new Date().toISOString(),
        redisConnected: isRedisConnected(),
      };
    },

    // ── Histori pemakaian N bulan terakhir (dari MongoDB flowin) ────────────
    // Setiap bulan: agregasi record { MeterID, PenggunaanAir, timestamp } per hari WIB
    getMonitoringHistori: async (_, { meteranId, jumlahBulan = 6 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);

      const histori: any[] = [];
      const now = new Date();

      for (let i = 0; i < jumlahBulan; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const periode = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        const data = await bacaDataMongo(meteranId, periode);
        if (data && data.totalPenggunaan > 0) {
          histori.push({
            periode,
            totalPenggunaan: data.totalPenggunaan,
            dataHarian: data.dataHarian,
          });
        }
      }

      return histori;
    },

    // ── Data per jam untuk satu hari (drill-down harian) ────────────────────
    // Sumber utama: Redis flowin (iot:{userId}:{meteranId} List), filter per tanggal WIB
    // Fallback: MongoDB flowin jika Redis kosong (entry sudah dimigrasi cron harian)
    getMonitoringHarian: async (_, { meteranId, tanggal }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // tanggal format: YYYY-MM-DD

      const [year, month, day] = tanggal.split('-').map(Number);
      // Rentang waktu hari tersebut dalam WIB, dinyatakan sebagai epoch UTC
      const startMs = Date.UTC(year, month - 1, day, 0,  0,  0,   0) - TZ_OFFSET_MS;
      const endMs   = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - TZ_OFFSET_MS;

      let dataPerJam: { jam: string; liter: number }[] = [];

      // Coba Redis flowin terlebih dahulu
      const userId = await getUserIdByMeteranId(meteranId);
      if (userId) {
        const client = getRedisClient();
        if (client) {
          try {
            const key = `iot:${userId}:${meteranId}`;
            const rawEntries = await client.lrange(key, 0, -1);

            const entries = (rawEntries || [])
              .map((e) => {
                try {
                  const parsed = typeof e === 'string' ? JSON.parse(e) : e;
                  return parsed && typeof parsed.usedWater === 'number' && typeof parsed.ts === 'number'
                    ? parsed
                    : null;
                } catch {
                  return null;
                }
              })
              .filter(Boolean)
              .filter((e) => e.ts >= startMs && e.ts <= endMs);

            const hourlyMap: Record<string, number> = {};
            for (const e of entries) {
              const wibDate = new Date(e.ts + TZ_OFFSET_MS);
              const hour = String(wibDate.getUTCHours()).padStart(2, '0');
              hourlyMap[hour] = (hourlyMap[hour] ?? 0) + e.usedWater;
            }

            dataPerJam = Object.entries(hourlyMap)
              .map(([jam, liter]) => ({ jam, liter }))
              .sort((a, b) => a.jam.localeCompare(b.jam));
          } catch { /* lanjut ke fallback */ }
        }
      }

      // Fallback ke MongoDB flowin jika Redis kosong atau userId tidak ditemukan
      if (dataPerJam.length === 0) {
        const records = await RiwayatPenggunaan.find({
          MeterID: meteranId,
          timestamp: { $gte: new Date(startMs), $lte: new Date(endMs) },
        }).lean() as any[];

        const hourlyMap: Record<string, number> = {};
        for (const r of records) {
          const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : Number(r.timestamp);
          const wibDate = new Date(ts + TZ_OFFSET_MS);
          const hour = String(wibDate.getUTCHours()).padStart(2, '0');
          hourlyMap[hour] = (hourlyMap[hour] ?? 0) + (r.PenggunaanAir ?? 0);
        }

        dataPerJam = Object.entries(hourlyMap)
          .map(([jam, liter]) => ({ jam, liter }))
          .sort((a, b) => a.jam.localeCompare(b.jam));
      }

      const totalHari = dataPerJam.reduce((s, d) => s + d.liter, 0);

      return { tanggal, dataPerJam, totalHari };
    },
  },
};
