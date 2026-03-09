import cron from 'node-cron';
import Billing from '../models/Billing.js';
import Meteran from '../models/Meteran.js';
import Notification from '../models/Notification.js';
import logger from './logger.js';

// ─── Helper: hitung tarif air ─────────────────────────────────────────────────

const calculateWaterBill = (totalPemakaian: number, kelompok: any) => {
  const hargaBawah = kelompok?.hargaDiBawah10mKubik ?? 1500;
  const hargaAtas  = kelompok?.hargaDiAtas10mKubik  ?? 2000;
  const biaya = totalPemakaian <= 10
    ? totalPemakaian * hargaBawah
    : 10 * hargaBawah + (totalPemakaian - 10) * hargaAtas;
  const biayaBeban = kelompok?.biayaBeban ?? 5000;
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
      const now         = new Date();
      const periodeDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodeEnd  = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Populate idKelompokPelanggan + idKoneksiData → idPelanggan (untuk userId Billing)
      const meterans = await Meteran.find({ statusAktif: true })
        .populate('idKelompokPelanggan')
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .lean();

      let successCount = 0;
      let failedCount  = 0;

      for (const meteran of meterans) {
        try {
          const koneksiData = (meteran as any).idKoneksiData;
          const userId      = koneksiData?.idPelanggan?._id ?? null;

          // Skip jika billing periode ini sudah ada
          const existingBilling = await Billing.findOne({
            idMeteran: meteran._id,
            periode: { $gte: periodeDate, $lt: periodeEnd },
          });
          if (existingBilling) {
            logger.info({ nomorMeteran: meteran.nomorMeteran }, 'Billing already exists, skipping');
            continue;
          }

          const pemakaian = meteran.pemakaianBelumTerbayar ?? 0;
          if (pemakaian === 0) {
            logger.info({ nomorMeteran: meteran.nomorMeteran }, 'No usage to bill, skipping');
            continue;
          }

          const penggunaanSebelum = Math.max(0, (meteran.totalPemakaian ?? 0) - pemakaian);
          const { biaya, biayaBeban, totalBiaya } = calculateWaterBill(
            pemakaian,
            (meteran as any).idKelompokPelanggan
          );

          const billing = new Billing({
            userId,
            idMeteran: meteran._id,
            periode: periodeDate,
            penggunaanSebelum,
            penggunaanSekarang: meteran.totalPemakaian ?? 0,
            totalPemakaian: pemakaian,
            biaya,
            biayaBeban,
            totalBiaya,
            statusPembayaran: 'Pending',
            tenggatWaktu: getDueDate(),
            menunggak: false,
          });
          await billing.save();

          // Kirim notifikasi ke pelanggan jika ada userId
          if (userId) {
            await Notification.create({
              idPelanggan: userId,
              judul: 'Tagihan Air Baru',
              pesan: `Tagihan air sebesar Rp${totalBiaya.toLocaleString('id-ID')}. Total pemakaian: ${pemakaian} m³. Jatuh tempo: ${getDueDate().toLocaleDateString('id-ID')}`,
              kategori: 'Transaksi',
              link: '/pembayaran',
              isRead: false,
            }).catch((e: any) =>
              logger.error({ err: e }, 'Gagal kirim notifikasi billing baru')
            );
          }

          successCount++;
          logger.info({ nomorMeteran: meteran.nomorMeteran, totalBiaya }, 'Billing created');
        } catch (error: any) {
          logger.error({ err: error, nomorMeteran: meteran.nomorMeteran }, 'Gagal generate billing');
          failedCount++;
        }
      }

      logger.info({ successCount, failedCount }, 'Monthly billing generation completed');
    } catch (error) {
      logger.error({ err: error }, 'Error in billing cron job');
    }
  });

  logger.info('Billing cron scheduled: 1st of every month at 00:01');
};

// ─── Cron 2: Tandai tagihan overdue (tiap hari 00:05) ─────────────────────────

export const setupOverdueCron = (): void => {
  cron.schedule('5 0 * * *', async () => {
    logger.info('Running overdue billing check...');
    try {
      const now = new Date();

      // Bulk update — pakai field yang benar: statusPembayaran, tenggatWaktu, menunggak
      const overdueResult = await Billing.updateMany(
        { statusPembayaran: 'Pending', tenggatWaktu: { $lt: now }, menunggak: false },
        { $set: { menunggak: true } }
      );
      const updatedCount = overdueResult.modifiedCount;

      if (updatedCount > 0) {
        const overdueBillings = await Billing.find({
          statusPembayaran: 'Pending',
          menunggak: true,
          tenggatWaktu: { $lt: now },
          updatedAt: { $gte: new Date(Date.now() - 60_000) },
        }).select('userId periode').lean();

        if (overdueBillings.length > 0) {
          const notifs = overdueBillings.map((b: any) => ({
            idPelanggan: b.userId,
            judul: 'Tagihan Terlambat',
            pesan: `Tagihan air periode ${b.periode} telah melewati jatuh tempo. Segera lakukan pembayaran.`,
            kategori: 'Peringatan',
            link: '/pembayaran',
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
      const now           = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Pakai tenggatWaktu (bukan dueDate), statusPembayaran (bukan isPaid)
      const upcomingBillings = await Billing.find({
        statusPembayaran: 'Pending',
        tenggatWaktu: { $gte: now, $lte: threeDaysLater },
      }).populate('userId', 'namaLengkap').lean();

      let reminderCount = 0;

      for (const billing of upcomingBillings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const userId = (billing as any).userId?._id ?? billing.userId;
        if (!userId) continue;

        const existingReminder = await Notification.findOne({
          idPelanggan: userId,
          judul: 'Pengingat Jatuh Tempo',
          createdAt: { $gte: today },
        });

        if (!existingReminder) {
          const tenggatWaktu = (billing as any).tenggatWaktu;
          const daysUntilDue = Math.ceil(
            (new Date(tenggatWaktu).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          await Notification.create({
            idPelanggan: userId,
            judul: 'Pengingat Jatuh Tempo',
            pesan: `Tagihan air sebesar Rp${(billing as any).totalBiaya.toLocaleString('id-ID')} akan jatuh tempo dalam ${daysUntilDue} hari (${new Date(tenggatWaktu).toLocaleDateString('id-ID')}). Segera lakukan pembayaran.`,
            kategori: 'Informasi',
            link: '/pembayaran',
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
