import Meteran from "../models/Meteran.js";
import User from "../models/User.js";
import ConnectionData from "../models/ConnectionData.js";

// Create Meteran (Admin)
export const createMeteran = async (req, res) => {
  try {
    const {
      nomorMeteran,
      kelompokPelangganId,
      userId,
      connectionDataId,
      totalPemakaian,
      pemakaianBelumTerbayar,
      jatuhTempo,
    } = req.body;

    // Check if connection data exists
    const connectionData = await ConnectionData.findById(connectionDataId);
    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    // Check if RAB exists (RAB must be created before meteran)
    if (!connectionData.rabConnectionId) {
      return res.status(400).json({
        status: 400,
        pesan: "RAB must be created first",
      });
    }

    // Check if meteran already exists for this connection data
    const existingMeteran = await Meteran.findOne({ connectionDataId });
    if (existingMeteran) {
      return res.status(400).json({
        status: 400,
        pesan: "Meteran already exists for this connection data",
      });
    }

    // Check if meteran number already exists
    const existingMeteranNumber = await Meteran.findOne({ nomorMeteran });
    if (existingMeteranNumber) {
      return res.status(400).json({
        status: 400,
        pesan: "Meteran number already exists",
      });
    }

    const meteran = new Meteran({
      nomorMeteran,
      kelompokPelangganId,
      userId,
      connectionDataId,
      totalPemakaian: totalPemakaian || 0,
      pemakaianBelumTerbayar: pemakaianBelumTerbayar || 0,
      jatuhTempo: jatuhTempo || null,
    });

    await meteran.save();

    // Update connection data with meteran ID
    connectionData.meteranId = meteran._id;
    await connectionData.save();

    // Update user with meteran ID, connection data ID, and verify user
    const user = await User.findById(userId);
    user.meteranId = meteran._id;
    user.SambunganDataId = connectionDataId;
    user.isVerified = true;
    await user.save();

    // Populate before returning
    const populatedMeteran = await Meteran.findById(meteran._id)
      .populate("kelompokPelangganId")
      .populate("userId", "email fullName noHp")
      .populate("connectionDataId", "nik alamat");

    res.status(201).json({
      status: 201,
      pesan: "Meteran created successfully",
      data: populatedMeteran,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get All Meteran (Admin)
export const getAllMeteran = async (req, res) => {
  try {
    const meteran = await Meteran.find()
      .populate("kelompokPelangganId")
      .populate("userId", "email fullName noHp")
      .populate("connectionDataId", "nik alamat");

    res.status(200).json({
      status: 200,
      data: meteran,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Meteran by ID
export const getMeteranById = async (req, res) => {
  try {
    const { id } = req.params;

    const meteran = await Meteran.findById(id)
      .populate("kelompokPelangganId")
      .populate("userId", "email fullName noHp")
      .populate("connectionDataId", "nik alamat");

    if (!meteran) {
      return res.status(404).json({
        status: 404,
        pesan: "Meteran not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: meteran,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Meteran by User ID
export const getMeteranByUserId = async (req, res) => {
  try {
    const userId = req.user.userId;

    const meteran = await Meteran.findOne({ userId })
      .populate("kelompokPelangganId")
      .populate("userId", "email fullName phone");

    if (!meteran) {
      return res.status(404).json({
        status: 404,
        pesan: "Meteran not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: meteran,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Update Meteran (Admin)
export const updateMeteran = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const meteran = await Meteran.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!meteran) {
      return res.status(404).json({
        status: 404,
        pesan: "Meteran not found",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "Meteran updated successfully",
      data: meteran,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Delete Meteran (Admin)
export const deleteMeteran = async (req, res) => {
  try {
    const { id } = req.params;

    const meteran = await Meteran.findByIdAndDelete(id);

    if (!meteran) {
      return res.status(404).json({
        status: 404,
        pesan: "Meteran not found",
      });
    }

    // Update user
    await User.findByIdAndUpdate(meteran.userId, {
      meteranId: null,
    });

    res.status(200).json({
      status: 200,
      pesan: "Meteran deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};
