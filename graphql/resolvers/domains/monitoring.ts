import Meteran from '../../../models/Meteran.js';
import RiwayatPenggunaan from '../../../models/RiwayatPenggunaan.js';
import { verifyAdminToken } from '../helpers.js';
import { isRedisConnected, getRedisClient } from '../../../utils/redis.js';
import type { GraphQLContext } from '../../../types/index.js';

// â”€â”€â”€ Konstanta timezone WIB (UTC+7) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

// â”€â”€â”€ Nama bulan Indonesia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Resolve userId dari meteranId via Meteran â†’ IdKoneksiData â†’ IdPelanggan â”€â”€
// Kunci Redis flowin: iot:{userId}:{meteranId}
// Gunakan relasi ERD â€” bukan User.meteranId (legacy, sering null)
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

// â”€â”€â”€ Baca data bulanan dari Redis flowin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Format kunci flowin: iot:{userId}:{meteranId}  â†’ Redis List
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
  // Contoh: periode "2026-05" â†’ WIB 2026-05-01 00:00 s/d 2026-05-31 23:59
  const [tahun, bulan] = periode.split('-').map(Number);
  // Awal bulan dalam WIB dinyatakan sebagai epoch UTC
  const startMs = Date.UTC(tahun, bulan - 1, 1) - TZ_OFFSET_MS;
  const endMs   = Date.UTC(tahun, bulan,     1) - TZ_OFFSET_MS; // exclusive

  const filtered = entries.filter((e) => e.ts >= startMs && e.ts < endMs);
  if (filtered.length === 0) return null;

  // Agregasi per hari (WIB) — return tanggal lengkap YYYY-MM-DD
  const dailyMap: Record<string, number> = {};
  for (const e of filtered) {
    const wibDate = new Date(e.ts + TZ_OFFSET_MS);
    const year = wibDate.getUTCFullYear();
    const month = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(wibDate.getUTCDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${day}`;
    dailyMap[fullDate] = (dailyMap[fullDate] ?? 0) + e.usedWater;
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

// â”€â”€â”€ Baca data bulanan dari MongoDB flowin (riwayatpenggunaans) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Schema flowin: { MeterID: String, UserID: String, PenggunaanAir: Number, timestamp: Date }
// Berbeda dari schema Aqualink RiwayatPenggunaan.ts, tapi koleksi sama â†’ pakai .lean() agar field-nya tidak difilter schema
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

  // Agregasi per hari (WIB) — return tanggal lengkap YYYY-MM-DD
  const dailyMap: Record<string, number> = {};
  for (const r of records) {
    const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : Number(r.timestamp);
    const wibDate = new Date(ts + TZ_OFFSET_MS);
    const year = wibDate.getUTCFullYear();
    const month = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(wibDate.getUTCDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${day}`;
    dailyMap[fullDate] = (dailyMap[fullDate] ?? 0) + (r.PenggunaanAir ?? 0);
  }

  const dataHarian = Object.entries(dailyMap)
    .map(([tanggal, liter]) => ({ tanggal, liter }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const totalPenggunaan = records.reduce((s, r) => s + (r.PenggunaanAir ?? 0), 0);

  return { dataHarian, totalPenggunaan, latestReading: null as number | null };
}

// â”€â”€â”€ Read-through cache: HistoryUsage â†’ Redis â†’ serve (Opsi A) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Urutan: Redis cache â†’ HistoryUsage aggregate (MongoDB) â†’ RiwayatPenggunaan (fallback flowin)
const CACHE_TTL_SEC = 7 * 24 * 3600; // 7 hari

async function bacaDataHistoris(meteranId: string, periode: string) {
  const cacheKey = `monitoring:agg:${meteranId}:${periode}`;
  const client = isRedisConnected() ? getRedisClient() : null;

  // 1. Cek Redis cache aggregate bulanan
  if (client) {
    try {
      const cached = await client.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached as string);
        return { ...parsed, sumberData: 'redis-cache' };
      }
    } catch { /* lanjut ke MongoDB */ }
  }

  // 2. Query daily aggregate docs (field: tanggal) dari riwayatpenggunaans
  // String YYYY-MM-DD terurut leksikografis — range query aman tanpa konversi Date
  const [tahun, bulan] = periode.split("-").map(Number);
  const startTanggal = tahun + "-" + String(bulan).padStart(2, "0") + "-01";
  const nextBulan    = bulan === 12
    ? (tahun + 1) + "-01"
    : tahun + "-" + String(bulan + 1).padStart(2, "0");

  const harianDocs = await RiwayatPenggunaan.find({
    MeterID: meteranId,
    tanggal: { $gte: startTanggal, $lt: nextBulan },
  }).lean() as any[];

  if (harianDocs.length > 0) {
    const dataHarian = harianDocs
      .map((d: any) => ({ tanggal: d.tanggal, liter: d.totalPenggunaan ?? 0 }))
      .sort((a: any, b: any) => a.tanggal.localeCompare(b.tanggal));
    const totalPenggunaan = harianDocs.reduce((s: number, d: any) => s + (d.totalPenggunaan ?? 0), 0);
    const result = { dataHarian, totalPenggunaan, latestReading: null as number | null };

    if (client) {
      try {
        await client.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL_SEC });
      } catch { /* Redis write non-critical */ }
    }
    return result;
  }

  // 3. Fallback ke raw records flowin (field: timestamp) jika aggregate belum ada
  return bacaDataMongo(meteranId, periode);
}

