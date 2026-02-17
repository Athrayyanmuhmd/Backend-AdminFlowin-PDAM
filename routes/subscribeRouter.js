import express from "express";
import {
  createSubscribe,
  incrementUsedWater,
  isBalanceZero,
  getSubscribeByUserId,
  getSubscribeByOwnerId,
  getSubscribeById,
  unsubscribe,
  // getTransactionFromBlockchainByUserId,
} from "../controllers/subscribeController.js";

const subscribeRouter = express.Router();

subscribeRouter.post("/subscribeWaterCredit", createSubscribe);
subscribeRouter.put("/usedWater/:userId/:waterCreditId", incrementUsedWater);
subscribeRouter.get("/closePipe/:userId/:waterCreditId", isBalanceZero);
subscribeRouter.get("/getSubscribeByUserId/:userId", getSubscribeByUserId);

// subscribeRouter.get("/blockchain/:userId", getTransactionFromBlockchainByUserId);

subscribeRouter.get("/getSubscribeById/:id", getSubscribeById);
subscribeRouter.get("/getSubscribeByOwnerId/:id", getSubscribeByOwnerId);
subscribeRouter.put("/unsubscribe/:userId/:waterCreditId", unsubscribe);

export default subscribeRouter;
