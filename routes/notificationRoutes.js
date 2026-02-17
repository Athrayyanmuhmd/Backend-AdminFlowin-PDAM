import express from "express";
import { getNotificationsByUserId } from "../controllers/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.get(
  "/getNotificationByUserId/:userId",
  getNotificationsByUserId
);

export default notificationRouter;
