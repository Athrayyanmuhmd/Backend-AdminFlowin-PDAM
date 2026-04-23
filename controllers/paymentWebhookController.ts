// @ts-nocheck — legacy REST controller, phase-out menuju GraphQL
import crypto from "crypto";
import logger from "../utils/logger.js";
import Billing from "../models/Billing.js";
import RabConnection from "../models/RabConnection.js";
import Notification from "../models/Notification.js";
import Meteran from "../models/Meteran.js";
import User from "../models/User.js";
import KoneksiData from "../models/ConnectionData.js";
import { deleteCacheByPattern } from "../utils/redis.js";

// ─── Helper: cek dan reaktivasi pelanggan jika semua tagihan lunas ────────────
async function checkAndReactivateUser(userId: any): Promise<void> {
  if (!userId) return;
  const user = await User.findById(userId);
  if (!user || user.accountStatus !== 'inactive') return;

  // Field PascalCase sesuai Billing model
  const sisaPending = await Billing.countDocuments({ userId, StatusPembayaran: 'pending' });
  if (sisaPending > 0) return;

  user.accountStatus = 'active';
  await user.save();

  await Notification.create({
    IdPelanggan: userId,
    Judul: 'Akun Aktif Kembali',
    Pesan: 'Semua tunggakan telah dilunasi. Akun Anda kini aktif kembali.',
    Kategori: 'INFORMASI',
    Link: '/tagihan',
    isRead: false,
  }).catch(() => {});
}

/**
 * Webhook handler untuk notifikasi pembayaran dari Midtrans
 * Menangani pembayaran RAB dan Billing
 * Endpoint: POST /webhook/payment
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const notification = req.body;

    const {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
      payment_type,
      transaction_time,
      signature_key,
      status_code,
    } = notification;

    logger.info({
      order_id,
      transaction_status,
      payment_type,
      gross_amount,
      transaction_time,
      status_code,
      fraud_status,
    });

    console.log(JSON.stringify(notification, null, 2));

    // Verify signature from Midtrans
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error("❌ MIDTRANS_SERVER_KEY not configured");
      return res.status(500).json({ status: "error", pesan: "Server configuration error" });
    }

    const signatureString = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const hash = crypto.createHash("sha512").update(signatureString).digest("hex");
    const hashBuffer = Buffer.from(hash, 'hex');
    const sigBuffer = Buffer.from(signature_key || '', 'hex');
    const signaturesMatch = hashBuffer.length === sigBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, sigBuffer);

    if (!signaturesMatch) {
      console.error("❌ Invalid signature from Midtrans", { order_id, status_code });
      return res.status(403).json({ status: "error", pesan: "Invalid signature" });
    }

    console.log("✅ Signature verified:", order_id);

    if (order_id.startsWith("RAB-")) {
      await handleRABPayment(order_id, transaction_status, notification);
    } else if (order_id.startsWith("BILLING-MULTI-")) {
      await handleMultipleBillingPayment(order_id, transaction_status, notification);
    } else if (order_id.startsWith("BILLING-")) {
      await handleBillingPayment(order_id, transaction_status, notification);
    } else {
      // Order format dari Ahmad (FLOWIN-*) atau sistem lain — abaikan dengan graceful
      console.log("⚠️ Unknown order_id format, skipping:", order_id);
      return res.status(200).json({ status: "ok", pesan: "Order ID format not handled by this webhook" });
    }

    res.status(200).json({ status: "success", pesan: "Notification processed successfully" });
  } catch (error) {
    // Selalu return 200 agar Midtrans tidak retry — retry bisa menyebabkan double-process.
    // Error sudah di-log di dalam handler masing-masing (handleBillingPayment, dll).
    console.error("❌ Error processing webhook:", error);
    res.status(200).json({ status: "error", pesan: "Webhook processing failed, logged for review" });
  }
};

/**
 * Handle RAB payment webhook
 * Order ID format: RAB-{rabId} or RAB-{rabId}-{timestamp}
 */
