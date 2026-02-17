import express from "express";
import {
  createReport,
  getAllReports,
  deleteReport,
  editReport,
  getByReporterID,
} from "../controllers/reportController.js";

const reportRouter = express.Router();

reportRouter.get("/", getAllReports);
reportRouter.post("/create", createReport);
reportRouter.put("/edit/:id", editReport);
reportRouter.delete("/delete/:id", deleteReport);
reportRouter.get("/getByReporterID/:reporterID", getByReporterID);

export default reportRouter;
