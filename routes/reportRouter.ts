// @ts-nocheck — legacy REST route, phase-out menuju GraphQL
import express from "express";
import {
  createReport,
  getAllReports,
  deleteReport,
  editReport,
  getByReporterID,
} from "../controllers/reportController.js";
import { verifyAdminOrTechnician } from "../middleware/adminOrTechnicianAuth.js";

const reportRouter = express.Router();

// Semua route laporan wajib auth admin atau teknisi
reportRouter.get("/", verifyAdminOrTechnician, getAllReports);
reportRouter.post("/create", verifyAdminOrTechnician, createReport);
reportRouter.put("/edit/:id", verifyAdminOrTechnician, editReport);
reportRouter.delete("/delete/:id", verifyAdminOrTechnician, deleteReport);
reportRouter.get("/getByReporterID/:reporterID", verifyAdminOrTechnician, getByReporterID);

export default reportRouter;