async function handleRABPayment(orderId, transactionStatus, notification) {
  try {
    const parts = orderId.split("-");
    const rabId = parts[1];

    console.log(`🔍 Processing RAB payment for rabId: ${rabId} (order_id: ${orderId})`);

    // RabConnection tidak memiliki userId — ambil via idKoneksiData → IdPelanggan
    const rab = await RabConnection.findById(rabId);
    if (!rab) {
      console.error("❌ RAB not found:", rabId);
      return;
    }

    // Ambil userId dari koneksiData
    let pelangganId: any = null;
    if (rab.idKoneksiData) {
      const koneksi = await KoneksiData.findById(rab.idKoneksiData).select('IdPelanggan');
      pelangganId = koneksi?.IdPelanggan ?? null;
    }

    console.log(`📋 Current RAB status: rabId=${rab._id}, statusPembayaran=${rab.statusPembayaran}`);
    console.log(`📊 Transaction status received: "${transactionStatus}"`);

    // Idempotency: jangan proses ulang jika sudah settlement
    if (rab.statusPembayaran === 'settlement' && (transactionStatus === 'settlement' || transactionStatus === 'capture')) {
      console.log(`⚠️ [idempotency] RAB ${rabId} sudah settlement, skip duplicate event`);
      return;
    }

    let notificationTitle = "";
    let notificationMessage = "";

    switch (transactionStatus) {
      case "settlement":
      case "capture": {
        if (transactionStatus === "capture" && notification.fraud_status !== "accept") {
          console.log(`⚠️ CAPTURE but fraud_status is: ${notification.fraud_status}`);
          return;
        }
        // Field RAB model pakai camelCase: statusPembayaran
        await RabConnection.findByIdAndUpdate(rabId, { statusPembayaran: 'settlement' }, { new: true });
        notificationTitle = 'Pembayaran RAB Berhasil';
        notificationMessage = `Pembayaran RAB sebesar Rp${parseFloat(notification.gross_amount).toLocaleString('id-ID')} telah berhasil. Pemasangan akan segera dijadwalkan.`;
        console.log(`✅ RAB status updated to settlement`);
        break;
      }

      case "pending":
        console.log("⏳ RAB payment pending, no DB update");
        return;

      case "deny":
      case "cancel":
      case "expire":
        notificationTitle = 'Pembayaran RAB Gagal';
        notificationMessage = `Pembayaran RAB sebesar Rp${parseFloat(notification.gross_amount).toLocaleString('id-ID')} gagal atau dibatalkan. Silakan coba lagi.`;
        break;

      default:
        console.log("⚠️ Unhandled transaction status:", transactionStatus);
        return;
    }

    // Kirim notifikasi ke pelanggan — field PascalCase sesuai Notification model & Ahmad
    if (notificationTitle && pelangganId) {
      await Notification.create({
        IdPelanggan: pelangganId,
        Judul: notificationTitle,
        Pesan: notificationMessage,
        Kategori: 'PEMBAYARAN',
        Link: '/connection-data',
        isRead: false,
      }).catch((e: any) => logger.error({ err: e }, 'Gagal kirim notifikasi RAB'));
    }

    console.log(`✅ RAB payment webhook processing completed: ${rabId} - Status: ${transactionStatus}`);
  } catch (error) {
    logger.error({ err: error }, "RAB payment webhook error");
    throw error;
  }
}

/**
 * Handle single Billing payment webhook
 * Order ID format: BILLING-{billingId}
 */
