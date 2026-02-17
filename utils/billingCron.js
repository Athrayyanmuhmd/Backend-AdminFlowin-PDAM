import cron from "node-cron";
import Billing from "../models/Billing.js";
import Meteran from "../models/Meteran.js";
import Notification from "../models/Notification.js";

// Helper functions (same as controller)
const calculateWaterBill = (totalPemakaian, kelompokPelanggan) => {
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

const getCurrentPeriode = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getDueDate = () => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 25);
  return nextMonth;
};

// Auto-generate billing every month on 1st day at 00:01 AM
export const setupBillingCron = () => {
  // Run on 1st of every month at 00:01
  cron.schedule("1 0 1 * *", async () => {
    console.log("🕐 Running monthly billing generation...");

    try {
      const currentPeriode = getCurrentPeriode();
      const meterans = await Meteran.find().populate(
        "kelompokPelangganId userId"
      );

      let successCount = 0;
      let failedCount = 0;

      for (const meteran of meterans) {
        try {
          // Check if billing already exists
          const existingBilling = await Billing.findOne({
            meteranId: meteran._id,
            periode: currentPeriode,
          });

          if (existingBilling) {
            console.log(
              `⏭️  Skipped: Billing already exists for ${meteran.noMeteran}`
            );
            continue;
          }

          // Calculate total pemakaian for this billing period
          // We need to get pemakaian that hasn't been billed yet
          // Get previous month's billing for pemakaianAwal and pemakaianAkhir
          const lastMonth = new Date(currentPeriode + "-01");
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const previousPeriode = `${lastMonth.getFullYear()}-${String(
            lastMonth.getMonth() + 1
          ).padStart(2, "0")}`;

          const previousBilling = await Billing.findOne({
            meteranId: meteran._id,
            periode: previousPeriode,
          });

          const pemakaianAwal = previousBilling
            ? previousBilling.pemakaianAkhir
            : 0;
          const pemakaianAkhir = meteran.totalPemakaian;

          // Total pemakaian for this billing period
          const totalPemakaian = pemakaianAkhir - pemakaianAwal;

          if (totalPemakaian < 0) {
            console.log(`❌ Failed: Negative usage for ${meteran.noMeteran}`);
            failedCount++;
            continue;
          }

          // Skip if no usage to bill
          if (totalPemakaian === 0) {
            console.log(
              `⏭️  Skipped: No usage to bill for ${meteran.noMeteran}`
            );
            continue;
          }

          // Calculate billing based on totalPemakaian
          const { biayaAir, biayaBeban, totalTagihan } = calculateWaterBill(
            totalPemakaian,
            meteran.kelompokPelangganId
          );

          const billing = new Billing({
            userId: meteran.userId._id,
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

          // Update meteran jatuhTempo only
          // Note: Do NOT increment pemakaianBelumTerbayar here!
          // pemakaianBelumTerbayar is already tracked in real-time by historyUsageController
          // Every time IoT sends usage data, it increments pemakaianBelumTerbayar
          // It will be reset to 0 when payment is successful (via webhook or manual payment)
          meteran.jatuhTempo = getDueDate();
          await meteran.save();

          // Create notification
          const notification = new Notification({
            userId: meteran.userId._id,
            judul: "Tagihan Air Baru",
            message: `Tagihan air untuk periode ${currentPeriode} sebesar Rp${totalTagihan.toLocaleString(
              "id-ID"
            )}. Total pemakaian: ${totalPemakaian} m³. Jatuh tempo: ${getDueDate().toLocaleDateString(
              "id-ID"
            )}`,
            kategori: "Transaksi",
            link: `/pembayaran`,
          });

          await notification.save();

          successCount++;
          console.log(
            `✅ Success: Billing created for ${
              meteran.noMeteran
            } - Rp${totalTagihan.toLocaleString("id-ID")}`
          );
        } catch (error) {
          console.log(`❌ Failed: ${meteran.noMeteran} - ${error.message}`);
          failedCount++;
        }
      }

      console.log(
        `✅ Monthly billing generation completed: ${successCount} success, ${failedCount} failed`
      );
    } catch (error) {
      console.error("❌ Error in billing cron job:", error);
    }
  });

  console.log("✅ Billing cron job scheduled: 1st day of every month at 00:01");
};

// Check overdue billing every day at 00:05 AM
export const setupOverdueCron = () => {
  // Run daily at 00:05
  cron.schedule("5 0 * * *", async () => {
    console.log("🕐 Running overdue billing check...");

    try {
      const now = new Date();

      // Find unpaid billing past due date
      const overdueBillings = await Billing.find({
        isPaid: false,
        dueDate: { $lt: now },
        isOverdue: false,
      });

      let updatedCount = 0;

      for (const billing of overdueBillings) {
        billing.isOverdue = true;
        await billing.save();

        // Send overdue notification
        const notification = new Notification({
          userId: billing.userId,
          judul: "Tagihan Terlambat",
          message: `Tagihan air periode ${
            billing.periode
          } sebesar Rp${billing.totalTagihan.toLocaleString(
            "id-ID"
          )} telah melewati jatuh tempo. Segera lakukan pembayaran untuk menghindari denda.`,
          kategori: "Peringatan",
          link: `/pembayaran`,
        });

        await notification.save();
        updatedCount++;

        console.log(
          `⚠️  Overdue: Billing ${billing._id} for periode ${billing.periode}`
        );
      }

      console.log(
        `✅ Overdue check completed: ${updatedCount} billing marked as overdue`
      );
    } catch (error) {
      console.error("❌ Error in overdue cron job:", error);
    }
  });

  console.log("✅ Overdue cron job scheduled: Daily at 00:05");
};

// Reminder 3 days before due date (runs daily at 08:00 AM)
export const setupReminderCron = () => {
  // Run daily at 08:00
  cron.schedule("0 8 * * *", async () => {
    console.log("🕐 Running billing reminder check...");

    try {
      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(now.getDate() + 3);

      // Find unpaid billing with due date in 3 days
      const upcomingBillings = await Billing.find({
        isPaid: false,
        dueDate: {
          $gte: now,
          $lte: threeDaysLater,
        },
      }).populate("userId", "fullName");

      let reminderCount = 0;

      for (const billing of upcomingBillings) {
        // Check if reminder already sent today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingReminder = await Notification.findOne({
          userId: billing.userId._id,
          judul: "Pengingat Jatuh Tempo",
          createdAt: { $gte: today },
        });

        if (!existingReminder) {
          const daysUntilDue = Math.ceil(
            (new Date(billing.dueDate) - now) / (1000 * 60 * 60 * 24)
          );

          const notification = new Notification({
            userId: billing.userId._id,
            judul: "Pengingat Jatuh Tempo",
            message: `Tagihan air periode ${
              billing.periode
            } sebesar Rp${billing.totalTagihan.toLocaleString(
              "id-ID"
            )} akan jatuh tempo dalam ${daysUntilDue} hari (${new Date(
              billing.dueDate
            ).toLocaleDateString("id-ID")}). Segera lakukan pembayaran.`,
            kategori: "Informasi",
            link: `/pembayaran`,
          });

          await notification.save();
          reminderCount++;

          console.log(
            `📨 Reminder sent to ${billing.userId.fullName} - ${daysUntilDue} days until due`
          );
        }
      }

      console.log(
        `✅ Reminder check completed: ${reminderCount} reminders sent`
      );
    } catch (error) {
      console.error("❌ Error in reminder cron job:", error);
    }
  });

  console.log("✅ Reminder cron job scheduled: Daily at 08:00");
};
