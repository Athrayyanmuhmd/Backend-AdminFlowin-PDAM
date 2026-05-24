import cron from 'node-cron';
import Billing from '../models/Billing.js';
import Meteran from '../models/Meteran.js';
import RiwayatPenggunaan from '../models/RiwayatPenggunaan.js';
import Notification from '../models/Notification.js';
import AdminAccount from '../models/AdminAccount.js';
import logger from './logger.js';
import { getRedisClient, isRedisConnected } from './redis.js';

// ─── Helper: format periode "YYYY-MM" ─────────────────────────────────────────

const formatPeriode = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// ─── Helper: hitung tarif air ─────────────────────────────────────────────────

const calculateWaterBill = (totalPemakaian: number, kelompok: any) => {
  const tarifRendah = kelompok?.TarifRendah ?? 1500;
  const tarifTinggi = kelompok?.TarifTinggi ?? 2000;
  const batasRendah = kelompok?.BatasRendah ?? 10;
  const biaya = totalPemakaian <= batasRendah
    ? totalPemakaian * tarifRendah
    : totalPemakaian * tarifTinggi;
  const biayaBeban = kelompok?.BiayaBeban ?? 5000;
  return { biaya, biayaBeban, totalBiaya: biaya + biayaBeban };
};

const getDueDate = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 25);
};

// ─── Cron 1: Generate tagihan bulanan (1 tiap bulan, 00:01) ───────────────────

