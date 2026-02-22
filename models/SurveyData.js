import mongoose from "mongoose";

const SurveyData = new mongoose.Schema(
  {
    idKoneksiData: {
      type: mongoose.Types.ObjectId,
      ref: "ConnectionData",
      required: true,
    },
    idTeknisi: {
      type: mongoose.Types.ObjectId,
      ref: "Teknisi",
      required: true,
    },
    urlJaringan: {
      type: String,
      required: true,
    },
    diameterPipa: {
      type: Number,
      required: true,
    },
    urlPosisiBak: {
      type: String,
      required: true,
    },
    posisiMeteran: {
      type: String,
      required: true,
    },
    jumlahPenghuni: {
      type: String,
      required: true,
    },
    koordinat: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
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
  {
    timestamps: true,
    collection: 'surveydatas',
  }
);

export default mongoose.model("SurveyData", SurveyData);
