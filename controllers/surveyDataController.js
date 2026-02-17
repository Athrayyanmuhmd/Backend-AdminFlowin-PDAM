import SurveyData from "../models/SurveyData.js";
import ConnectionData from "../models/ConnectionData.js";
import { uploadPdfAsImage } from "../utils/cloudinary.js";

// Create Survey Data (Technician)
export const createSurveyData = async (req, res) => {
  try {
    const {
      connectionDataId,
      diameterPipa,
      jumlahPenghuni,
      koordinatLat,
      koordinatLong,
      standar,
      catatan,
    } = req.body;

    console.log(
      "[createSurveyData] Request from technician:",
      req.technicianId
    );
    console.log("[createSurveyData] Connection Data ID:", connectionDataId);

    // Check if connection data exists and verified by admin
    const connectionData = await ConnectionData.findById(connectionDataId);
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

    // Check if technician is assigned to this connection data
    if (!connectionData.assignedTechnicianId) {
      return res.status(403).json({
        status: 403,
        message:
          "This connection data has not been assigned to any technician yet",
      });
    }

    console.log("[createSurveyData] Checking assignment...");
    console.log(
      "[createSurveyData] Assigned technician ID:",
      connectionData.assignedTechnicianId
    );
    console.log("[createSurveyData] Request technician ID:", req.technicianId);
    console.log(
      "[createSurveyData] Assigned (string):",
      connectionData.assignedTechnicianId.toString()
    );
    console.log(
      "[createSurveyData] Request (string):",
      req.technicianId.toString()
    );

    if (
      connectionData.assignedTechnicianId.toString() !==
      req.technicianId.toString()
    ) {
      return res.status(403).json({
        status: 403,
        pesan: "You are not assigned to this connection data",
      });
    }

    console.log(
      "[createSurveyData] Assignment verified for technician:",
      req.technicianId
    );

    // Check if survey already exists
    const existingSurvey = await SurveyData.findOne({ connectionDataId });
    if (existingSurvey) {
      return res.status(400).json({
        status: 400,
        pesan: "Survey data already exists for this connection",
      });
    }

    // Check if files are uploaded
    if (
      !req.files ||
      !req.files.jaringanFile ||
      !req.files.posisiBakFile ||
      !req.files.posisiMeteranFile
    ) {
      return res.status(400).json({
        status: 400,
        message:
          "All files (jaringan, posisi bak, posisi meteran) are required",
      });
    }

    // Upload PDF/image files to Cloudinary
    const jaringanUrl = await uploadPdfAsImage(
      req.files.jaringanFile[0].buffer,
      "aqualink/survey/jaringan",
      req.files.jaringanFile[0].mimetype
    );
    const posisiBakUrl = await uploadPdfAsImage(
      req.files.posisiBakFile[0].buffer,
      "aqualink/survey/bak",
      req.files.posisiBakFile[0].mimetype
    );
    const posisiMeteranUrl = await uploadPdfAsImage(
      req.files.posisiMeteranFile[0].buffer,
      "aqualink/survey/meteran",
      req.files.posisiMeteranFile[0].mimetype
    );

    const surveyData = new SurveyData({
      connectionDataId,
      userId: connectionData.userId,
      technicianId: req.technicianId,
      jaringanUrl,
      diameterPipa: parseInt(diameterPipa),
      posisiBakUrl,
      posisiMeteranUrl,
      jumlahPenghuni: parseInt(jumlahPenghuni),
      koordinat: {
        lat: parseFloat(koordinatLat),
        long: parseFloat(koordinatLong),
      },
      standar: standar === "true" || standar === true,
      catatan: catatan || "",
    });

    await surveyData.save();

    // Update connection data with survey ID
    connectionData.surveiId = surveyData._id;
    await connectionData.save();

    console.log(
      "[createSurveyData] Survey created successfully:",
      surveyData._id
    );

    res.status(201).json({
      status: 201,
      pesan: "Survey data created successfully",
      data: surveyData,
    });
  } catch (error) {
    console.error("[createSurveyData] Error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get All Survey Data (Admin/Technician)
export const getAllSurveyData = async (req, res) => {
  try {
    const surveyData = await SurveyData.find()
      .populate("connectionDataId")
      .populate("userId", "email namaLengkap phone");

    res.status(200).json({
      status: 200,
      data: surveyData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Survey Data by ID
export const getSurveyDataById = async (req, res) => {
  try {
    const { id } = req.params;

    const surveyData = await SurveyData.findById(id)
      .populate("connectionDataId")
      .populate("userId", "email namaLengkap phone");

    if (!surveyData) {
      return res.status(404).json({
        status: 404,
        pesan: "Survey data not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: surveyData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get Survey Data by Connection Data ID
export const getSurveyDataByConnectionId = async (req, res) => {
  try {
    const { connectionDataId } = req.params;

    const surveyData = await SurveyData.findOne({ connectionDataId })
      .populate("connectionDataId")
      .populate("userId", "email namaLengkap phone");

    if (!surveyData) {
      return res.status(404).json({
        status: 404,
        pesan: "Survey data not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: surveyData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Update Survey Data (Technician)
export const updateSurveyData = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle PDF/image file uploads if provided
    if (req.files) {
      if (req.files.jaringanFile) {
        updates.jaringanUrl = await uploadPdfAsImage(
          req.files.jaringanFile[0].buffer,
          "aqualink/survey/jaringan",
          req.files.jaringanFile[0].mimetype
        );
      }
      if (req.files.posisiBakFile) {
        updates.posisiBakUrl = await uploadPdfAsImage(
          req.files.posisiBakFile[0].buffer,
          "aqualink/survey/bak",
          req.files.posisiBakFile[0].mimetype
        );
      }
      if (req.files.posisiMeteranFile) {
        updates.posisiMeteranUrl = await uploadPdfAsImage(
          req.files.posisiMeteranFile[0].buffer,
          "aqualink/survey/meteran",
          req.files.posisiMeteranFile[0].mimetype
        );
      }
    }

    // Handle koordinat update
    if (updates.koordinatLat || updates.koordinatLong) {
      updates.koordinat = {};
      if (updates.koordinatLat)
        updates.koordinat.lat = parseFloat(updates.koordinatLat);
      if (updates.koordinatLong)
        updates.koordinat.long = parseFloat(updates.koordinatLong);
      delete updates.koordinatLat;
      delete updates.koordinatLong;
    }

    // Convert numbers
    if (updates.diameterPipa)
      updates.diameterPipa = parseInt(updates.diameterPipa);
    if (updates.jumlahPenghuni)
      updates.jumlahPenghuni = parseInt(updates.jumlahPenghuni);
    if (updates.standar)
      updates.standar = updates.standar === "true" || updates.standar === true;

    const surveyData = await SurveyData.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!surveyData) {
      return res.status(404).json({
        status: 404,
        pesan: "Survey data not found",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "Survey data updated successfully",
      data: surveyData,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Delete Survey Data
export const deleteSurveyData = async (req, res) => {
  try {
    const { id } = req.params;

    const surveyData = await SurveyData.findByIdAndDelete(id);

    if (!surveyData) {
      return res.status(404).json({
        status: 404,
        pesan: "Survey data not found",
      });
    }

    // Remove survey ID from connection data
    await ConnectionData.findByIdAndUpdate(surveyData.connectionDataId, {
      surveiId: null,
    });

    res.status(200).json({
      status: 200,
      pesan: "Survey data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};