export const runBillingJob = async (): Promise<void> => {
  logger.info('Running monthly billing generation...');
  try {
      const now      = new Date();
      const periode  = formatPeriode(now); // "YYYY-MM"

      // Populate IdKelompokPelanggan + IdKoneksiData → IdPelanggan (untuk userId Billing)
      const meterans = await Meteran.find({ statusAktif: true })
        .populate('IdKelompokPelanggan')
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan' } })
        .lean();

      let successCount = 0;
      let failedCount  = 0;

      for (const meteran of meterans) {
        try {
          const koneksiData = (meteran as any).IdKoneksiData;
          const userId      = koneksiData?.IdPelanggan?._id ?? null;

          // Sync pemakaianBelumTerbayar dari tagihan settlement yang belum di-apply
          const settledUnaccounted = await Billing.find({
            IdMeteran: meteran._id,
            StatusPembayaran: 'settlement',
            Catatan: { $not: /\[pemakaian_applied\]/ },
          }).select('TotalPemakaian Catatan').lean();

          if (settledUnaccounted.length > 0) {
            const toDecrement = settledUnaccounted.reduce(
              (sum: number, t: any) => sum + (t.TotalPemakaian ?? 0), 0
            );
            if (toDecrement > 0) {
              await Meteran.findByIdAndUpdate(meteran._id, [{
                $set: {
                  pemakaianBelumTerbayar: {
                    $max: [0, { $subtract: ['$pemakaianBelumTerbayar', toDecrement] }],
                  },
                },
              }]);
              await Billing.updateMany(
                { _id: { $in: settledUnaccounted.map((t: any) => t._id) } },
                [{ $set: { Catatan: {
                  $cond: [
                    { $or: [{ $eq: ['$Catatan', null] }, { $eq: ['$Catatan', ''] }] },
                    '[pemakaian_applied]',
                    { $concat: ['$Catatan', ' [pemakaian_applied]'] },
                  ],
                }}}]
              );
              (meteran as any).pemakaianBelumTerbayar = Math.max(
                0, ((meteran as any).pemakaianBelumTerbayar ?? 0) - toDecrement
              );
              logger.info(
                { NomorMeteran: (meteran as any).NomorMeteran, toDecrement },
                'Synced pemakaianBelumTerbayar from settled tagihans'
              );
            }
          }

          // Idempotency guard: skip jika billing periode ini sudah ada (cron restart protection)
          const periodeExisting = await Billing.findOne({
            IdMeteran: meteran._id,
            Periode: periode,
            jenisBilling: { $ne: 'denda' },
          }).select('_id').lean();
          if (periodeExisting) {
            logger.info({ NomorMeteran: (meteran as any).NomorMeteran, periode }, 'Billing periode ini sudah ada, skip');
            continue;
          }

          const pemakaian = (meteran as any).pemakaianBelumTerbayar ?? 0;
          if (pemakaian === 0) {
            logger.info({ NomorMeteran: (meteran as any).NomorMeteran }, 'No usage to bill, skipping');
            continue;
          }

          const totalPemakaian    = (meteran as any).totalPemakaian ?? 0;
          const tenggatWaktu      = getDueDate();
          const { biaya, biayaBeban, totalBiaya } = calculateWaterBill(
            pemakaian,
            (meteran as any).IdKelompokPelanggan
          );

          // Cek apakah sudah ada billing pending untuk meteran ini
          const pendingBilling = await Billing.findOne({
            IdMeteran: meteran._id,
            StatusPembayaran: 'pending',
            jenisBilling: { $ne: 'denda' },
          });

          if (pendingBilling) {
            // Akumulasi ke billing pending yang ada — user tetap 1 tagihan
            const bulanBaru = (pendingBilling.bulanCakupan ?? 1) + 1;
            const [periodeY, periodeM] = (pendingBilling.Periode as string).split('-').map(Number);
            const endIdx = periodeY * 12 + (periodeM - 1) + bulanBaru - 1;
            const endYear = Math.floor(endIdx / 12);
            const endMonth = (endIdx % 12) + 1;
            const periodeAkhirBaru = `${endYear}-${String(endMonth).padStart(2, '0')}`;

            await Billing.findByIdAndUpdate(pendingBilling._id, {
              $inc: {
                TotalPemakaian: pemakaian,
                Biaya: biaya,
                BiayaBeban: biayaBeban,
                TotalBiaya: totalBiaya,
                bulanCakupan: 1,
              },
              $set: {
                PenggunaanSekarang: totalPemakaian,
                TenggatWaktu: tenggatWaktu,
                Menunggak: true,
                PeriodeAkhir: periodeAkhirBaru,
                // Invalidasi Snap lama karena nominal berubah
                MidtransOrderId: null,
                SnapToken: null,
                SnapRedirectUrl: null,
              },
            });

            if (userId) {
              await Notification.create({
                IdPelanggan: userId,
                Judul: 'Tagihan Air Diperbarui',
                Pesan: `Tagihan bulan ${periode} (${pemakaian} m³, Rp${totalBiaya.toLocaleString('id-ID')}) ditambahkan ke tagihan yang ada. Total yang harus dibayar sekarang: Rp${((pendingBilling.TotalBiaya ?? 0) + totalBiaya).toLocaleString('id-ID')}.`,
                Kategori: 'PEMBAYARAN',
                Link: '/pembayaran',
                isRead: false,
              }).catch((e: any) => logger.error({ err: e }, 'Gagal kirim notifikasi akumulasi billing'));
            }

            logger.info({ NomorMeteran: (meteran as any).NomorMeteran, periode }, 'Billing accumulated to existing pending');
            successCount++;
          } else {
            // Tidak ada pending — buat billing baru
            const penggunaanSebelum = Math.max(0, totalPemakaian - pemakaian);
            const billing = new Billing({
              userId,
              IdMeteran: meteran._id,
              Periode: periode,
              PeriodeAkhir: periode,
              PenggunaanSebelum: penggunaanSebelum,
              PenggunaanSekarang: totalPemakaian,
              TotalPemakaian: pemakaian,
              Biaya: biaya,
              BiayaBeban: biayaBeban,
              TotalBiaya: totalBiaya,
              StatusPembayaran: 'pending',
              TenggatWaktu: tenggatWaktu,
              Menunggak: false,
              Denda: 0,
              bulanCakupan: 1,
            });
            await billing.save();

            if (userId) {
              await Notification.create({
                IdPelanggan: userId,
                Judul: 'Tagihan Air Baru',
                Pesan: `Tagihan air sebesar Rp${totalBiaya.toLocaleString('id-ID')} untuk periode ${periode}. Total pemakaian: ${pemakaian} m³. Jatuh tempo: ${tenggatWaktu.toLocaleDateString('id-ID')}`,
                Kategori: 'PEMBAYARAN',
                Link: '/pembayaran',
                isRead: false,
              }).catch((e: any) => logger.error({ err: e }, 'Gagal kirim notifikasi billing baru'));
            }

            logger.info({ NomorMeteran: (meteran as any).NomorMeteran, totalBiaya }, 'Billing created');
            successCount++;
          }
        } catch (error: any) {
          logger.error({ err: error, NomorMeteran: (meteran as any).NomorMeteran }, 'Gagal generate billing');
          failedCount++;
        }
      }

      logger.info({ successCount, failedCount }, 'Monthly billing generation completed');

      // ── Phase 2: Deteksi user yang menunggak ≥3 bulan → notifikasi pemutusan ─
      await deteksiTunggakanPemutusan();

  } catch (error) {
    logger.error({ err: error }, 'Error in billing cron job');
  }
};

