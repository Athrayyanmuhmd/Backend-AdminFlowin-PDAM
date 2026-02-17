import Notification from "../models/Notification.js";

export const getNotificationsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { selectedDate } = req.query;

    // Validate if userId exists
    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, pesan: "ID Pengguna diperlukan" });
    }

    // Validate if userId is a valid format
    if (userId.length < 5) {
      return res
        .status(400)
        .json({ status: 400, pesan: "Format ID Pengguna tidak valid" });
    }

    // Build query object
    let query = { userId };

    // Add date filtering if date is selected
    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // Check if notifications exist for this user, sorted by newest first
    const notifications = await Notification.find(query).sort({
      createdAt: -1,
    });

    if (notifications.length === 0) {
      return res.status(404).json({
        status: 404,
        pesan: "Tidak ada notifikasi ditemukan untuk pengguna ini",
      });
    }

    res.status(200).json({
      status: 200,
      data: notifications,
      pesan: "Notifikasi ditemukan",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      pesan: "Kesalahan Server Internal",
    });
  }
};
