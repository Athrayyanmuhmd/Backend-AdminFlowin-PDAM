import crypto from "crypto";
import Billing from "../models/Billing.js";
import RabConnection from "../models/RabConnection.js";
import Notification from "../models/Notification.js";
import Meteran from "../models/Meteran.js";

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

    console.log("📨 Webhook received:", {
      order_id,
      transaction_status,
      payment_type,
      gross_amount,
      transaction_time,
      status_code,
      fraud_status,
    });

    console.log(
      "📨 Full webhook payload:",
      JSON.stringify(notification, null, 2)
    );

    // Verify signature from Midtrans
    // const serverKey =
    //   process.env.MIDTRANS_SERVER_KEY ||
    //   "SB-Mid-server-Fj3ePUi0ZtXwRwemdjNnshf-";

    // // Build signature string: order_id + status_code + gross_amount + serverKey
    // const signatureString = `${order_id}${status_code}${gross_amount}${serverKey}`;
    // const hash = crypto
    //   .createHash("sha512")
    //   .update(signatureString)
    //   .digest("hex");

    // console.log("🔐 Signature verification:", {
    //   order_id,
    //   status_code,
    //   gross_amount,
    //   serverKey: serverKey ? `${serverKey.substring(0, 10)}...` : "NOT SET",
    //   match: hash === signature_key,
    // });

    // if (hash !== signature_key) {
    //   console.error("❌ Invalid signature from Midtrans");
    //   console.error("Expected:", hash);
    //   console.error("Received:", signature_key);
    //   return res.status(403).json({
    //     status: "error",
    //     pesan: "Invalid signature",
    //   });
    // }

    // console.log("✅ Signature verified");

    // Tentukan tipe pembayaran berdasarkan order_id
    if (order_id.startsWith("RAB-")) {
      // Handle RAB Payment
      await handleRABPayment(order_id, transaction_status, notification);
    } else if (order_id.startsWith("BILLING-MULTI-")) {
      // Handle Multiple Billing Payment
      await handleMultipleBillingPayment(
        order_id,
        transaction_status,
        notification
      );
    } else if (order_id.startsWith("BILLING-")) {
      // Handle Single Billing Payment
      await handleBillingPayment(order_id, transaction_status, notification);
    } else {
      console.error("❌ Unknown order_id format:", order_id);
      return res.status(400).json({
        status: "error",
        pesan: "Unknown order_id format",
      });
    }

    // Send success response to Midtrans
    res.status(200).json({
      status: "success",
      pesan: "Notification processed successfully",
    });
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    res.status(500).json({
      status: "error",
      pesan: "Internal server error",
    });
  }
};

/**
 * Handle RAB payment webhook
 * Order ID format: RAB-{rabId} or RAB-{rabId}-{timestamp}
 */
