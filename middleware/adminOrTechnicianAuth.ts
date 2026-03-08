import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const verifyAdminOrTechnician = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ status: 401, message: 'Token tidak ditemukan, akses ditolak' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    if (decoded.userId || decoded.id) {
      if (decoded.userId) {
        req.userId = decoded.userId || decoded.id;
        req.userEmail = decoded.email;
        req.userRole = 'admin';
      } else if (decoded.id) {
        req.technicianId = decoded.id;
        req.technician = decoded;
        req.userRole = 'technician';
      }
      next();
    } else {
      res.status(403).json({ status: 403, message: 'Token tidak valid untuk admin atau teknisi' });
    }
  } catch (error: any) {
    console.error('[AdminOrTechnician Auth] Error:', error.message);
    res.status(401).json({
      status: 401,
      message: 'Token tidak valid atau sudah kadaluarsa',
      error: error.message,
    });
  }
};
