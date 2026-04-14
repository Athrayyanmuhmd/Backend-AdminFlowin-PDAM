import cron from 'node-cron';
import Billing from '../models/Billing.js';
import Meteran from '../models/Meteran.js';
import Notification from '../models/Notification.js';
import AdminAccount from '../models/AdminAccount.js';
import logger from './logger.js';

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
    : batasRendah * tarifRendah + (totalPemakaian - batasRendah) * tarifTinggi;
  const biayaBeban = kelompok?.BiayaBeban ?? 5000;
  return { biaya, biayaBeban, totalBiaya: biaya + biayaBeban };
};

const getDueDate = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 25);
};

// ─── Cron 1: Generate tagihan bulanan (1 tiap bulan, 00:01) ───────────────────

export const setupBillingCron = (): void => {
  cron.schedule('1 0 1 * *', async () => {
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

          // Skip jika billing periode ini sudah ada
          const existingBilling = await Billing.findOne({
            IdMeteran: meteran._id,
            Periode: periode,
          });
          if (existingBilling) {
            logger.info({ NomorMeteran: (meteran as any).NomorMeteran }, 'Billing already exists, skipping');
            continue;
          }

          // Sync pemakaianBelumTerbayar: kurangi untuk tagihan yang sudah di-settle
          // (kemungkinan dibayar Ahmad tanpa decrement field ini)
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
              await Meteran.findByIdAndUpdate(meteran._id, {
                $inc: { pemakaianBelumTerbayar: -toDecrement },
              });
              // Tandai sudah di-sync agar tidak double-decrement
              await Billing.updateMany(
                { _id: { $in: settledUnaccounted.map((t: any) => t._id) } },
                { $set: { Catatan: '[pemakaian_applied]' } }
              );
              // Reload nilai setelah sync
              (meteran as any).pemakaianBelumTerbayar = Math.max(
                0, ((meteran as any).pemakaianBelumTerbayar ?? 0) - toDecrement
              );
              logger.info(
                { NomorMeteran: (meteran as any).NomorMeteran, toDecrement },
                'Synced pemakaianBelumTerbayar from settled tagihans'
              );
            }
          }

          const pemakaian = (meteran as any).pemakaianBelumTerbayar ?? 0;
          if (pemakaian === 0) {
            logger.info({ NomorMeteran: (meteran as any).NomorMeteran }, 'No usage to bill, skipping');
            continue;
          }

          const totalPemakaian   = (meteran as any).totalPemakaian ?? 0;
          const penggunaanSebelum = Math.max(0, totalPemakaian - pemakaian);
          const { biaya, biayaBeban, totalBiaya } = calculateWaterBill(
            pemakaian,
            (meteran as any).IdKelompokPelanggan
          );

          const tenggatWaktu = getDueDate();

          const billing = new Billing({
            userId,
            IdMeteran: meteran._id,
            Periode: periode,
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
          });
          await billing.save();

          // Kirim notifikasi ke pelanggan jika ada userId
          if (userId) {
            await Notification.create({
              IdPelanggan: userId,
              Judul: 'Tagihan Air Baru',
              Pesan: `Tagihan air sebesar Rp${totalBiaya.toLocaleString('id-ID')} untuk periode ${periode}. Total pemakaian: ${pemakaian} m³. Jatuh tempo: ${tenggatWaktu.toLocaleDateString('id-ID')}`,
              Kategori: 'PEMBAYARAN',
              Link: '/pembayaran',
              isRead: false,
            }).catch((e: any) =>
              logger.error({ err: e }, 'Gagal kirim notifikasi billing baru')
            );
          }

          successCount++;
          logger.info({ NomorMeteran: (meteran as any).NomorMeteran, totalBiaya }, 'Billing created');
        } catch (error: any) {
          logger.error({ err: error, NomorMeteran: (meteran as any).NomorMeteran }, 'Gagal generate billing');
          failedCount++;
        }
      }

      logger.info({ successCount, failedCount }, 'Monthly billing generation completed');

      // ── Phase 2: Deteksi 3 bulan menunggak & merge tagihan 1+2 ──────────────
      await detectAndMergeTunggakan();

    } catch (error) {
      logger.error({ err: error }, 'Error in billing cron job');
    }
  });

  logger.info('Billing cron scheduled: 1st of every month at 00:01');
};

// ─── Helper: Deteksi 3 bulan menunggak & merge tagihan bulan ke-1 + ke-2 ──────

