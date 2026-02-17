import jwt from "jsonwebtoken";
import AdminAccount from "../models/AdminAccount.js";

export const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: 401,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Cek apakah user adalah admin (payload menggunakan userId, bukan id)
    const admin = await AdminAccount.findById(decoded.userId || decoded.id);
    if (!admin) {
      return res.status(403).json({
        status: 403,
        message: "Access denied. Admin only.",
      });
    }

    req.admin = admin;
    req.userId = admin._id;
    next();
  } catch (error) {
    res.status(403).json({
      status: 403,
      message: "Invalid or expired token.",
    });
  }
};