// â”€â”€â”€ Hitung estimasi biaya berdasarkan tarif kelompok â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function hitungEstimasiBiaya(pemakaian: number, kelompok: any) {
  const batas = kelompok?.BatasRendah ?? 10;
  const tarifR = kelompok?.TarifRendah ?? 1500;
  const tarifT = kelompok?.TarifTinggi ?? 2000;
  const beban = kelompok?.BiayaBeban ?? 5000;

  const biayaPemakaian = pemakaian <= batas
    ? pemakaian * tarifR
    : pemakaian * tarifT;

  return {
    pemakaianBelumTerbayar: pemakaian,
    estimasiBiaya: biayaPemakaian,
    biayaBeban: beban,
    totalEstimasi: biayaPemakaian + beban,
    namaKelompok: kelompok?.NamaKelompok ?? null,
  };
}

// â”€â”€â”€ Evaluasi kategori pemakaian â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function evaluasiPemakaian(totalLiter: number): { kategori: string; deskripsi: string } {
  if (totalLiter < 5000) return { kategori: 'Hemat', deskripsi: 'Pemakaian air sangat efisien' };
  if (totalLiter < 15000) return { kategori: 'Normal', deskripsi: 'Pemakaian air dalam batas wajar' };
  return { kategori: 'Boros', deskripsi: 'Pemakaian air melebihi rata-rata normal' };
}

// â”€â”€â”€ Build chart 7-14 hari terakhir â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildChartHarian(dataHarian: { tanggal: string; liter: number }[], maxDays = 14) {
  return dataHarian.slice(-maxDays);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RESOLVERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const monitoringResolvers = {
  Query: {
    // â”€â”€ Dashboard monitoring bulan berjalan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Flow data: Redis (iot:{userId}:{meteranId} List) â†’ fallback MongoDB flowin
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

      // Coba Redis flowin (butuh userId), paralel dengan data historis bulan lalu
      const [redisData, dataLalu] = await Promise.all([
        userId ? bacaDataRedis(meteranId, userId, periode) : Promise.resolve(null),
        bacaDataHistoris(meteranId, periodeLalu).catch(() => null),
      ]);

      // Fallback ke historis bulan ini jika Redis kosong (data sudah lewat 7 hari)
      const mongoDataIni = redisData ? null : await bacaDataHistoris(meteranId, periode);

      const bulanIniSource = redisData ?? mongoDataIni;
      const dataHarianIni = bulanIniSource?.dataHarian ?? [];
      const totalIni = bulanIniSource?.totalPenggunaan ?? 0;
      const latestReading = redisData?.latestReading ?? null;

      const dataHarianLalu = dataLalu?.dataHarian ?? [];
      const totalLalu = dataLalu?.totalPenggunaan ?? 0;

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

      // Estimasi biaya â€” pemakaianM3 = totalIni (liter) / 1000
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
        bulanLalu: dataLalu
          ? {
              periode: periodeLalu,
              totalPenggunaan: totalLalu,
              dataHarian: dataHarianLalu,
              sumberData: (dataLalu as any)?.sumberData ?? 'mongodb',
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

    // â”€â”€ Histori pemakaian N bulan terakhir (dari MongoDB flowin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Setiap bulan: agregasi record { MeterID, PenggunaanAir, timestamp } per hari WIB
    getMonitoringHistori: async (_, { meteranId, jumlahBulan = 6 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);

      const now = new Date();
      const periodes = Array.from({ length: Math.min(jumlahBulan, 24) }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });

      const results = await Promise.all(
        periodes.map(periode =>
          bacaDataHistoris(meteranId, periode)
            .then(data => data && data.totalPenggunaan > 0
              ? { periode, totalPenggunaan: data.totalPenggunaan, dataHarian: data.dataHarian }
              : null
            )
            .catch(() => null)
        )
      );

      return results.filter(Boolean);
    },

    // â”€â”€ Data per jam untuk satu hari (drill-down harian) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      // Fallback ke daily aggregate doc (field: perJam) jika Redis kosong
      if (dataPerJam.length === 0) {
        const harianDoc = await RiwayatPenggunaan.findOne({
          MeterID: meteranId,
          tanggal,
        }).lean() as any;

        if (harianDoc?.perJam) {
          const perJamObj = harianDoc.perJam instanceof Map
            ? Object.fromEntries(harianDoc.perJam)
            : harianDoc.perJam;
          dataPerJam = Object.entries(perJamObj as Record<string, number>)
            .map(([jam, liter]) => ({ jam, liter: liter as number }))
            .sort((a, b) => a.jam.localeCompare(b.jam));
        }
      }

      const totalHari = dataPerJam.reduce((s, d) => s + d.liter, 0);

      return { tanggal, dataPerJam, totalHari };
    },
  },
};
