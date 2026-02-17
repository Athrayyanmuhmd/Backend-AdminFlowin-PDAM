import Wallet from "../models/Wallet.js";
import { verifyToken } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

// Fungsi helper untuk memeriksa notifikasi yang sudah ada
const checkNotificationExists = async (userId, title, category) => {
  return await Notification.findOne({
    userId,
    title,
    category,
    createdAt: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)), // Cek notifikasi hari ini
    },
  });
};

export const getWalletByUserId = [
  verifyToken,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pengguna diperlukan, tetapi tidak disediakan",
        });
      }

      const wallet = await Wallet.findOne({ userId: userId });

      if (!wallet) {
        return res.status(404).json({
          status: 404,
          pesan: "Dompet tidak ditemukan",
        });
      }

      return res.status(200).json({
        status: 200,
        data: wallet,
        pesan: "Dompet ditemukan",
      });
    } catch (error) {
      console.error("Error in getWalletByUserId:", error);
      return res.status(500).json({
        status: 500,
        pesan: "Kesalahan server internal",
      });
    }
  },
];

export const convertConservasionToken = [
  verifyToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { token } = req.body;

      if (!userId || !token) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pengguna dan token diperlukan",
        });
      }

      // Validasi token harus berupa angka positif
      if (isNaN(token) || token <= 0) {
        return res.status(400).json({
          status: 400,
          pesan: "Token harus berupa angka positif",
        });
      }

      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        return res.status(404).json({
          status: 404,
          pesan: "Dompet tidak ditemukan",
        });
      }

      if (wallet.conservationToken < token) {
        return res.status(400).json({
          status: 400,
          pesan: "Saldo konversi token tidak mencukupi",
        });
      }

      const conversionRate = 90; // Rate konversi token ke Rupiah
      const convertedAmount = token * conversionRate;

      wallet.balance += convertedAmount;
      wallet.conservationToken -= token;

      const notification = new Notification({
        userId,
        judul: "Konversi Token",
        pesan: `Anda telah berhasil mengkonversi ${token} token konservasi menjadi Rp${convertedAmount}`,
        kategori: "Transaksi",
      });
      await notification.save();

      await wallet.save();

      return res.status(200).json({
        status: 200,
        data: {
          wallet,
          notification,
        },
        pesan: "Konversi token berhasil",
      });
    } catch (error) {
      console.error("Error in convertConservationToken:", error);
      return res.status(500).json({
        status: 500,
        pesan: "Kesalahan server internal",
      });
    }
  },
];
