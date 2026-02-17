import { verifyToken } from "../middleware/auth.js";
import TransactionMidtrans from "../models/MidTrans.js";
import midtransClient from "../middleware/midtrans.js";
import { v4 as uuidv4 } from "uuid";
import Wallet from "../models/Wallet.js";
import Notification from "../models/Notification.js";

export const createPayment = [
  verifyToken,
  async (req, res, next) => {
    try {
      const { amount, customerDetails, paymentMethod } = req.body;
      const { id } = req.params;

      // Buat orderId menggunakan UUID
      const orderId = uuidv4();

      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pengguna diperlukan, tetapi tidak disediakan",
        });
      }

      if (!amount || amount < 10000) {
        return res.status(400).json({
          status: 400,
          message:
            amount < 10000
              ? "Nominal top up minimal Rp.10.000"
              : "Isi nominal top up terlebih dahulu",
        });
      }

      if (!customerDetails) {
        return res.status(400).json({
          status: 400,
          pesan: "Data user dibutuhkan, coba login ulang terlebih dahulu",
        });
      }

      // if (!paymentMethod) {
      //   return res.status(400).json({
      //     status: 400,
      //     pesan: "Pilih metode pembayaran terlebih dahulu",
      //   });
      // }

      // Data untuk transaksi ke Midtrans
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        customer_details: {
          first_name: customerDetails.firstName,
          last_name: customerDetails.lastName,
          email: customerDetails.email,
          phone: customerDetails.noHP,
          userId: customerDetails.userId,
        },
      };

      // Buat transaksi menggunakan Midtrans Snap API
      const transaction = await midtransClient.createTransaction(parameter);

      // Simpan transaksi ke database
      const newTransaction = new TransactionMidtrans({
        orderId,
        amount,
        paymentMethod,
        paymentType: paymentMethod,
        transactionStatus: transaction.transaction_status,
        customerDetails: {
          userId: id,
          ...customerDetails,
        },
      });
      await newTransaction.save();

      await Wallet.findOneAndUpdate(
        { userId: id },
        { $inc: { pendingBalance: amount } },
        { new: true }
      );

      // Create a notification for payment creation
      const paymentNotification = new Notification({
        userId: id,
        judul: "Pembayaran Dibuat",
        message: `Pembayaran sebesar Rp${amount} telah dibuat. Silakan selesaikan pembayaran.`,
        kategori: "Transaksi",
        link: transaction.redirect_url,
      });

      await paymentNotification.save();

      // Kirim respons Snap redirect URL
      res.status(201).json({
        pesan: "Transaksi berhasil dibuat",
        redirectUrl: transaction.redirect_url,
        snapToken: transaction.token,
        data: transaction,
      });
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: error.message || "Terjadi kesalahan" });
    }
  },
];

export const webhookMidtrans = async (req, res) => {
  try {
    const notification = req.body;
    const orderId = notification.order_id; // Updated to match req.body structure
    const transactionStatus = notification.transaction_status;
    const amount = parseFloat(notification.gross_amount); // Parse the gross amount to a number

    // Mencari transaksi berdasarkan orderId
    const transaction = await TransactionMidtrans.findOne({ orderId });

    if (!transaction) {
      return res.status(404).json({ pesan: "Transaksi tidak ditemukan" });
    }

    const userId = transaction.customerDetails.userId;
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({ pesan: "Dompet tidak ditemukan" });
    }

    let notificationMessage = "";
    let notificationTitle = "";

    // Menangani status pembayaran
    switch (transactionStatus) {
      case "expire":
        await Wallet.findOneAndUpdate(
          { userId },
          {
            $set: {
              pendingBalance: wallet.pendingBalance - amount, // Use parsed amount
            },
          }
        );
        notificationTitle = "Pembayaran Kadaluarsa";
        notificationMessage = `Pembayaran sebesar Rp${amount} telah kadaluarsa. Silakan coba lagi.`;
        break;

      case "settlement": // Updated to handle 'settlement' status
        await Wallet.findOneAndUpdate(
          { userId },
          {
            $inc: { balance: amount }, // Use parsed amount
            $set: {
              pendingBalance: wallet.pendingBalance - amount, // Use parsed amount
            },
          }
        );
        notificationTitle = "Pembayaran Berhasil";
        notificationMessage = `Pembayaran sebesar Rp${amount} berhasil. Saldo Anda telah diperbarui.`;
        break;

      case "cancel": // Added handling for 'cancel' status
        notificationTitle = "Pembayaran Dibatalkan";
        notificationMessage = `Pembayaran sebesar Rp${amount} telah dibatalkan.`;
        break;

      case "pending":
        break;
      default:
        return res
          .status(400)
          .json({ pesan: "Status transaksi tidak dikenali" });
    }

    // Update status transaksi di collection TransactionMidtrans
    transaction.transactionStatus = transactionStatus;
    await transaction.save();

    // Create a notification for transaction status update
    const statusNotification = new Notification({
      userId,
      judul: notificationTitle,
      pesan: notificationMessage,
      kategori: "Transaksi",
    });

    await statusNotification.save();

    // Kirim respon OK untuk Midtrans
    res.status(200).json({ pesan: "Status transaksi berhasil diperbarui" });
  } catch (error) {
    console.error("Error processing notification:", error);
    res
      .status(500)
      .json({ pesan: "Gagal memperbarui status transaksi", error: error });
  }
};

export const getTransactionByOrderID = [
  verifyToken,
  async (req, res) => {
    try {
      const { orderID } = req.params;

      // Cari transaksi berdasarkan orderId
      const transaction = await TransactionMidtrans.findOne({
        orderId: orderID,
      });

      if (!transaction) {
        return res.status(404).json({ pesan: "Transaksi tidak ditemukan" });
      }

      res.status(200).json({
        pesan: "Transaksi ditemukan",
        data: transaction,
        status: transaction.transactionStatus,
      });
    } catch (error) {
      console.error("Error fetching transaction status:", error);
      res.status(500).json({ pesan: "Gagal mengambil status transaksi" });
    }
  },
];
