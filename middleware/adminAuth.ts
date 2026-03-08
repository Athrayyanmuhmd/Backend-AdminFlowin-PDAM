import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import AdminAccount from '../models/AdminAccount.js';

export const verifyAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ status: 401, message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    const adminId = decoded.userId || decoded.id;
    if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
      res.status(403).json({ status: 403, message: 'Token tidak valid.' });
      return;
    }
    const admin = await AdminAccount.findById(adminId);
    if (!admin) {
      res.status(403).json({ status: 403, message: 'Access denied. Admin only.' });
      return;
    }

    // Verify stored token matches (same as verifyTechnician)
    if (admin.token && admin.token !== token) {
      res.status(403).json({ status: 403, message: 'Invalid token. Please login again.' });
      return;
    }

    req.admin = admin;
    req.userId = admin._id;
    next();
  } catch {
    res.status(403).json({ status: 403, message: 'Invalid or expired token.' });
  }
};