const detectAndMergeTunggakan = async (): Promise<void> => {
  logger.info('Running tunggakan merge detection...');
  try {
    // Ambil semua userId unik yang punya tagihan PENDING
    const userIds = await Billing.distinct('userId', { StatusPembayaran: 'pending' });
    let mergeCount = 0;

    for (const userId of userIds) {
      // Ambil semua tagihan PENDING milik user, urut terlama dulu
      const pendingBillings = await Billing.find({
        userId,
        StatusPembayaran: 'pending',
        jenisBilling: { $ne: 'denda' },
      }).sort({ Periode: 1 }).lean();

      // Hanya proses jika ada tepat 3 atau lebih tagihan PENDING
      if (pendingBillings.length < 3) continue;

      // Ambil 2 tagihan terlama untuk digabung
      const billA = pendingBillings[0];
      const billB = pendingBillings[1];

      // Skip jika sudah pernah di-merge
      if ((billA as any).mergedIntoBillingId || (billB as any).mergedIntoBillingId) continue;

      // Periode sebagai string "YYYY-MM" — format untuk catatan gabungan
      const periodeAStr = String((billA as any).Periode || '');
      const periodeBStr = String((billB as any).Periode || '');
      const catatanMerge = `Tagihan gabungan periode ${periodeAStr} dan ${periodeBStr}`;

      const mergedBilling = await Billing.create({
        userId:              (billA as any).userId,
        IdMeteran:           (billA as any).IdMeteran,
        Periode:             periodeAStr,
        PenggunaanSebelum:   (billA as any).PenggunaanSebelum,
        PenggunaanSekarang:  (billB as any).PenggunaanSekarang,
        TotalPemakaian:      ((billA as any).TotalPemakaian || 0) + ((billB as any).TotalPemakaian || 0),
        Biaya:               ((billA as any).Biaya || 0) + ((billB as any).Biaya || 0),
        BiayaBeban:          ((billA as any).BiayaBeban || 0) + ((billB as any).BiayaBeban || 0),
        TotalBiaya:          ((billA as any).TotalBiaya || 0) + ((billB as any).TotalBiaya || 0),
        StatusPembayaran:    'pending',
        TenggatWaktu:        (billB as any).TenggatWaktu,
        Menunggak:           true,
        Denda:               0,
        jenisBilling:        'normal',
        isMergedBilling:     true,
        bulanCakupan:        2,
        mergedFromIds:       [billA._id, billB._id],
        Catatan:             catatanMerge,
      });

      // Tandai 2 tagihan lama sebagai 'MERGED'
      await Billing.updateMany(
        { _id: { $in: [billA._id, billB._id] } },
        { $set: { StatusPembayaran: 'merged', mergedIntoBillingId: mergedBilling._id } }
      );

      mergeCount++;

      // Kirim notifikasi ke semua admin: pelanggan ini perlu pemutusan
      const admins = await AdminAccount.find({}, '_id').lean();
      if (admins.length > 0) {
        const adminNotifs = admins.map((admin: any) => ({
          IdAdmin: admin._id,
          Judul: 'Pelanggan Perlu Pemutusan',
          Pesan: `Pelanggan dengan ID ${userId} telah menunggak 3 bulan berturut-turut. Tagihan bulan 1 dan 2 telah digabungkan. Silakan lakukan pemutusan.`,
          Kategori: 'PERINGATAN',
          Link: '/billing/pemutusan',
          isRead: false,
        }));
        await Notification.insertMany(adminNotifs, { ordered: false }).catch((e: any) =>
          logger.error({ err: e }, 'Gagal kirim notifikasi pemutusan ke admin')
        );
      }
    }

    logger.info({ mergeCount }, 'Tunggakan merge detection completed');
  } catch (error) {
    logger.error({ err: error }, 'Error in tunggakan merge detection');
  }
};

// ─── Cron 2: Tandai tagihan overdue (tiap hari 00:05) ─────────────────────────

export const setupOverdueCron = (): void => {
  cron.schedule('5 0 * * *', async () => {
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
  });

  logger.info('Overdue cron scheduled: daily at 00:05');
};

// ─── Cron 3: Reminder 3 hari sebelum jatuh tempo (tiap hari 08:00) ────────────

export const setupReminderCron = (): void => {
  cron.schedule('0 8 * * *', async () => {
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
  });

  logger.info('Reminder cron scheduled: daily at 08:00');
};
