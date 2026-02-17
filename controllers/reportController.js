import Reports from "../models/Report.js";
import { verifyToken } from "../middleware/auth.js";
import mongoose from "mongoose";

// CREATE REPORT
export const createReport = [
  verifyToken,
  async (req, res) => {
    try {
      const { idPengguna, namaLaporan, masalah, alamat, koordinat } =
        req.body;

      // Validasi input
      if (!idPengguna || !namaLaporan || !masalah || !alamat || !koordinat) {
        return res.status(400).json({
          status: 400,
          pesan: "Semua kolom harus diisi.",
        });
      }
      if (!koordinat.longitude || !koordinat.latitude) {
        return res.status(400).json({
          status: 400,
          pesan: "Longitude dan latitude diperlukan.",
        });
      }

      const newReport = new Reports(req.body);
      const savedReport = await newReport.save();

      res.status(201).json({
        status: 201,
        data: savedReport,
        pesan: "Laporan berhasil dibuat",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

// GET ALL REPORTS
export const getAllReports = [
  verifyToken,
  async (req, res) => {
    try {
      const reports = await Reports.find();
      if (reports.length === 0) {
        return res.status(404).json({
          status: 404,
          pesan: "Laporan tidak ditemukan",
        });
      }
      res.status(200).json({
        status: 200,
        data: reports,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

// EDIT REPORT
export const editReport = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validasi ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: 400,
          pesan: "ID laporan tidak valid.",
        });
      }

      const updatedReport = await Reports.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!updatedReport) {
        return res.status(404).json({
          status: 404,
          pesan: "Laporan tidak ditemukan.",
        });
      }

      res.status(200).json({
        status: 200,
        data: updatedReport,
        pesan: "Laporan berhasil diperbarui",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

// DELETE REPORT
export const deleteReport = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validasi ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: 400,
          pesan: "ID laporan tidak valid.",
        });
      }

      const deletedReport = await Reports.findByIdAndDelete(id);
      if (!deletedReport) {
        return res.status(404).json({
          status: 404,
          pesan: "Laporan tidak ditemukan.",
        });
      }

      res.status(200).json({
        status: 200,
        data: deletedReport,
        pesan: "Laporan berhasil dihapus.",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];

// GET BY REPORTER ID
export const getByReporterID = [
  verifyToken,
  async (req, res) => {
    try {
      const { idPengguna } = req.params;

      // Validasi input
      if (!idPengguna) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pelapor diperlukan.",
        });
      }

      // Mencari laporan berdasarkan idPengguna
      const reports = await Reports.find({ idPengguna });

      if (reports.length === 0) {
        return res.status(404).json({
          status: 404,
          message:
            "Tidak ada laporan yang ditemukan untuk ID Pelapor tersebut.",
        });
      }

      res.status(200).json({
        status: 200,
        data: reports,
        pesan: "Laporan ditemukan",
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: error.message,
      });
    }
  },
];
