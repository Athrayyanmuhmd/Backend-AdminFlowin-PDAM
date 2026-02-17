import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("🔐 Auth header:", authHeader);

  const token = authHeader?.split(" ")[1];
  console.log(
    "🔑 Extracted token:",
    token ? `${token.substring(0, 20)}...` : "NONE"
  );

  if (!token) {
    console.log("❌ No token provided");
    return res.status(401).json({
      status: 401,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token verified for user:", decoded.userId);
    req.user = decoded; // Simpan payload ke dalam `req.user` untuk digunakan di fungsi lain
    next();
  } catch (error) {
    console.log("❌ Token verification failed:", error.message);
    res.status(403).json({
      status: 403,
      message: "Invalid or expired token.",
    });
  }
};

// Verify token from query parameter (for iframe/img src usage)
export const verifyTokenFromQuery = (req, res, next) => {
  // Try to get token from query parameter first, then fall back to header
  const token = req.query.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: 401,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      status: 403,
      message: "Invalid or expired token.",
    });
  }
};
