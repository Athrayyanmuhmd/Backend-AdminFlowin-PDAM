import jwt from "jsonwebtoken";

export const verifyAdminOrTechnician = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Token tidak ditemukan, akses ditolak",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's an admin token (has userId or email)
    // or technician token (has id)
    if (decoded.userId || decoded.id) {
      // Set appropriate fields based on token type
      if (decoded.userId) {
        // Admin token
        req.userId = decoded.userId || decoded.id;
        req.userEmail = decoded.email;
        req.userRole = "admin";
      } else if (decoded.id) {
        // Technician token
        req.technicianId = decoded.id;
        req.technician = decoded;
        req.userRole = "technician";
      }

      next();
    } else {
      return res.status(403).json({
        status: 403,
        message: "Token tidak valid untuk admin atau teknisi",
      });
    }
  } catch (error) {
    console.error("[AdminOrTechnician Auth] Error:", error.message);
    return res.status(401).json({
      status: 401,
      message: "Token tidak valid atau sudah kadaluarsa",
      error: error.message,
    });
  }
};
