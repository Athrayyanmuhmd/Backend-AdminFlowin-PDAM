import express from "express";
import {
  registerAdminAccount,
  loginAdminAccount,
  logoutAdminAccount,
} from "../controllers/adminAccountController.js";

const adminAccountRouter = express.Router();

adminAccountRouter.post("/register", registerAdminAccount);
adminAccountRouter.post("/login", loginAdminAccount);
adminAccountRouter.post("/logout", logoutAdminAccount);

export default adminAccountRouter;
