import HistoryUsage from "../models/HistoryUsage.js";
import Meteran from "../models/Meteran.js";
import Notification from "../models/Notification.js";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import mongoose from "mongoose";

const TZ = "Asia/Jakarta";

/**
 * Helper: Ambil range minggu ini (Senin 00:00 - Minggu 23:59) dalam UTC
 */
const getCurrentWeekRange = () => {
  const now = new Date();

  // Convert UTC → WIB
  const nowJakarta = toZonedTime(now, TZ);

  const day = nowJakarta.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const diff = day === 0 ? 6 : day - 1; // Senin jadi awal minggu

  // Awal minggu (Senin 00:00 WIB)
  const startJakarta = new Date(nowJakarta);
  startJakarta.setDate(nowJakarta.getDate() - diff);
  startJakarta.setHours(0, 0, 0, 0);

  // Akhir minggu (Minggu 23:59 WIB)
  const endJakarta = new Date(startJakarta);
  endJakarta.setDate(startJakarta.getDate() + 6);
  endJakarta.setHours(23, 59, 59, 999);

  // Convert WIB → UTC untuk query MongoDB
  return {
    startDate: fromZonedTime(startJakarta, TZ),
    endDate: fromZonedTime(endJakarta, TZ),
  };
};

// Create History Usage from IoT (IoT Device/System)
// Supports both single and batch (array) insert
export const createHistoryUsage = async (req, res) => {
  try {
    const { userId, meteranId } = req.params;
    const { penggunaanAir, data } = req.body;

    // Validasi meteran exists
    const meteran = await Meteran.findById(meteranId);
    if (!meteran) {
      return res.status(404).json({
        status: 404,
        pesan: "Meteran tidak ditemukan",
      });
    }

    // Validasi meteran belongs to user
    if (meteran.userId.toString() !== userId) {
      return res.status(403).json({
        status: 403,
        pesan: "Meteran tidak sesuai dengan user",
      });
    }

    let savedRecords = [];
    let totalWater = 0;

    // Case 1: Batch insert (array of objects)
    if (data && Array.isArray(data) && data.length > 0) {
      // Validate array elements
      const invalidData = data.find(
        (item) => !item.penggunaanAir || typeof item.penggunaanAir !== "number"
      );

      if (invalidData) {
        return res.status(400).json({
          status: 400,
          pesan: "Setiap item dalam array harus memiliki penggunaanAir (number)",
        });
      }

      // Prepare bulk insert documents
      const historyDocuments = data.map((item) => ({
        userId,
        meteranId,
        penggunaanAir: item.penggunaanAir,
        createdAt: item.timestamp ? new Date(item.timestamp) : new Date(),
      }));

      // Bulk insert
      savedRecords = await HistoryUsage.insertMany(historyDocuments);

      // Calculate total water
      totalWater = data.reduce((sum, item) => sum + item.penggunaanAir, 0);

      console.log(
        `✅ Batch insert: ${savedRecords.length} records, total: ${totalWater}L`
      );
    }
    // Case 2: Single insert (backward compatibility)
    else if (penggunaanAir && typeof penggunaanAir === "number") {
      const historyUsage = new HistoryUsage({
        userId,
        meteranId,
        penggunaanAir,
      });

      await historyUsage.save();
      savedRecords = [historyUsage];
      totalWater = penggunaanAir;

      console.log(`✅ Single insert: ${totalWater}L`);
    }
    // Case 3: Invalid request
    else {
      return res.status(400).json({
        status: 400,
        pesan: "Harus menyertakan 'penggunaanAir' (number) atau 'data' (array)",
      });
    }

    // Update total pemakaian di meteran (akumulasi)
    meteran.totalPemakaian += totalWater;
    meteran.pemakaianBelumTerbayar += totalWater;
    await meteran.save();

    res.status(201).json({
      status: 201,
      message: `Data pemakaian air berhasil disimpan (${savedRecords.length} record)`,
      data: {
        count: savedRecords.length,
        totalWater: totalWater,
        records: savedRecords,
      },
    });
  } catch (error) {
    console.error("Error createHistoryUsage:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get History Usage with Filter (Time-series aggregation)
export const getHistories = async (req, res) => {
  try {
    const filter = req.query.filter ?? "hari";
    const { userId, meteranId } = req.params;

    if (!userId || !meteranId) {
      return res.status(400).json({
        status: 400,
        pesan: "ID user dan ID meteran dibutuhkan, tetapi tidak tersedia",
      });
    }

    // Convert string IDs to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const meteranObjectId = new mongoose.Types.ObjectId(meteranId);

    let startDate;
    let endDate;
    let groupBy;

    switch (filter) {
      case "hari": {
        const now = new Date();
        const todayJakarta = toZonedTime(now, TZ);

        todayJakarta.setHours(0, 0, 0, 0);
        const endJakarta = new Date(todayJakarta);
        endJakarta.setHours(23, 59, 59, 999);

        startDate = fromZonedTime(todayJakarta, TZ);
        endDate = fromZonedTime(endJakarta, TZ);

        groupBy = {
          _id: {
            time: {
              $dateToString: {
                format: "%H:00",
                date: "$createdAt",
                timezone: TZ,
              },
            },
          },
          totalUsedWater: { $sum: "$penggunaanAir" },
        };
        break;
      }

      case "minggu": {
        ({ startDate, endDate } = getCurrentWeekRange());

        groupBy = {
          _id: { day: { $dayOfWeek: "$createdAt" } },
          totalUsedWater: { $sum: "$penggunaanAir" },
        };
        break;
      }

      case "bulan": {
        const now = new Date();
        const startJakarta = toZonedTime(now, TZ);

        startJakarta.setDate(1);
        startJakarta.setHours(0, 0, 0, 0);

        const endJakarta = new Date(startJakarta);
        endJakarta.setMonth(endJakarta.getMonth() + 1);
        endJakarta.setDate(0);
        endJakarta.setHours(23, 59, 59, 999);

        startDate = fromZonedTime(startJakarta, TZ);
        endDate = fromZonedTime(endJakarta, TZ);

        groupBy = {
          _id: { week: { $week: "$createdAt" } },
          totalUsedWater: { $sum: "$penggunaanAir" },
        };
        break;
      }

      case "tahun": {
        const now = new Date();
        const startJakarta = toZonedTime(now, TZ);

        startJakarta.setMonth(0, 1);
        startJakarta.setHours(0, 0, 0, 0);

        const endJakarta = new Date(startJakarta);
        endJakarta.setFullYear(endJakarta.getFullYear() + 1);
        endJakarta.setMonth(0, 0);
        endJakarta.setHours(23, 59, 59, 999);

        startDate = fromZonedTime(startJakarta, TZ);
        endDate = fromZonedTime(endJakarta, TZ);

        groupBy = {
          _id: { month: { $month: "$createdAt" } },
          totalUsedWater: { $sum: "$penggunaanAir" },
        };
        break;
      }

      default:
        return res.status(400).json({
          status: 400,
          message:
            "Filter tidak valid. Gunakan 'hari', 'minggu', 'bulan', atau 'tahun'",
        });
    }

    // Query histories
    const histories = await HistoryUsage.aggregate([
      {
        $match: {
          userId: userObjectId,
          meteranId: meteranObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: groupBy },
      { $sort: { _id: 1 } },
    ]);

    // Mapping hasil
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    let mappedHistories = histories.map((item) => {
      if (filter === "minggu") {
        return { ...item, _id: { day: days[item._id.day - 1] } };
      }
      if (filter === "tahun") {
        return { ...item, _id: { month: months[item._id.month - 1] } };
      }
      if (filter === "bulan") {
        return { ...item, _id: { week: `Minggu ke-${item._id.week}` } };
      }
      return item;
    });

    if (filter === "minggu") {
      const existingDays = mappedHistories.map((item) => item._id.day);
      days.forEach((day) => {
        if (!existingDays.includes(day)) {
          mappedHistories.push({
            _id: { day },
            totalUsedWater: 0,
          });
        }
      });
      mappedHistories.sort(
        (a, b) => days.indexOf(a._id.day) - days.indexOf(b._id.day)
      );
    }

    // Total penggunaan air hari ini
    const now2 = new Date();
    const todayJakarta = toZonedTime(now2, TZ);
    todayJakarta.setHours(0, 0, 0, 0);
    const endTodayJakarta = new Date(todayJakarta);
    endTodayJakarta.setHours(23, 59, 59, 999);

    const todayUTC = fromZonedTime(todayJakarta, TZ);
    const endTodayUTC = fromZonedTime(endTodayJakarta, TZ);

    const totalUsageToday = await HistoryUsage.aggregate([
      {
        $match: {
          userId: userObjectId,
          meteranId: meteranObjectId,
          createdAt: { $gte: todayUTC, $lte: endTodayUTC },
        },
      },
      { $group: { _id: null, totalUsedWater: { $sum: "$penggunaanAir" } } },
    ]);

    // Check for high usage warning
    let notification = null;
    if (
      totalUsageToday.length > 0 &&
      totalUsageToday[0].totalUsedWater >= 500
    ) {
      const existingNotification = await Notification.findOne({
        userId,
        judul: "Peringatan Penggunaan Air Berlebih!",
        createdAt: { $gte: todayUTC },
        kategori: "Informasi",
      });

      if (!existingNotification) {
        notification = new Notification({
          userId,
          judul: "Peringatan Penggunaan Air Berlebih!",
          message: `Penggunaan air Anda hari ini telah mencapai ${totalUsageToday[0].totalUsedWater} liter. Harap hemat air!`,
          kategori: "Informasi",
        });
        await notification.save();
      }
    }

    res.status(200).json({
      status: 200,
      filter,
      data: mappedHistories,
      notification: notification ? notification : null,
      totalUsageToday:
        totalUsageToday.length > 0 ? totalUsageToday[0].totalUsedWater : 0,
    });
  } catch (error) {
    console.error("Error in getHistories:", error);
    res.status(500).json({
      status: 500,
      pesan: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// Get All History Usage (Admin) - Raw data
export const getAllHistoryUsage = async (req, res) => {
  try {
    const { userId, meteranId, startDate, endDate, limit } = req.query;

    let filter = {};
    if (userId) filter.userId = userId;
    if (meteranId) filter.meteranId = meteranId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const query = HistoryUsage.find(filter)
      .populate("userId", "namaLengkap email")
      .populate("meteranId", "nomorMeteran kelompokPelangganId")
      .sort({ createdAt: -1 });

    if (limit) {
      query.limit(parseInt(limit));
    }

    const historyUsage = await query;

    res.status(200).json({
      status: 200,
      count: historyUsage.length,
      data: historyUsage,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Delete History Usage (Admin)
export const deleteHistoryUsage = async (req, res) => {
  try {
    const { id } = req.params;

    const historyUsage = await HistoryUsage.findByIdAndDelete(id);

    if (!historyUsage) {
      return res.status(404).json({
        status: 404,
        pesan: "History usage tidak ditemukan",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "History usage berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};
