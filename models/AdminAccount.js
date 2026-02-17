import mongoose from "mongoose";

const AdminAccount = new mongoose.Schema(
  {
    NIP: {  // Added from ERD - Employee ID
      type: String,
      required: false,  // Not required for now (existing admins have temp NIPs)
      unique: true,
      sparse: true,  // Allow null values
    },
    namaLengkap: {  // Renamed from fullName to match ERD
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    noHP: {  // Renamed from phone to match ERD
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("AdminAccount", AdminAccount);