export const setupBillingCron = (): void => {
  cron.schedule('1 0 1 * *', runBillingJob);
  logger.info('Billing cron scheduled: 1st of every month at 00:01');
};

// ─── Helper: Deteksi user tunggakan ≥3 bulan → notifikasi pemutusan ──────────
// Dengan model akumulasi: 1 billing pending bisa mencakup banyak bulan (bulanCakupan)

const deteksiTunggakanPemutusan = async (): Promise<void> => {
  logger.info('Running tunggakan detection...');
  try {
    // Cari billing pending dengan bulanCakupan >= 3 (model akumulasi)
    const eligibleBillings = await Billing.find({
      StatusPembayaran: 'pending',
      jenisBilling: { $ne: 'denda' },
      userId: { $ne: null },
      bulanCakupan: { $gte: 3 },
    }).select('userId bulanCakupan').lean();

    const userIds = [...new Set(eligibleBillings.map((b: any) => b.userId?.toString()).filter(Boolean))];
    let notifCount = 0;

    for (const userId of userIds) {
      if (!userId) continue;

      const pendingBilling = eligibleBillings.find((b: any) => b.userId?.toString() === userId);
      const pendingCount = pendingBilling?.bulanCakupan ?? 3;

      if (pendingCount < 3) continue;

      // Tandai semua pending sebagai Menunggak: true
      await Billing.updateMany(
        { userId, StatusPembayaran: 'pending' },
        { $set: { Menunggak: true } }
      );

      // Notifikasi ke semua admin untuk pemutusan — dedup: skip jika sudah ada notif
      // belum-dibaca dengan judul yang sama untuk pelanggan ini (cegah spam tiap bulan)
      const sudahAdaNotif = await Notification.findOne({
        Judul: 'Pelanggan Perlu Pemutusan',
        Pesan: { $regex: userId },
        isRead: false,
      }).select('_id').lean();
      if (!sudahAdaNotif) {
        const admins = await AdminAccount.find({}, '_id').lean();
        if (admins.length > 0) {
          const adminNotifs = admins.map((admin: any) => ({
            IdAdmin: admin._id,
            Judul: 'Pelanggan Perlu Pemutusan',
            Pesan: `Pelanggan ID ${userId} menunggak ${pendingCount} bulan. Tagihan dapat dibayar sekaligus via 1 transaksi. Silakan lakukan pemutusan.`,
            Kategori: 'PERINGATAN',
            Link: '/billing/pemutusan',
            isRead: false,
          }));
          await Notification.insertMany(adminNotifs, { ordered: false }).catch((e: any) =>
            logger.error({ err: e }, 'Gagal kirim notifikasi pemutusan ke admin')
          );
          notifCount++;
        }
      }
    }

    logger.info({ notifCount }, 'Tunggakan detection completed');
  } catch (error) {
    logger.error({ err: error }, 'Error in tunggakan detection');
  }
};

// ─── Cron 2: Tandai tagihan overdue (tiap hari 00:05) ─────────────────────────

