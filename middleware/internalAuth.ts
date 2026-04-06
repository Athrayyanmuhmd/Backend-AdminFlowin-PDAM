import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware untuk memverifikasi request yang datang dari backend Rafli (flowin-teknisi-graphql).
 * Setiap request internal wajib menyertakan header: x-internal-secret: <INTERNAL_API_SECRET>
 *
 * Cara pakai di route:
 *   router.post('/internal/some-endpoint', verifyInternalSecret, controller);
 */
export function verifyInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-internal-secret'];

  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    res.status(403).json({ success: false, message: 'Akses ditolak: secret tidak valid' });
    return;
  }

  next();
}
