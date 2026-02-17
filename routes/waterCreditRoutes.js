import express from "express";
import {
  createWaterCredit,
  deleteWaterCredit,
  editWaterCredit,
  getAllWaterCredit,
  getWaterCreditByOwnerId,
  getWaterCreditById,
} from "../controllers/waterCreditController.js";

const waterCreditRouter = express.Router();

waterCreditRouter.post("/createWaterCredit", createWaterCredit);
waterCreditRouter.delete("/deleteWaterCredit/:id", deleteWaterCredit);
waterCreditRouter.put("/editWaterCredit/:id", editWaterCredit);
waterCreditRouter.get(
  "/getWaterCreditByOwnerId/:ownerId",
  getWaterCreditByOwnerId
);
waterCreditRouter.get("/getAllWaterCredit", getAllWaterCredit);
waterCreditRouter.get("/getWaterCreditById/:id", getWaterCreditById);

export default waterCreditRouter;