async function handleBillingPayment(orderId, transactionStatus, notification) {
  try {
    const billingId = orderId.replace("BILLING-", "");

    // Populate: userId (camelCase OK), IdMeteran (PascalCase sesuai Billing model)
    const billing = await Billing.findById(billingId)
      .populate("userId")
      .populate("IdMeteran");

    if (!billing) {
      console.error("❌ Billing not found:", billingId);
      return;
    }

    // Idempotency: jangan proses ulang jika sudah settlement (pemakaianBelumTerbayar sudah dikurangi)
    if ((billing as any).StatusPembayaran === 'settlement' && (transactionStatus === 'settlement' || transactionStatus === 'capture')) {
      console.log(`⚠️ [idempotency] Billing ${billingId} sudah settlement, skip duplicate event`);
      return;
    }

    let updateData: any = {};
    let notificationTitle = "";
    let notificationMessage = "";
    let shouldResetMeteran = false;

    switch (transactionStatus) {
      case "capture":
        if (notification.fraud_status !== "accept") break;
        // fallthrough intentional
      case "settlement":
        // Field names PascalCase sesuai Billing model
        updateData = {
          StatusPembayaran: 'settlement',
          TanggalPembayaran: new Date(),
          MetodePembayaran: notification.payment_type,
          // [pemakaian_applied] — marker untuk billingCron agar tidak double-decrement
          Catatan: `Dibayar via ${notification.payment_type} pada ${new Date().toLocaleString('id-ID')} [pemakaian_applied]`,
        };
        notificationTitle = 'Pembayaran Tagihan Air Berhasil';
        notificationMessage = `Pembayaran tagihan air sebesar Rp${parseFloat(notification.gross_amount).toLocaleString('id-ID')} untuk periode ${(billing as any).Periode} telah berhasil. Terima kasih!`;
        shouldResetMeteran = true;
        break;

      case "pending":
        notificationTitle = 'Pembayaran Tagihan Sedang Diproses';
        notificationMessage = 'Pembayaran tagihan air sedang diproses. Mohon selesaikan pembayaran Anda.';
        break;

      case "deny":
      case "cancel":
      case "expire":
        notificationTitle = 'Pembayaran Tagihan Gagal';
        notificationMessage = `Pembayaran tagihan air sebesar Rp${parseFloat(notification.gross_amount).toLocaleString('id-ID')} gagal atau dibatalkan. Silakan coba lagi.`;
        break;

      default:
        console.log("⚠️ Unhandled transaction status:", transactionStatus);
        return;
    }

    if (Object.keys(updateData).length > 0) {
      await Billing.findByIdAndUpdate(billingId, updateData);
    }

    // Kurangi pemakaianBelumTerbayar — field IdMeteran PascalCase sesuai Billing model
    if (shouldResetMeteran && (billing as any).IdMeteran) {
      const meteranId = (billing as any).IdMeteran._id ?? (billing as any).IdMeteran;
      const meteran = await Meteran.findById(meteranId);
      if (meteran) {
        meteran.pemakaianBelumTerbayar = Math.max(
          0,
          (meteran.pemakaianBelumTerbayar ?? 0) - ((billing as any).TotalPemakaian ?? 0)
        );
        await meteran.save();
        console.log(`✅ pemakaianBelumTerbayar dikurangi: ${(billing as any).TotalPemakaian} m³`);
      }
    }

    // Kirim notifikasi ke pelanggan — field PascalCase sesuai Notification model & Ahmad
    const pelangganId = (billing as any).userId?._id ?? (billing as any).userId;
    if (notificationTitle && pelangganId) {
      await Notification.create({
        IdPelanggan: pelangganId,
        Judul: notificationTitle,
        Pesan: notificationMessage,
        Kategori: 'PEMBAYARAN',
        Link: '/tagihan',
        isRead: false,
      }).catch((e: any) => logger.error({ err: e }, 'Gagal kirim notifikasi billing'));
    }

    if (shouldResetMeteran) {
      await checkAndReactivateUser(pelangganId);
      // Invalidasi cache dashboard yang bergantung pada data tagihan
      deleteCacheByPattern('laporan:*').catch(() => {});
      deleteCacheByPattern('dashboard:*').catch(() => {});
    }

    console.log(`✅ Billing payment updated: ${billingId} - Status: ${transactionStatus}`);
  } catch (error) {
    logger.error({ err: error }, "Billing payment webhook error");
    throw error;
  }
}

/**
 * Handle Multiple Billing payment webhook
 * Order ID format: BILLING-MULTI-{userId}-{timestamp}
 */
