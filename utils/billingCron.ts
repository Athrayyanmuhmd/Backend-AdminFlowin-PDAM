import cron from 'node-cron';
import Billing from '../models/Billing.js';
import Meteran from '../models/Meteran.js';
import Notification from '../models/Notification.js';

// Helper functions
const calculateWaterBill = (totalPemakaian: number, kelompokPelanggan: any) => {
  let biayaAir = 0;

  if (totalPemakaian <= 10) {
    biayaAir = totalPemakaian * kelompokPelanggan.hargaPenggunaanDibawah10;
  } else {
    biayaAir =
      10 * kelompokPelanggan.hargaPenggunaanDibawah10 +
      (totalPemakaian - 10) * kelompokPelanggan.hargaPenggunaanDiatas10;
  }

  const biayaBeban = kelompokPelanggan.biayaBeban || 0;
  const totalTagihan = biayaAir + biayaBeban;

  return { biayaAir, biayaBeban, totalTagihan };
};

const getCurrentPeriode = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getDueDate = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 25);
};

// Auto-generate billing every month on 1st day at 00:01 AM
export const setupBillingCron = (): void => {
  cron.schedule('1 0 1 * *', async () => {
    console.log('🕐 Running monthly billing generation...');

    try {
      const currentPeriode = getCurrentPeriode();
      const meterans = await Meteran.find().populate('kelompokPelangganId userId');

      let successCount = 0;
      let failedCount = 0;

      for (const meteran of meterans) {
        try {
          const existingBilling = await Billing.findOne({
            meteranId: meteran._id,
            periode: currentPeriode,
          });

          if (existingBilling) {
            console.log(`⏭️  Skipped: Billing already exists for ${(meteran as any).noMeteran}`);
            continue;
          }

          const lastMonth = new Date(currentPeriode + '-01');
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const previousPeriode = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

          const previousBilling = await Billing.findOne({
            meteranId: meteran._id,
            periode: previousPeriode,
          });

          const pemakaianAwal = previousBilling ? (previousBilling as any).pemakaianAkhir : 0;
          const pemakaianAkhir = meteran.totalPemakaian;
          const totalPemakaian = (pemakaianAkhir ?? 0) - pemakaianAwal;

          if (totalPemakaian < 0) {
            console.log(`❌ Failed: Negative usage for ${(meteran as any).noMeteran}`);
            failedCount++;
            continue;
          }

          if (totalPemakaian === 0) {
            console.log(`⏭️  Skipped: No usage to bill for ${(meteran as any).noMeteran}`);
            continue;
          }

          const { biayaAir, biayaBeban, totalTagihan } = calculateWaterBill(
            totalPemakaian,
            (meteran as any).kelompokPelangganId
          );

          const billing = new Billing({
            idPelanggan: (meteran as any).userId?._id || null,
            meteranId: meteran._id,
            periode: currentPeriode,
            pemakaianAwal,
            pemakaianAkhir,
            totalPemakaian,
            biayaAir,
            biayaBeban,
            totalTagihan,
            dueDate: getDueDate(),
          });

          await billing.save();

          // Note: Do NOT increment pemakaianBelumTerbayar here —
          // it's tracked in real-time by historyUsageController
          (meteran as any).jatuhTempo = getDueDate();
          await meteran.save();

          const notification = new Notification({
            userId: (meteran as any).userId._id,
            judul: 'Tagihan Air Baru',
            pesan: `Tagihan air untuk periode ${currentPeriode} sebesar Rp${totalTagihan.toLocaleString('id-ID')}. Total pemakaian: ${totalPemakaian} m³. Jatuh tempo: ${getDueDate().toLocaleDateString('id-ID')}`,
            kategori: 'Transaksi',
            link: '/pembayaran',
          });

          await notification.save();
          successCount++;
          console.log(`✅ Success: Billing created for ${(meteran as any).noMeteran} - Rp${totalTagihan.toLocaleString('id-ID')}`);
        } catch (error: any) {
          console.log(`❌ Failed: ${(meteran as any).noMeteran} - ${error.message}`);
          failedCount++;
        }
      }

      console.log(`✅ Monthly billing generation completed: ${successCount} success, ${failedCount} failed`);
    } catch (error) {
      console.error('❌ Error in billing cron job:', error);
    }
  });

  console.log('✅ Billing cron job scheduled: 1st day of every month at 00:01');
};

