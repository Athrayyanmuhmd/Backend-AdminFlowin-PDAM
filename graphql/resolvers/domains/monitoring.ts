// @ts-nocheck
import Meteran from '../../../models/Meteran.js';
import RiwayatPenggunaan from '../../../models/RiwayatPenggunaan.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import { verifyAdminToken } from '../helpers.js';
import { hgetallCache, getRawCache, isRedisConnected } from '../../../utils/redis.js';
import type { GraphQLContext } from '../../../types/index.js';

// Nama bulan Indonesia
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

// ─── Baca data bulanan dari Redis Ahmad ──────────────────────────────────────
// Kunci: usage:{meteranId}:{YYYY-MM}:daily   → Hash { "01": "245.3", ... }
// Kunci: usage:{meteranId}:{YYYY-MM}:total   → String "5234.7"
// Kunci: usage:{meteranId}:latest            → JSON { volume, timestamp }
async function bacaDataRedis(meteranId: string, periode: string) {
  const dailyKey = `usage:${meteranId}:${periode}:daily`;
  const totalKey = `usage:${meteranId}:${periode}:total`;
  const latestKey = `usage:${meteranId}:latest`;

  const [dailyHash, totalStr, latestRaw] = await Promise.all([
    hgetallCache(dailyKey),
    getRawCache(totalKey),
    getRawCache(latestKey),
  ]);

  if (!dailyHash && !totalStr) return null;

  // Konversi hash { "01": "245.3" } → { tanggal, liter }[]
  const dataHarian = dailyHash
    ? Object.entries(dailyHash)
        .map(([tanggal, val]) => ({ tanggal, liter: parseFloat(String(val)) || 0 }))
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    : [];

  const totalPenggunaan = totalStr
    ? parseFloat(totalStr) || 0
    : dataHarian.reduce((s, d) => s + d.liter, 0);

  let latestReading: number | null = null;
  if (latestRaw) {
    try {
      const parsed = typeof latestRaw === 'string' ? JSON.parse(latestRaw) : latestRaw;
      latestReading = typeof parsed === 'number' ? parsed : (parsed?.volume ?? null);
    } catch { /* ignore */ }
  }

  return { dataHarian, totalPenggunaan, latestReading };
}

// ─── Baca data bulanan dari MongoDB Ahmad (RiwayatPenggunaan) ────────────────
async function bacaDataMongo(meteranId: string, periode: string) {
  const record = await RiwayatPenggunaan.findOne({ MeteranId: meteranId, Periode: periode }).lean() as any;
  if (!record) return null;

  const dataHarian = record.DataHarian
    ? Object.entries(record.DataHarian).map(([tanggal, liter]) => ({
        tanggal,
        liter: typeof liter === 'number' ? liter : parseFloat(String(liter)) || 0,
      })).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    : [];

  return {
    dataHarian,
    totalPenggunaan: record.TotalPenggunaan ?? dataHarian.reduce((s, d) => s + d.liter, 0),
    latestReading: null as number | null,
  };
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
    getMonitoringDashboard: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);

      const meteran = await Meteran.findById(meteranId).populate('IdKelompokPelanggan').lean() as any;
      if (!meteran) throw new Error('Meteran tidak ditemukan');

      const kelompok = meteran.IdKelompokPelanggan as any;
      const periode = periodeSekarang();
      const periodeLalu = periodeSebelumnya(periode);

      // Coba Redis dulu, fall back ke MongoDB
      const [redisData, mongoDataLalu] = await Promise.all([
        bacaDataRedis(meteranId, periode),
        bacaDataMongo(meteranId, periodeLalu),
      ]);

      // Kalau Redis kosong, coba MongoDB untuk bulan ini
      const mongoDataIni = redisData ? null : await bacaDataMongo(meteranId, periode);

      const bulanIniSource = redisData ?? mongoDataIni;
      const dataHarianIni = bulanIniSource?.dataHarian ?? [];
      const totalIni = bulanIniSource?.totalPenggunaan ?? 0;
      const latestReading = redisData?.latestReading ?? null;

      const dataHarianLalu = mongoDataLalu?.dataHarian ?? [];
      const totalLalu = mongoDataLalu?.totalPenggunaan ?? 0;

      // Prediksi
      const hariTercatat = dataHarianIni.length;
      const hariTotal = hariDalamBulan(periode);
      const hariSekarang = hariSekarangDalamBulan();
      const hariTersisa = Math.max(0, hariTotal - hariSekarang);
      const rataRataHarian = hariTercatat > 0 ? totalIni / hariTercatat : 0;
      const prediksiAkhirBulan = totalIni + rataRataHarian * hariTersisa;

      // Perbandingan
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

      // Estimasi biaya berdasarkan pemakaian bulan ini (m³ = liter / 1000)
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

    getMonitoringHistori: async (_, { meteranId, jumlahBulan = 6 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);

      const records = await RiwayatPenggunaan.find({ MeteranId: meteranId })
        .sort({ Periode: -1 })
        .limit(jumlahBulan)
        .lean() as any[];

      return records.map((r) => {
        const dataHarian = r.DataHarian
          ? Object.entries(r.DataHarian).map(([tanggal, liter]) => ({
              tanggal,
              liter: typeof liter === 'number' ? liter : parseFloat(String(liter)) || 0,
            })).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
          : [];

        return {
          periode: r.Periode,
          totalPenggunaan: r.TotalPenggunaan ?? 0,
          dataHarian,
        };
      });
    },

    getMonitoringHarian: async (_, { meteranId, tanggal }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // tanggal format: YYYY-MM-DD
      const hourlyKey = `usage:${meteranId}:${tanggal}:hourly`;
      const hourlyHash = await hgetallCache(hourlyKey);

      const dataPerJam = hourlyHash
        ? Object.entries(hourlyHash)
            .map(([jam, val]) => ({ jam: jam.padStart(2, '0'), liter: parseFloat(String(val)) || 0 }))
            .sort((a, b) => a.jam.localeCompare(b.jam))
        : [];

      const totalHari = dataPerJam.reduce((s, d) => s + d.liter, 0);

      return { tanggal, dataPerJam, totalHari };
    },
  },
};
