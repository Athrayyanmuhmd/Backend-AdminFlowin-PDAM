import mongoose from "mongoose";

const Subscribe = mongoose.Schema(
  {
    customerDetail: {
      id: {
        type: String,
        required: true,
      },
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
    },
    waterCreditId: {
      type: String,
      required: true,
    },
    totalUsedWater: {
      type: Number,
      required: true,
      default: 0,
    },
    usedWaterInTempo: {
      type: Number,
      required: true,
      default: 0,
    },
    subscribeStatus: {
      type: Boolean,
      required: true,
      default: true,
    },
    isPipeClose: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Subscribes", Subscribe);
