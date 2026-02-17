import express from "express";
import {
  getWalletByUserId,
  convertConservasionToken,
} from "../controllers/walletController.js";

const walletRouter = express.Router();

walletRouter.get("/getWalletByUserId/:userId", getWalletByUserId);
walletRouter.post(
  "/convertConservasionToken/:userId",
  convertConservasionToken
);

export default walletRouter;