async function handleRABPayment(orderId, transactionStatus, notification) {
  try {
    // Extract RAB ID from order_id
    // Format lama: RAB-{rabId}
    // Format baru: RAB-{rabId}-{timestamp}
    const parts = orderId.split("-");
    const rabId = parts[1]; // Ambil part kedua yang merupakan rabId

    console.log(
      `🔍 Processing RAB payment for rabId: ${rabId} (order_id: ${orderId})`
    );

    const rab = await RabConnection.findById(rabId).populate("userId");

    if (!rab) {
      console.error("❌ RAB not found:", rabId);
      return;
    }

    console.log(`📋 Current RAB status:`, {
      rabId: rab._id,
      isPaid: rab.isPaid,
      totalBiaya: rab.totalBiaya,
      userId: rab.userId._id,
    });

    let updateData = {};
    let notificationTitle = "";
    let notificationMessage = "";

    console.log(`📊 Transaction status received: "${transactionStatus}"`);

    switch (transactionStatus) {
      case "settlement":
        console.log("� Processing SETTLEMENT status...");
        updateData = {
          isPaid: true,
        };
        notificationTitle = "✅ Pembayaran RAB Berhasil";
        notificationMessage = `Pembayaran RAB sebesar Rp${parseFloat(
          notification.gross_amount
        ).toLocaleString(
          "id-ID"
        )} telah berhasil. Pemasangan akan segera dijadwalkan.`;
        console.log("✅ SETTLEMENT status, will update isPaid to true");
        break;

      case "capture":
        console.log("� Processing CAPTURE status...");
        if (notification.fraud_status === "accept") {
          notificationTitle = "✅ Pembayaran RAB Berhasil (Capture)";
          notificationMessage = `Pembayaran RAB sebesar Rp${parseFloat(
            notification.gross_amount
          ).toLocaleString(
            "id-ID"
          )} telah berhasil (captured). Menunggu settlement.`;
          console.log(
            "✅ CAPTURE accepted, but will NOT update isPaid (waiting for settlement)"
          );
        } else {
          console.log(
            `⚠️ CAPTURE but fraud_status is: ${notification.fraud_status}`
          );
        }
        // Tidak update isPaid, tunggu settlement
        console.log(
          "⚠️ Status CAPTURE - no database update, waiting for settlement"
        );
        return;

      case "pending":
        console.log("⏳ Processing PENDING status...");
        notificationTitle = "⏳ Pembayaran RAB Pending";
        notificationMessage = `Pembayaran RAB sedang diproses. Mohon selesaikan pembayaran Anda.`;
        // Tidak update isPaid untuk pending
        console.log("⚠️ Status PENDING - no database update");
        return;

      case "deny":
      case "cancel":
      case "expire":
        console.log(`❌ Processing FAILED status: ${transactionStatus}`);
        notificationTitle = "❌ Pembayaran RAB Gagal";
        notificationMessage = `Pembayaran RAB sebesar Rp${parseFloat(
          notification.gross_amount
        ).toLocaleString("id-ID")} gagal atau dibatalkan. Silakan coba lagi.`;
        // Tidak update isPaid untuk failed status, biarkan tetap false
        console.log(
          "⚠️ Status FAILED - no database update, isPaid remains false"
        );
        return;

      default:
        console.log("⚠️ Unhandled transaction status:", transactionStatus);
        console.log("⚠️ Will not update RAB status");
        return;
    }

    // Check if updateData has any fields
    if (Object.keys(updateData).length === 0) {
      console.error("❌ No update data to apply!");
      return;
    }

    // Update RAB
    console.log(`🔄 Updating RAB ${rabId} with data:`, updateData);

    try {
      // Method 1: Update dengan findByIdAndUpdate
      const updatedRab = await RabConnection.findByIdAndUpdate(
        rabId,
        updateData,
        {
          new: true, // Return updated document
          runValidators: true, // Run schema validators
        }
      );

      if (!updatedRab) {
        console.error(
          `❌ Failed to update RAB: ${rabId} - Document not found after update`
        );
        throw new Error(`RAB ${rabId} not found after update`);
      }

      console.log(`✅ RAB updated successfully:`, {
        rabId: updatedRab._id.toString(),
        isPaid: updatedRab.isPaid,
        wasChanged: updatedRab.isPaid !== rab.isPaid,
        oldValue: rab.isPaid,
        newValue: updatedRab.isPaid,
      });

      // Verify update dengan re-fetch
      const verifyRab = await RabConnection.findById(rabId);
      console.log(
        `🔍 Verification - RAB isPaid after update:`,
        verifyRab?.isPaid
      );

      if (verifyRab?.isPaid !== updateData.isPaid) {
        console.error(
          `❌ CRITICAL: Update verification failed! Expected: ${updateData.isPaid}, Got: ${verifyRab?.isPaid}`
        );
      } else {
        console.log(`✅ Update verified successfully!`);
      }
    } catch (updateError) {
      console.error(`❌ Error updating RAB:`, updateError);
      throw updateError;
    }

    // Create notification for user
    if (notificationTitle && notificationMessage) {
      await Notification.create({
        userId: rab.userId._id,
        title: notificationTitle,
        message: notificationMessage,
        kategori: "PEMBAYARAN",
        link: `/rab/${rabId}`,
      });
      console.log(`📬 Notification created for user: ${rab.userId._id}`);
    }

    console.log(
      `✅ RAB payment webhook processing completed: ${rabId} - Status: ${transactionStatus} - Final isPaid: ${updateData.isPaid}`
    );
  } catch (error) {
    console.error("❌ Error handling RAB payment:", error);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

/**
 * Handle Billing payment webhook
 */
async function handleBillingPayment(orderId, transactionStatus, notification) {
  try {
    // Extract Billing ID from order_id (format: BILLING-{billingId})
    const billingId = orderId.replace("BILLING-", "");

    const billing = await Billing.findById(billingId)
      .populate("userId")
      .populate("idMeteran");

    if (!billing) {
      console.error("❌ Billing not found:", billingId);
      return;
    }

    let updateData = {};
    let notificationTitle = "";
    let notificationMessage = "";
    let shouldResetMeteran = false;

    switch (transactionStatus) {
      case "capture":
        if (notification.fraud_status === "accept") {
          updateData = {
            statusPembayaran: "Settlement",
            tanggalPembayaran: new Date(),
            metodePembayaran: notification.payment_type,
            catatan: `Dibayar via ${
              notification.payment_type
            } pada ${new Date().toLocaleString("id-ID")}`,
          };
          notificationTitle = "💧 Pembayaran Tagihan Air Berhasil";
          notificationMessage = `Pembayaran tagihan air sebesar Rp${parseFloat(
            notification.gross_amount
          ).toLocaleString("id-ID")} untuk periode ${
            billing.periode
          } telah berhasil. Terima kasih!`;
          shouldResetMeteran = true;
        }
        break;

      case "settlement":
        updateData = {
          statusPembayaran: "Settlement",
          tanggalPembayaran: new Date(),
          metodePembayaran: notification.payment_type,
          catatan: `Dibayar via ${
            notification.payment_type
          } pada ${new Date().toLocaleString("id-ID")}`,
        };
        notificationTitle = "💧 Pembayaran Tagihan Air Berhasil";
        notificationMessage = `Pembayaran tagihan air sebesar Rp${parseFloat(
          notification.gross_amount
        ).toLocaleString("id-ID")} untuk periode ${
          billing.periode
        } telah berhasil. Terima kasih!`;
        shouldResetMeteran = true;
        break;

      case "pending":
        notificationTitle = "⏳ Pembayaran Tagihan Pending";
        notificationMessage = `Pembayaran tagihan air sedang diproses. Mohon selesaikan pembayaran Anda.`;
        break;

      case "deny":
      case "cancel":
      case "expire":
        notificationTitle = "❌ Pembayaran Tagihan Gagal";
        notificationMessage = `Pembayaran tagihan air sebesar Rp${parseFloat(
          notification.gross_amount
        ).toLocaleString("id-ID")} gagal atau dibatalkan. Silakan coba lagi.`;
        break;

      default:
        console.log("⚠️ Unhandled transaction status:", transactionStatus);
        return;
    }

    // Update Billing
    if (Object.keys(updateData).length > 0) {
      await Billing.findByIdAndUpdate(billingId, updateData);
    }

    // Reset meteran pemakaianBelumTerbayar jika pembayaran berhasil
    if (shouldResetMeteran && billing.idMeteran) {
      const meteran = await Meteran.findById(billing.idMeteran._id);
      if (meteran) {
        // KURANGI pemakaianBelumTerbayar sesuai billing yang dibayar
        // Bukan reset ke 0 karena mungkin ada tagihan lain yang belum dibayar
        meteran.pemakaianBelumTerbayar = Math.max(
          0,
          meteran.pemakaianBelumTerbayar - billing.totalPemakaian
        );
        await meteran.save();
        console.log(
          `✅ Kurangi pemakaianBelumTerbayar untuk meteran: ${billing.idMeteran._id} (${billing.totalPemakaian} m³)`
        );
      }
    }

    // Create notification for user
    if (notificationTitle && notificationMessage) {
      await Notification.create({
        userId: billing.userId._id,
        title: notificationTitle,
        message: notificationMessage,
        kategori: "PEMBAYARAN",
        link: `/pembayaran`,
      });
    }

    console.log(
      `✅ Billing payment updated: ${billingId} - Status: ${transactionStatus}`
    );
  } catch (error) {
    console.error("❌ Error handling billing payment:", error);
    throw error;
  }
}

/**
 * Handle Multiple Billing payment webhook
 * Order ID format: BILLING-MULTI-{userId}-{timestamp}
 */
async function handleMultipleBillingPayment(
  orderId,
  transactionStatus,
  notification
) {
  try {
    // Extract userId from order_id (format: BILLING-MULTI-{userId}-{timestamp})
    const parts = orderId.split("-");
    const userId = parts[2];

    console.log(`📋 Processing multiple billing payment for user: ${userId}`);

    // Get all unpaid billings for this user
    const unpaidBillings = await Billing.find({
      userId: userId,
      statusPembayaran: { $ne: "Settlement" },
    }).populate("idMeteran");

    if (unpaidBillings.length === 0) {
      console.error("❌ No unpaid billings found for user:", userId);
      return;
    }

    let updateData = {};
    let notificationTitle = "";
    let notificationMessage = "";
    let shouldUpdateMeteran = false;

    switch (transactionStatus) {
      case "capture":
        if (notification.fraud_status === "accept") {
          updateData = {
            statusPembayaran: "Settlement",
            tanggalPembayaran: new Date(),
            metodePembayaran: notification.payment_type,
            catatan: `Dibayar via ${
              notification.payment_type
            } pada ${new Date().toLocaleString("id-ID")}`,
          };
          notificationTitle = "💧 Pembayaran Semua Tagihan Berhasil";
          notificationMessage = `Pembayaran ${
            unpaidBillings.length
          } tagihan air sebesar Rp${parseFloat(
            notification.gross_amount
          ).toLocaleString("id-ID")} telah berhasil. Terima kasih!`;
          shouldUpdateMeteran = true;
        }
        break;

      case "settlement":
        updateData = {
          statusPembayaran: "Settlement",
          tanggalPembayaran: new Date(),
          metodePembayaran: notification.payment_type,
          catatan: `Dibayar via ${
            notification.payment_type
          } pada ${new Date().toLocaleString("id-ID")}`,
        };
        notificationTitle = "💧 Pembayaran Semua Tagihan Berhasil";
        notificationMessage = `Pembayaran ${
          unpaidBillings.length
        } tagihan air sebesar Rp${parseFloat(
          notification.gross_amount
        ).toLocaleString("id-ID")} telah berhasil. Terima kasih!`;
        shouldUpdateMeteran = true;
        break;

      case "pending":
        notificationTitle = "⏳ Pembayaran Tagihan Pending";
        notificationMessage = `Pembayaran ${unpaidBillings.length} tagihan air sedang diproses. Mohon selesaikan pembayaran Anda.`;
        break;

      case "deny":
      case "cancel":
      case "expire":
        notificationTitle = "❌ Pembayaran Tagihan Gagal";
        notificationMessage = `Pembayaran ${
          unpaidBillings.length
        } tagihan air sebesar Rp${parseFloat(
          notification.gross_amount
        ).toLocaleString("id-ID")} gagal atau dibatalkan. Silakan coba lagi.`;
        break;

      default:
        console.log("⚠️ Unhandled transaction status:", transactionStatus);
        return;
    }

    // Update all unpaid billings
    if (Object.keys(updateData).length > 0) {
      let totalPemakaian = 0;

      for (const billing of unpaidBillings) {
        await Billing.findByIdAndUpdate(billing._id, updateData);
        totalPemakaian += billing.totalPemakaian;
        console.log(`✅ Updated billing: ${billing._id} (${billing.periode})`);
      }

      // Update meteran - kurangi pemakaianBelumTerbayar sesuai total usage yang dibayar
      if (shouldUpdateMeteran && unpaidBillings[0].meteranId) {
        const meteran = await Meteran.findById(unpaidBillings[0].meteranId._id);
        if (meteran) {
          meteran.pemakaianBelumTerbayar = Math.max(
            0,
            meteran.pemakaianBelumTerbayar - totalPemakaian
          );
          await meteran.save();
          console.log(
            `✅ Kurangi pemakaianBelumTerbayar untuk meteran: ${unpaidBillings[0].meteranId._id} (${totalPemakaian} m³)`
          );
        }
      }
    }

    // Create notification for user
    if (notificationTitle && notificationMessage) {
      await Notification.create({
        userId: userId,
        title: notificationTitle,
        message: notificationMessage,
        kategori: "PEMBAYARAN",
        link: `/pembayaran`,
      });
    }

    console.log(
      `✅ Multiple billing payment updated for user ${userId}: ${unpaidBillings.length} bills - Status: ${transactionStatus}`
    );
  } catch (error) {
    console.error("❌ Error handling multiple billing payment:", error);
    throw error;
  }
}