async function handleMultipleBillingPayment(orderId, transactionStatus, notification) {
  try {
    const parts = orderId.split("-");
    const userId = parts[2];

    console.log(`📋 Processing multiple billing payment for user: ${userId}`);

    // Filter PascalCase sesuai Billing model
    const unpaidBillings = await Billing.find({
      userId,
      StatusPembayaran: { $nin: ['settlement', 'merged'] },
    }).populate("IdMeteran");

    if (unpaidBillings.length === 0) {
      // Idempotency: semua tagihan sudah di-settle — kemungkinan duplicate event
      console.log(`⚠️ [idempotency] Semua billing user ${userId} sudah settlement, skip duplicate event`);
      return;
    }

    // Hanya proses tagihan yang belum settlement (guard tambahan)
    const billingsToProcess = unpaidBillings.filter(
      (b: any) => b.StatusPembayaran !== 'settlement'
    );
    if (billingsToProcess.length === 0) {
      console.log(`⚠️ [idempotency] Tidak ada billing yang perlu diupdate untuk user ${userId}`);
      return;
    }

    let updateData: any = {};
    let notificationTitle = "";
    let notificationMessage = "";
    let shouldUpdateMeteran = false;

    switch (transactionStatus) {
      case "capture":
        if (notification.fraud_status !== "accept") break;
        // fallthrough intentional
      case "settlement":
        updateData = {
          StatusPembayaran: 'settlement',
          TanggalPembayaran: new Date(),
          MetodePembayaran: notification.payment_type,
          // [pemakaian_applied] — marker untuk billingCron agar tidak double-decrement
          Catatan: `Dibayar via ${notification.payment_type} pada ${new Date().toLocaleString('id-ID')} [pemakaian_applied]`,
        };
        notificationTitle = 'Pembayaran Semua Tagihan Berhasil';
        notificationMessage = `Pembayaran ${billingsToProcess.length} tagihan air sebesar Rp${parseFloat(notification.gross_amount).toLocaleString('id-ID')} telah berhasil. Terima kasih!`;
        shouldUpdateMeteran = true;
        break;

      case "pending":
        notificationTitle = 'Pembayaran Tagihan Sedang Diproses';
        notificationMessage = `Pembayaran ${billingsToProcess.length} tagihan air sedang diproses. Mohon selesaikan pembayaran Anda.`;
        break;

      case "deny":
      case "cancel":
      case "expire":
        notificationTitle = 'Pembayaran Tagihan Gagal';
        notificationMessage = `Pembayaran ${billingsToProcess.length} tagihan air sebesar Rp${parseFloat(notification.gross_amount).toLocaleString('id-ID')} gagal atau dibatalkan. Silakan coba lagi.`;
        break;

      default:
        console.log("⚠️ Unhandled transaction status:", transactionStatus);
        return;
    }

    if (Object.keys(updateData).length > 0) {
      // Group by meteran untuk kurangi pemakaianBelumTerbayar
      const meteranTotalMap = new Map<string, number>();

      for (const billing of billingsToProcess) {
        await Billing.findByIdAndUpdate(billing._id, updateData);

        if (shouldUpdateMeteran) {
          // Field IdMeteran PascalCase sesuai Billing model
          const meteranId = ((billing as any).IdMeteran?._id ?? (billing as any).IdMeteran)?.toString();
          if (meteranId) {
            meteranTotalMap.set(
              meteranId,
              (meteranTotalMap.get(meteranId) ?? 0) + ((billing as any).TotalPemakaian ?? 0)
            );
          }
        }
      }

      // Kurangi pemakaianBelumTerbayar per meteran
      if (shouldUpdateMeteran) {
        for (const [meteranId, totalPemakaian] of meteranTotalMap.entries()) {
          const meteran = await Meteran.findById(meteranId);
          if (meteran) {
            meteran.pemakaianBelumTerbayar = Math.max(
              0,
              (meteran.pemakaianBelumTerbayar ?? 0) - totalPemakaian
            );
            await meteran.save();
            console.log(`✅ pemakaianBelumTerbayar dikurangi: meteran=${meteranId}, total=${totalPemakaian} m³`);
          }
        }
      }
    }

    // Kirim notifikasi ke pelanggan — field PascalCase sesuai Notification model & Ahmad
    if (notificationTitle && userId) {
      await Notification.create({
        IdPelanggan: userId,
        Judul: notificationTitle,
        Pesan: notificationMessage,
        Kategori: 'PEMBAYARAN',
        Link: '/tagihan',
        isRead: false,
      }).catch((e: any) => logger.error({ err: e }, 'Gagal kirim notifikasi multi-billing'));
    }

    if (shouldUpdateMeteran) {
      await checkAndReactivateUser(userId);
      // Invalidasi cache dashboard yang bergantung pada data tagihan
      deleteCacheByPattern('laporan:*').catch(() => {});
      deleteCacheByPattern('dashboard:*').catch(() => {});
    }

    console.log(`✅ Multiple billing payment updated for user ${userId}: ${billingsToProcess.length} bills - Status: ${transactionStatus}`);
  } catch (error) {
    logger.error({ err: error }, "Multi-billing payment webhook error");
    throw error;
  }
}
