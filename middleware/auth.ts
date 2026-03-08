import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ status: 401, message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ status: 403, message: 'Invalid or expired token.' });
  }
};

// Verify token from query parameter (for iframe/img src usage)
export const verifyTokenFromQuery = (req: Request, res: Response, next: NextFunction): void => {
  const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ status: 401, message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ status: 403, message: 'Invalid or expired token.' });
  }
};
