import mongoose from "mongoose";

const WaterCredit = new mongoose.Schema(
  {
    owner: {
      id: String,
      fullName: String,
      phone: String,
      email: String,
    },
    cost: {
      type: Number,
      required: true,
    },
    perLiter: {
      type: Number,
      required: true,
    },
    billingTime: {
      type: String,
      required: true,
      enum: ["Perhari", "Perminggu", "Perbulan", "Pertahun"],
      default: "Perbulan",
    },
    conservationToken: {
      rewardToken: {
        type: Number,
        required: true,
      },
      maxWaterUse: {
        type: Number,
        required: true,
      },
      tokenRewardTempo: {
        type: String,
        required: true,
        enum: ["Perhari", "Perminggu", "Perbulan", "Pertahun"],
        default: "Perbulan",
      },
    },
    waterQuality: {
      type: String,
      required: true,
      enum: ["Kurang Bagus", "Bagus", "Sangat Bagus"],
      default: "Bagus",
    },
    income: {
      type: Number,
      required: true,
      default: 0,
    },
    totalIncome: {
      type: Number,
      required: true,
      defaultf: 0,
    },
    withdrawl: {
      type: Number,
      required: true,
      default: 0,
    },
    totalUser: {
      type: Number,
      required: true,
      default: 0,
    },
    location: {
      address: {
        type: String,
        required: true,
      },
      coordinates: {
        long: {
          type: Number,
          required: true,
        },
        lat: {
          type: Number,
          required: true,
        },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("WaterCredits", WaterCredit);