// Check overdue billing every day at 00:05 AM
export const setupOverdueCron = (): void => {
  cron.schedule('5 0 * * *', async () => {
    console.log('🕐 Running overdue billing check...');

    try {
      const now = new Date();

      // Bulk update — replaces N+1 loop
      const overdueResult = await Billing.updateMany(
        { isPaid: false, dueDate: { $lt: now }, isOverdue: false },
        { $set: { isOverdue: true } }
      );
      const updatedCount = overdueResult.modifiedCount;

      if (updatedCount > 0) {
        // Fetch for notifications (read-only, lean)
        const overdueBillings = await Billing.find({
          isPaid: false, isOverdue: true, dueDate: { $lt: now },
          updatedAt: { $gte: new Date(Date.now() - 60000) },
        }).select('userId periode').lean();

        if (overdueBillings.length > 0) {
          const notifs = overdueBillings.map((billing: any) => ({
            idPelanggan: billing.userId,
            judul: 'Tagihan Terlambat',
            pesan: `Tagihan air periode ${billing.periode} telah melewati jatuh tempo. Segera lakukan pembayaran untuk menghindari denda.`,
            kategori: 'Peringatan',
            link: '/pembayaran',
            isRead: false,
          }));
          try {
            await Notification.insertMany(notifs, { ordered: false });
          } catch (notifErr: any) {
            console.error('Gagal kirim notifikasi overdue:', notifErr.message);
          }
        }
      }

      console.log(`✅ Overdue check completed: ${updatedCount} billing marked as overdue`);
    } catch (error) {
      console.error('❌ Error in overdue cron job:', error);
    }
  });

  console.log('✅ Overdue cron job scheduled: Daily at 00:05');
};

// Reminder 3 days before due date (runs daily at 08:00 AM)
export const setupReminderCron = (): void => {
  cron.schedule('0 8 * * *', async () => {
    console.log('🕐 Running billing reminder check...');

    try {
      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(now.getDate() + 3);

      const upcomingBillings = await Billing.find({
        isPaid: false,
        dueDate: { $gte: now, $lte: threeDaysLater },
      }).populate('userId', 'fullName');

      let reminderCount = 0;

      for (const billing of upcomingBillings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingReminder = await Notification.findOne({
          userId: (billing.userId as any)._id,
          judul: 'Pengingat Jatuh Tempo',
          createdAt: { $gte: today },
        });

        if (!existingReminder) {
          const daysUntilDue = Math.ceil(
            (new Date((billing as any).dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          const notification = new Notification({
            userId: (billing.userId as any)._id,
            judul: 'Pengingat Jatuh Tempo',
            pesan: `Tagihan air periode ${(billing as any).periode} sebesar Rp${(billing as any).totalTagihan.toLocaleString('id-ID')} akan jatuh tempo dalam ${daysUntilDue} hari (${new Date((billing as any).dueDate).toLocaleDateString('id-ID')}). Segera lakukan pembayaran.`,
            kategori: 'Informasi',
            link: '/pembayaran',
          });

          await notification.save();
          reminderCount++;
          console.log(`📨 Reminder sent to ${(billing.userId as any).fullName} - ${daysUntilDue} days until due`);
        }
      }

      console.log(`✅ Reminder check completed: ${reminderCount} reminders sent`);
    } catch (error) {
      console.error('❌ Error in reminder cron job:', error);
    }
  });

  console.log('✅ Reminder cron job scheduled: Daily at 08:00');
};
