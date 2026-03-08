import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import Technician from '../models/Technician.js';

export const verifyTechnician = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ status: 401, message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    const technician = await Technician.findById(decoded.id);
    if (!technician) {
      res.status(403).json({ status: 403, message: 'Access denied. Technician only.' });
      return;
    }

    // ✅ CRITICAL: Check if token in DB matches the one provided
    if (technician.token !== token) {
      res.status(403).json({ status: 403, message: 'Invalid token. Please login again.' });
      return;
    }

    req.technician = technician;
    req.technicianId = technician._id.toString();
    req.userRole = 'technician';
    next();
  } catch {
    res.status(403).json({ status: 403, message: 'Invalid or expired token.' });
  }
};
