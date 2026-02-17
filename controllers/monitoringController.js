import HistoryUsage from "../models/HistoryUsage.js";
import Meteran from "../models/Meteran.js";

/**
 * Get monitoring statistics for a user's meter
 * Includes: average daily usage, usage comparison with last month
 */
export const getMonitoringStats = async (req, res) => {
  try {
    const { userId, meteranId } = req.params;

    // Get meteran data
    const meteran = await Meteran.findOne({ _id: meteranId, userId });
    if (!meteran) {
      return res.status(404).json({
        status: "error",
        pesan: "Meteran not found",
      });
    }

    // Get current month usage history
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const currentMonthHistory = await HistoryUsage.find({
      userId,
      meteranId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // Get last month usage history
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59
    );

    const lastMonthHistory = await HistoryUsage.find({
      userId,
      meteranId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Calculate current month total
    const currentMonthTotal = currentMonthHistory.reduce(
      (sum, record) => sum + record.usedWater,
      0
    );

    // Calculate last month total
    const lastMonthTotal = lastMonthHistory.reduce(
      (sum, record) => sum + record.usedWater,
      0
    );

    // Calculate average daily usage (current month)
    const daysInCurrentMonth = now.getDate(); // Days elapsed in current month
    const averageDailyUsage =
      daysInCurrentMonth > 0 ? currentMonthTotal / daysInCurrentMonth : 0;

    // Calculate usage comparison percentage
    let comparisonPercentage = 0;
    let comparisonStatus = "sama"; // "naik", "turun", "sama"

    if (lastMonthTotal > 0) {
      comparisonPercentage =
        ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

      if (comparisonPercentage > 0) {
        comparisonStatus = "naik";
      } else if (comparisonPercentage < 0) {
        comparisonStatus = "turun";
        comparisonPercentage = Math.abs(comparisonPercentage); // Make positive for display
      }
    }

    // Calculate predicted usage for rest of month
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const remainingDays = daysInMonth - daysInCurrentMonth;
    const predictedUsage = averageDailyUsage * remainingDays;

    return res.status(200).json({
      status: "success",
      data: {
        currentMonth: {
          totalUsage: parseFloat(currentMonthTotal.toFixed(2)),
          averageDailyUsage: parseFloat(averageDailyUsage.toFixed(2)),
          daysElapsed: daysInCurrentMonth,
          daysInMonth,
        },
        lastMonth: {
          totalUsage: parseFloat(lastMonthTotal.toFixed(2)),
        },
        comparison: {
          percentage: parseFloat(comparisonPercentage.toFixed(1)),
          status: comparisonStatus, // "naik" or "turun" or "sama"
          message:
            comparisonStatus === "turun"
              ? `Hemat ${comparisonPercentage.toFixed(0)}% dari bulan lalu`
              : comparisonStatus === "naik"
              ? `Naik ${comparisonPercentage.toFixed(0)}% dari bulan lalu`
              : "Sama dengan bulan lalu",
        },
        prediction: {
          remainingDays,
          predictedUsage: parseFloat(predictedUsage.toFixed(2)),
          totalProjected: parseFloat(
            (currentMonthTotal + predictedUsage).toFixed(2)
          ),
        },
        meteran: {
          totalPemakaian: meteran.totalPemakaian,
          pemakaianBelumTerbayar: meteran.pemakaianBelumTerbayar,
        },
      },
    });
  } catch (error) {
    console.error("Error getting monitoring stats:", error);
    return res.status(500).json({
      status: "error",
      pesan: "Failed to get monitoring statistics",
      error: error.message,
    });
  }
};