export const runOverdueJob = async (): Promise<void> => {
  logger.info('Running overdue billing check...');
  try {
      const now = new Date();

      const overdueResult = await Billing.updateMany(
        { StatusPembayaran: 'pending', TenggatWaktu: { $lt: now }, Menunggak: false },
        { $set: { Menunggak: true } }
      );
      const updatedCount = overdueResult.modifiedCount;

      if (updatedCount > 0) {
        const overdueBillings = await Billing.find({
          StatusPembayaran: 'pending',
          Menunggak: true,
          TenggatWaktu: { $lt: now },
          updatedAt: { $gte: new Date(Date.now() - 60_000) },
        }).select('userId Periode').lean();

        if (overdueBillings.length > 0) {
          const notifs = overdueBillings.map((b: any) => ({
            IdPelanggan: b.userId,
            Judul: 'Tagihan Terlambat',
            Pesan: `Tagihan air periode ${b.Periode} telah melewati jatuh tempo. Segera lakukan pembayaran.`,
            Kategori: 'PERINGATAN',
            Link: '/pembayaran',
            isRead: false,
          }));
          await Notification.insertMany(notifs, { ordered: false }).catch((e: any) =>
            logger.error({ err: e }, 'Gagal kirim notifikasi overdue')
          );
        }
      }

    logger.info({ updatedCount }, 'Overdue check completed');
  } catch (error) {
    logger.error({ err: error }, 'Error in overdue cron job');
  }
};

export const setupOverdueCron = (): void => {
  cron.schedule('5 0 * * *', runOverdueJob);
  logger.info('Overdue cron scheduled: daily at 00:05');
};

// ─── Cron 3: Reminder 3 hari sebelum jatuh tempo (tiap hari 08:00) ────────────

