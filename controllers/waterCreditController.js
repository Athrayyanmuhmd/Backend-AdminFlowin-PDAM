import WaterCredits from "../models/WaterCredits.js";
import { verifyToken } from "../middleware/auth.js";

export const getWaterCreditByOwnerId = [
  verifyToken,
  async (req, res) => {
    try {
      const { ownerId } = req.params; // Perbaikan destrukturisasi

      if (!ownerId) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pemilik diperlukan, tetapi tidak disediakan.",
        });
      }

      // Cari water credits berdasarkan owner.id
      const waterCredits = await WaterCredits.find({ "owner.id": ownerId });
      if (waterCredits.length === 0) {
        return res.status(404).json({
          status: 404,
          message:
            "Tidak ada kredit air yang ditemukan untuk ID pemilik yang diberikan.",
        });
      }

      // Kirim respons dengan data yang ditemukan
      res.status(200).json({
        status: 200,
        data: waterCredits,
        message: `${waterCredits.length} ${
          waterCredits.length === 1 ? "Kredit air" : "Kredit air"
        } ditemukan.`,
      });
    } catch (error) {
      // Tangani error dan kirimkan respons
      res.status(500).json({
        status: 500,
        pesan: "Terjadi kesalahan saat mengambil kredit air.",
        error: error.message,
      });
    }
  },
];

export const createWaterCredit = [
  verifyToken,
  async (req, res) => {
    try {
      const {
        owner,
        cost,
        perLiter,
        billingTime,
        conservationToken,
        waterQuality,
        income,
        totalIncome,
        withdrawl,
        totalUser,
        location,
      } = req.body;

      // Validasi input
      if (!owner || !cost || !perLiter || !location) {
        return res.status(400).json({
          status: 400,
          pesan: "Kolom yang diperlukan tidak lengkap.",
        });
      }

      // Buat dokumen baru
      const newWaterCredit = new WaterCredits({
        owner,
        cost,
        perLiter,
        billingTime,
        conservationToken,
        waterQuality,
        income,
        totalIncome,
        withdrawl,
        totalUser,
        location,
      });

      // Simpan ke database
      await newWaterCredit.save();

      res.status(201).json({
        status: 201,
        pesan: "Kredit air berhasil dibuat.",
        data: newWaterCredit,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        pesan: "Terjadi kesalahan saat membuat kredit air.",
        error: error.message,
      });
    }
  },
];

export const editWaterCredit = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params; // Ambil ID dari parameter
      const updates = req.body; // Data yang akan diupdate

      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID diperlukan, tetapi tidak disediakan.",
        });
      }

      // Update dokumen
      const updatedWaterCredit = await WaterCredits.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      );

      if (!updatedWaterCredit) {
        return res.status(404).json({
          status: 404,
          pesan: "Kredit air tidak ditemukan.",
        });
      }

      res.status(200).json({
        status: 200,
        pesan: "Kredit air berhasil diperbarui.",
        data: updatedWaterCredit,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        pesan: "Terjadi kesalahan saat memperbarui kredit air.",
        error: error.message,
      });
    }
  },
];

export const deleteWaterCredit = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID diperlukan, tetapi tidak disediakan.",
        });
      }

      // Hapus dokumen
      const deletedWaterCredit = await WaterCredits.findByIdAndDelete(id);

      if (!deletedWaterCredit) {
        return res.status(404).json({
          status: 404,
          pesan: "Kredit air tidak ditemukan.",
        });
      }

      res.status(200).json({
        status: 200,
        pesan: "Kredit air berhasil dihapus.",
        data: deletedWaterCredit,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        pesan: "Terjadi kesalahan saat menghapus kredit air.",
        error: error.message,
      });
    }
  },
];

export const getAllWaterCredit = [
  verifyToken,
  async (req, res) => {
    try {
      const waterCredits = await WaterCredits.find();

      if (waterCredits.length === 0) {
        return res.status(404).json({
          status: 404,
          pesan: "Belum ada data",
        });
      }

      res.status(200).json({
        status: 200,
        data: waterCredits,
        pesan: "Kredit air ditemukan",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        pesan: "Terjadi kesalahan saat mengambil kredit air.",
        error: error.message,
      });
    }
  },
];

export const getWaterCreditById = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Kredit Air diperlukan, tetapi tidak disediakan",
        });
      }

      const waterCredit = await WaterCredits.findById(id);

      if (!waterCredit) {
        return res.status(404).json({
          status: 404,
          pesan: "Kredit Air tidak ditemukan",
        });
      }

      return res.status(200).json({
        status: 200,
        data: waterCredit,
        pesan: "Kredit Air ditemukan",
      });
    } catch (err) {
      return res.status(500).json({
        status: 500,
        pesan: "Kesalahan Server Internal",
      });
    }
  },
];
