import jwt from "jsonwebtoken";
import Technician from "../models/Technician.js";

export const verifyTechnician = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: 401,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("[verifyTechnician] Decoded token:", decoded);

    // Cek apakah user adalah teknisi
    const technician = await Technician.findById(decoded.id);
    if (!technician) {
      return res.status(403).json({
        status: 403,
        message: "Access denied. Technician only.",
      });
    }

    // ✅ CRITICAL FIX: Check if token in DB matches the one provided
    if (technician.token !== token) {
      return res.status(403).json({
        status: 403,
        message: "Invalid token. Please login again.",
      });
    }

    console.log("[verifyTechnician] Technician found:", technician._id);

    req.technician = technician;
    req.technicianId = technician._id.toString(); // Convert to string for consistency
    req.userRole = "technician"; // Add userRole for consistency with admin

    console.log("[verifyTechnician] Set technicianId:", req.technicianId);

    next();
  } catch (error) {
    res.status(403).json({
      status: 403,
      message: "Invalid or expired token.",
    });
  }
};