export const runReminderJob = async (): Promise<void> => {
  logger.info('Running billing reminder check...');
  try {
      const now            = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const upcomingBillings = await Billing.find({
        StatusPembayaran: 'pending',
        TenggatWaktu: { $gte: now, $lte: threeDaysLater },
      }).lean();

      let reminderCount = 0;

      for (const billing of upcomingBillings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const userId = (billing as any).userId;
        if (!userId) continue;

        const existingReminder = await Notification.findOne({
          IdPelanggan: userId,
          Judul: 'Pengingat Jatuh Tempo',
          createdAt: { $gte: today },
        });

        if (!existingReminder) {
          const tenggatWaktu = (billing as any).TenggatWaktu;
          const daysUntilDue = Math.ceil(
            (new Date(tenggatWaktu).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          await Notification.create({
            IdPelanggan: userId,
            Judul: 'Pengingat Jatuh Tempo',
            Pesan: `Tagihan air sebesar Rp${((billing as any).TotalBiaya || 0).toLocaleString('id-ID')} akan jatuh tempo dalam ${daysUntilDue} hari (${new Date(tenggatWaktu).toLocaleDateString('id-ID')}). Segera lakukan pembayaran.`,
            Kategori: 'INFORMASI',
            Link: '/pembayaran',
            isRead: false,
          }).catch((e: any) => logger.error({ err: e }, 'Gagal kirim notifikasi reminder'));

          reminderCount++;
        }
      }

    logger.info({ reminderCount }, 'Reminder check completed');
  } catch (error) {
    logger.error({ err: error }, 'Error in reminder cron job');
  }
};

export const setupReminderCron = (): void => {
  cron.schedule('0 8 * * *', runReminderJob);
  logger.info('Reminder cron scheduled: daily at 08:00');
};

// ─── Cron 4: Sync IoT Redis → Meteran.pemakaianBelumTerbayar (tiap jam) ───────
// flowin-recieve-iot menulis ke Redis iot:{userId}:{meterId} tanpa update Meteran.
// Cron ini menjadi jembatan: baca entries baru dari Redis sejak lastIotSyncAt,
// lalu atomic $inc pemakaianBelumTerbayar + totalPemakaian di Meteran.
// usedWater dari flowin-recieve-iot = liter → dibagi 1000 untuk m³.

export const runIotSyncJob = async (): Promise<void> => {
  logger.info('Running IoT sync cron...');

  if (!isRedisConnected()) {
    logger.warn('IoT sync skipped — Redis tidak terhubung');
    return;
  }

    const client = getRedisClient();
    if (!client) return;

    try {
      // Populate IdKoneksiData → IdPelanggan untuk dapat userId (kunci Redis)
      const meterans = await Meteran.find({ statusAktif: true })
        .populate({ path: 'IdKoneksiData', select: 'IdPelanggan' })
        .select('_id NomorMeteran IdKoneksiData pemakaianBelumTerbayar lastIotSyncAt')
        .lean();

      let syncCount = 0;
      let skipCount = 0;

      for (const meteran of meterans) {
        try {
          const userId = (meteran as any).IdKoneksiData?.IdPelanggan?.toString();
          if (!userId) { skipCount++; continue; }

          const key = `iot:${userId}:${meteran._id}`;

          let rawEntries: any[];
          try {
            rawEntries = await client.lrange(key, 0, -1);
          } catch {
            skipCount++;
            continue;
          }

          if (!rawEntries || rawEntries.length === 0) { skipCount++; continue; }

          // Watermark: hanya proses entries yang masuk setelah sync terakhir
          const lastSync = (meteran as any).lastIotSyncAt
            ? new Date((meteran as any).lastIotSyncAt).getTime()
            : 0;

          const newEntries = rawEntries
            .map((e: any) => {
              try {
                const parsed = typeof e === 'string' ? JSON.parse(e) : e;
                return parsed &&
                  typeof parsed.usedWater === 'number' &&
                  typeof parsed.ts === 'number'
                  ? parsed
                  : null;
              } catch { return null; }
            })
            .filter(Boolean)
            .filter((e: any) => e.ts > lastSync);

          if (newEntries.length === 0) { skipCount++; continue; }

          // usedWater dari flowin-recieve-iot = liter → konversi ke m³
          const totalLiter = newEntries.reduce((sum: number, e: any) => sum + e.usedWater, 0);
          const totalM3 = totalLiter / 1000;

          if (totalM3 <= 0) { skipCount++; continue; }

          // ─── Persist ke riwayatpenggunaans: upsert daily aggregate (1 doc/hari) ──
          // Kelompokkan entries berdasarkan tanggal WIB, lalu $inc ke daily aggregate.
          // Unique index { MeterID, tanggal } menjamin tidak ada duplikasi.
          const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
          const dailyMap: Record<string, { total: number; perJam: Record<string, number> }> = {};

          for (const e of newEntries) {
            const wibDate = new Date(e.ts + TZ_OFFSET_MS);
            const tanggal = [
              wibDate.getUTCFullYear(),
              String(wibDate.getUTCMonth() + 1).padStart(2, '0'),
              String(wibDate.getUTCDate()).padStart(2, '0'),
            ].join('-');
            const jam = String(wibDate.getUTCHours()).padStart(2, '0');
            if (!dailyMap[tanggal]) dailyMap[tanggal] = { total: 0, perJam: {} };
            dailyMap[tanggal].total += e.usedWater; // liter
            dailyMap[tanggal].perJam[jam] = (dailyMap[tanggal].perJam[jam] ?? 0) + e.usedWater;
          }

          for (const [tanggal, data] of Object.entries(dailyMap)) {
            const incUpdate: Record<string, number> = { totalPenggunaan: data.total };
            for (const [jam, liter] of Object.entries(data.perJam)) {
              incUpdate[`perJam.${jam}`] = liter;
            }
            await RiwayatPenggunaan.findOneAndUpdate(
              { MeterID: meteran._id.toString(), tanggal },
              {
                $setOnInsert: { UserID: userId },
                $inc: incUpdate as any,
                $set: { lastSyncAt: new Date() },
              },
              { upsert: true }
            );
          }

          await Meteran.findByIdAndUpdate(meteran._id, {
            $inc: {
              pemakaianBelumTerbayar: totalM3,
              totalPemakaian: totalM3,
            },
            $set: { lastIotSyncAt: new Date() },
          });

          logger.info(
            { NomorMeteran: (meteran as any).NomorMeteran, totalM3: totalM3.toFixed(4), newEntries: newEntries.length },
            'IoT sync: pemakaianBelumTerbayar updated'
          );
          syncCount++;
        } catch (err: any) {
          logger.error({ err, meteranId: meteran._id }, 'IoT sync error pada meteran');
          skipCount++;
        }
      }

      logger.info({ syncCount, skipCount, total: meterans.length }, 'IoT sync cron completed');
    } catch (err) {
      logger.error({ err }, 'IoT sync cron error');
    }
};

export const setupIotSyncCron = (): void => {
  cron.schedule('0 * * * *', runIotSyncJob);
  logger.info('IoT sync cron scheduled: every hour at :00');
};
