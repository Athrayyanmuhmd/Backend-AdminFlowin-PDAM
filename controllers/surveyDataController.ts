// @ts-nocheck — legacy REST controller, phase-out menuju GraphQL
import SurveyData from "../models/SurveyData.js";
import ConnectionData from "../models/ConnectionData.js";
import { uploadDocument } from "../utils/cloudinary.js";
import { computeFileHash } from "../middleware/upload.js";
import logger from "../utils/logger.js";

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

    const isAdmin = req.userRole === "admin";
    logger.info({ role: isAdmin ? "admin" : "technician", connectionDataId }, "[createSurveyData] request received");

    // Check if connection data exists
    const connectionData = await ConnectionData.findById(connectionDataId);
    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    // For technicians, enforce assignment check
    if (!isAdmin) {
      if (!connectionData.assignedTechnicianId) {
        return res.status(403).json({
          status: 403,
          message:
            "This connection data has not been assigned to any technician yet",
        });
      }

      if (
        connectionData.assignedTechnicianId.toString() !==
        req.technicianId.toString()
      ) {
        return res.status(403).json({
          status: 403,
          pesan: "You are not assigned to this connection data",
        });
      }
    }

    logger.info({ role: isAdmin ? "admin" : "technician" }, "[createSurveyData] access granted");

    // Check if survey already exists
    const existingSurvey = await SurveyData.findOne({ idKoneksiData: connectionDataId });
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

    // Hitung SHA-256 sebelum upload ke Cloudinary
    const jaringanHash     = computeFileHash(req.files.jaringanFile[0].buffer);
    const posisiBakHash    = computeFileHash(req.files.posisiBakFile[0].buffer);
    const posisiMeteranHash = computeFileHash(req.files.posisiMeteranFile[0].buffer);

    // Upload PDF/image files to Cloudinary
    const jaringanUrl = await uploadDocument(
      req.files.jaringanFile[0].buffer,
      "aqualink/survey/jaringan",
      req.files.jaringanFile[0].mimetype
    );
    const posisiBakUrl = await uploadDocument(
      req.files.posisiBakFile[0].buffer,
      "aqualink/survey/bak",
      req.files.posisiBakFile[0].mimetype
    );
    const posisiMeteranUrl = await uploadDocument(
      req.files.posisiMeteranFile[0].buffer,
      "aqualink/survey/meteran",
      req.files.posisiMeteranFile[0].mimetype
    );

    const surveyData = new SurveyData({
      idKoneksiData: connectionDataId,
      idTeknisi: req.technicianId || connectionData.assignedTechnicianId || null,
      urlJaringan: jaringanUrl,
      jaringanHash,
      diameterPipa: parseInt(diameterPipa),
      urlPosisiBak: posisiBakUrl,
      posisiBakHash,
      posisiMeteran: posisiMeteranUrl,
      posisiMeteranHash,
      jumlahPenghuni: String(jumlahPenghuni),
      koordinat: {
        latitude: parseFloat(koordinatLat),
        longitude: parseFloat(koordinatLong),
      },
      standar: standar === "true" || standar === true,
      catatan: catatan || "",
    });

    await surveyData.save();

    // Update connection data with survey ID
    connectionData.surveiId = surveyData._id;
    await connectionData.save();

    logger.info({ surveyId: surveyData._id }, "[createSurveyData] survey created");

    res.status(201).json({
      status: 201,
      pesan: "Survey data created successfully",
      data: surveyData,
    });
  } catch (error) {
    logger.error({ err: error }, "[createSurveyData] error");
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
      .populate("idKoneksiData")
      .populate("idTeknisi", "email namaLengkap noHP");

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
      .populate("idKoneksiData")
      .populate("idTeknisi", "email namaLengkap noHP");

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

    const surveyData = await SurveyData.findOne({ idKoneksiData: connectionDataId })
      .populate("idKoneksiData")
      .populate("idTeknisi", "email namaLengkap noHP");

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
    const { diameterPipa, jumlahPenghuni, standar, catatan, koordinatLat, koordinatLong } = req.body;
    const updates: Record<string, any> = { catatan };

    // Handle PDF/image file uploads if provided
    if (req.files) {
      if (req.files.jaringanFile) {
        updates.urlJaringan = await uploadDocument(
          req.files.jaringanFile[0].buffer,
          "aqualink/survey/jaringan",
          req.files.jaringanFile[0].mimetype
        );
      }
      if (req.files.posisiBakFile) {
        updates.urlPosisiBak = await uploadDocument(
          req.files.posisiBakFile[0].buffer,
          "aqualink/survey/bak",
          req.files.posisiBakFile[0].mimetype
        );
      }
      if (req.files.posisiMeteranFile) {
        updates.posisiMeteran = await uploadDocument(
          req.files.posisiMeteranFile[0].buffer,
          "aqualink/survey/meteran",
          req.files.posisiMeteranFile[0].mimetype
        );
      }
    }

    // Handle koordinat update
    if (koordinatLat || koordinatLong) {
      updates.koordinat = {};
      if (koordinatLat) updates.koordinat.latitude = parseFloat(koordinatLat);
      if (koordinatLong) updates.koordinat.longitude = parseFloat(koordinatLong);
    }

    // Convert numbers from whitelisted fields
    if (diameterPipa !== undefined) updates.diameterPipa = parseInt(diameterPipa);
    if (jumlahPenghuni !== undefined) updates.jumlahPenghuni = parseInt(jumlahPenghuni);
    if (standar !== undefined) updates.standar = standar === "true" || standar === true;
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

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
    await ConnectionData.findByIdAndUpdate(surveyData.idKoneksiData, {
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
