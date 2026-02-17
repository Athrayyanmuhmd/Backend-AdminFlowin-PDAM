import ConnectionData from "../models/ConnectionData.js";
import User from "../models/User.js";
import { uploadPdfAsImage } from "../utils/cloudinary.js";

// Create Connection Data (User)
export const createConnectionData = async (req, res) => {
  try {
    const { nik, noKK, alamat, kecamatan, kelurahan, noImb, luasBangunan } =
      req.body;

    const userId = req.user.userId;
    console.log(userId);

    // Check if user exists and has phone number
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 404,
        pesan: "User not found",
      });
    }

    if (!user.noHP) {
      return res.status(400).json({
        status: 400,
        message:
          "Nomor HP harus diisi terlebih dahulu. Silakan lengkapi profil Anda di menu Edit Profil.",
      });
    }

    // Check if user already has connection data
    const existingConnection = await ConnectionData.findOne({ userId });
    if (existingConnection) {
      return res.status(400).json({
        status: 400,
        pesan: "User already has connection data",
      });
    }

    // Check if files are uploaded
    if (
      !req.files ||
      !req.files.nikFile ||
      !req.files.kkFile ||
      !req.files.imbFile
    ) {
      return res.status(400).json({
        status: 400,
        pesan: "All PDF files (NIK, KK, IMB) are required",
      });
    }

    // Upload PDF/image files to Cloudinary
    const nikUrl = await uploadPdfAsImage(
      req.files.nikFile[0].buffer,
      "aqualink/nik",
      req.files.nikFile[0].mimetype
    );
    const kkUrl = await uploadPdfAsImage(
      req.files.kkFile[0].buffer,
      "aqualink/kk",
      req.files.kkFile[0].mimetype
    );
    const imbUrl = await uploadPdfAsImage(
      req.files.imbFile[0].buffer,
      "aqualink/imb",
      req.files.imbFile[0].mimetype
    );

    const connectionData = new ConnectionData({
      userId,
      nik,
      nikUrl,
      noKK,
      kkUrl,
      alamat,
      kecamatan,
      kelurahan,
      noImb,
      imbUrl,
      luasBangunan: parseInt(luasBangunan),
    });

    await connectionData.save();

    // Update User's SambunganDataId
    user.SambunganDataId = connectionData._id;
    await user.save();

    res.status(201).json({
      status: 201,
      pesan: "Connection data created successfully",
      data: connectionData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Connection Data by User ID
export const getConnectionDataByUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    const connectionData = await ConnectionData.findOne({ userId })
      .populate("userId", "email namaLengkap phone")
      .populate("surveiId")
      .populate("rabConnectionId")
      .populate("idMeteran");

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: connectionData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get All Connection Data (Admin)
export const getAllConnectionData = async (req, res) => {
  try {
    console.log(
      "[getAllConnectionData] Request from:",
      req.userRole || "unknown"
    );
    console.log(
      "[getAllConnectionData] User ID:",
      req.userId || req.technicianId
    );

    const {
      isVerifiedByData,
      isVerifiedByTechnician,
      isAllProcedureDone,
      assignedTechnicianId,
    } = req.query;

    let filter = {};
    if (isVerifiedByData !== undefined)
      filter.isVerifiedByData = isVerifiedByData === "true";
    if (isVerifiedByTechnician !== undefined)
      filter.isVerifiedByTechnician = isVerifiedByTechnician === "true";
    if (isAllProcedureDone !== undefined)
      filter.isAllProcedureDone = isAllProcedureDone === "true";

    // Filter by assigned technician (untuk teknisi lihat tugas mereka)
    if (assignedTechnicianId) {
      filter.assignedTechnicianId = assignedTechnicianId;
    }

    // Jika request dari teknisi, auto filter hanya tugas yang di-assign ke dia
    if (req.userRole === "technician" && req.technicianId) {
      filter.assignedTechnicianId = req.technicianId;
    }

    console.log("[getAllConnectionData] Filter:", filter);

    const connectionData = await ConnectionData.find(filter)
      .populate("userId", "email namaLengkap phone")
      .populate("assignedTechnicianId", "namaLengkap email phone")
      .populate("surveiId")
      .populate("rabConnectionId")
      .populate("idMeteran");

    console.log(
      "[getAllConnectionData] Found",
      connectionData.length,
      "records"
    );

    res.status(200).json({
      status: 200,
      data: connectionData,
    });
  } catch (error) {
    console.error("[getAllConnectionData] Error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Connection Data by ID (Admin/Technician)
export const getConnectionDataById = async (req, res) => {
  try {
    console.log(
      "[getConnectionDataById] Request from:",
      req.userRole || "unknown"
    );
    console.log(
      "[getConnectionDataById] User ID:",
      req.userId || req.technicianId
    );

    const { id } = req.params;
    console.log("[getConnectionDataById] Connection Data ID:", id);

    const connectionData = await ConnectionData.findById(id)
      .populate("userId", "email namaLengkap phone")
      .populate("assignedTechnicianId", "namaLengkap email phone")
      .populate("surveiId")
      .populate("rabConnectionId")
      .populate("idMeteran");

    if (!connectionData) {
      console.log("[getConnectionDataById] Connection data not found");
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    console.log(
      "[getConnectionDataById] Connection data found:",
      connectionData._id
    );

    res.status(200).json({
      status: 200,
      data: connectionData,
    });
  } catch (error) {
    console.error("[getConnectionDataById] Error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Verify Connection Data by Admin
export const verifyConnectionDataByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const connectionData = await ConnectionData.findById(id);

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    connectionData.isVerifiedByData = true;
    await connectionData.save();

    res.status(200).json({
      status: 200,
      pesan: "Connection data verified by admin successfully",
      data: connectionData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Verify Connection Data by Technician
export const verifyConnectionDataByTechnician = async (req, res) => {
  try {
    const { id } = req.params;

    const connectionData = await ConnectionData.findById(id);

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    if (!connectionData.isVerifiedByData) {
      return res.status(400).json({
        status: 400,
        pesan: "Connection data must be verified by admin first",
      });
    }

    connectionData.isVerifiedByTechnician = true;
    await connectionData.save();

    res.status(200).json({
      status: 200,
      pesan: "Connection data verified by technician successfully",
      data: connectionData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Complete All Procedure (Admin)
export const completeAllProcedure = async (req, res) => {
  try {
    const { id } = req.params;

    const connectionData = await ConnectionData.findById(id);

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    // Check if RAB is paid
    if (connectionData.rabConnectionId) {
      const RabConnection = (await import("../models/RabConnection.js"))
        .default;
      const rab = await RabConnection.findById(connectionData.rabConnectionId);

      if (!rab || rab.statusPembayaran !== 'Settlement') {
        return res.status(400).json({
          status: 400,
          pesan: "RAB must be paid first",
        });
      }
    } else {
      return res.status(400).json({
        status: 400,
        pesan: "RAB connection not created yet",
      });
    }

    connectionData.isAllProcedureDone = true;
    await connectionData.save();

    res.status(200).json({
      status: 200,
      pesan: "All procedure completed successfully",
      data: connectionData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Update Connection Data
export const updateConnectionData = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle PDF/image file uploads if provided
    if (req.files) {
      if (req.files.nikFile) {
        updates.nikUrl = await uploadPdfAsImage(
          req.files.nikFile[0].buffer,
          "aqualink/nik",
          req.files.nikFile[0].mimetype
        );
      }
      if (req.files.kkFile) {
        updates.kkUrl = await uploadPdfAsImage(
          req.files.kkFile[0].buffer,
          "aqualink/kk",
          req.files.kkFile[0].mimetype
        );
      }
      if (req.files.imbFile) {
        updates.imbUrl = await uploadPdfAsImage(
          req.files.imbFile[0].buffer,
          "aqualink/imb",
          req.files.imbFile[0].mimetype
        );
      }
    }

    // Convert luasBangunan to number if provided
    if (updates.luasBangunan) {
      updates.luasBangunan = parseInt(updates.luasBangunan);
    }

    const connectionData = await ConnectionData.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "Connection data updated successfully",
      data: connectionData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Assign Technician to Connection Data (Admin only)
export const assignTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;

    console.log("[assignTechnician] Connection Data ID:", id);
    console.log("[assignTechnician] Technician ID:", technicianId);
    console.log("[assignTechnician] Admin ID:", req.userId);

    const connectionData = await ConnectionData.findById(id);

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    // Check if data is verified by admin first
    if (!connectionData.isVerifiedByData) {
      return res.status(400).json({
        status: 400,
        pesan: "Data must be verified by admin before assigning technician",
      });
    }

    // Check if already has survey (teknisi sudah mulai kerja)
    if (connectionData.surveiId) {
      return res.status(400).json({
        status: 400,
        pesan: "Survey already exists, cannot reassign technician",
      });
    }

    // Update assignment
    connectionData.assignedTechnicianId = technicianId;
    connectionData.assignedAt = new Date();
    connectionData.assignedBy = req.userId;

    await connectionData.save();

    // Populate for response
    await connectionData.populate(
      "assignedTechnicianId",
      "namaLengkap email phone"
    );
    await connectionData.populate("assignedBy", "email");

    console.log("[assignTechnician] Assignment successful");

    res.status(200).json({
      status: 200,
      pesan: "Technician assigned successfully",
      data: connectionData,
    });
  } catch (error) {
    console.error("[assignTechnician] Error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Unassign Technician from Connection Data (Admin only)
export const unassignTechnician = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[unassignTechnician] Connection Data ID:", id);

    const connectionData = await ConnectionData.findById(id);

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    // Check if already has survey
    if (connectionData.surveiId) {
      return res.status(400).json({
        status: 400,
        pesan: "Cannot unassign technician after survey is created",
      });
    }

    // Remove assignment
    connectionData.assignedTechnicianId = null;
    connectionData.assignedAt = null;
    connectionData.assignedBy = null;

    await connectionData.save();

    console.log("[unassignTechnician] Unassignment successful");

    res.status(200).json({
      status: 200,
      pesan: "Technician unassigned successfully",
      data: connectionData,
    });
  } catch (error) {
    console.error("[unassignTechnician] Error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Delete Connection Data
export const deleteConnectionData = async (req, res) => {
  try {
    const { id } = req.params;

    const connectionData = await ConnectionData.findById(id);

    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    // Remove reference from User
    await User.findByIdAndUpdate(connectionData.userId, {
      SambunganDataId: null,
    });

    await ConnectionData.findByIdAndDelete(id);

    res.status(200).json({
      status: 200,
      pesan: "Connection data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};
