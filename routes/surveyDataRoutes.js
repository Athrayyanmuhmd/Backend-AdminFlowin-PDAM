import express from "express";
import {
  createSurveyData,
  getAllSurveyData,
  getSurveyDataById,
  getSurveyDataByConnectionId,
  updateSurveyData,
  deleteSurveyData,
} from "../controllers/surveyDataController.js";
import { verifyAdmin } from "../middleware/adminAuth.js";
import { verifyTechnician } from "../middleware/technicianAuth.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";
import { uploadSurveyDataFiles } from "../middleware/upload.js";

const router = express.Router();

// Admin or Technician routes (create/update)
router.post("/", verifyAdminOrTechnician, uploadSurveyDataFiles, createSurveyData);
router.put("/:id", verifyAdminOrTechnician, uploadSurveyDataFiles, updateSurveyData);

// Admin & Technician routes (read access)
router.get("/", verifyAdminOrTechnician, getAllSurveyData);
router.get("/:id", verifyAdminOrTechnician, getSurveyDataById);
router.get(
  "/connection/:connectionDataId",
  verifyAdminOrTechnician,
  getSurveyDataByConnectionId
);

// Admin only routes
router.delete("/:id", verifyAdmin, deleteSurveyData);

export default router;
