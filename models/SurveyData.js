import mongoose from "mongoose";

const SurveyData = new mongoose.Schema(
  {
    connectionDataId: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      required: true,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    technicianId: {
      type: mongoose.Types.ObjectId,
      ref: "Technician",
      required: true,
    },
    jaringanUrl: {
      type: String,
      required: true,
    },
    diameterPipa: {
      type: Number,
      required: true,
    },
    posisiBakUrl: {
      type: String,
      required: true,
    },
    posisiMeteranUrl: {
      type: String,
      required: true,
    },
    jumlahPenghuni: {
      type: Number,
      required: true,
    },
    koordinat: {
      lat: {
        type: Number,
        required: true,
      },
      long: {
        type: Number,
        required: true,
      },
    },
    standar: {
      type: Boolean,
      required: true,
    },
    catatan: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SurveyData", SurveyData);
