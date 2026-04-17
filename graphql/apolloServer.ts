import { ApolloServer } from '@apollo/server';
import { typeDefs } from './schemas/typeDefs/index.js';
import { resolvers } from './resolvers/index.js';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import AdminAccount from '../models/AdminAccount.js';
import Technician from '../models/Technician.js';

// Operasi yang boleh berjalan tanpa sesi aktif di DB (login/logout public)
const PUBLIC_OPERATIONS = new Set(['loginAdmin', 'loginTechnician', 'logoutAdmin', 'logoutTechnician']);

/**
 * Validasi token terhadap DB: cek apakah sesi masih aktif setelah logout.
 * Hanya dijalankan jika token ada DAN operasi bukan public.
 * Error DB diabaikan (graceful degrade) — JWT expiry tetap jadi garis pertahanan terakhir.
 */
async function validateSessionInDB(token: string, operationName?: string): Promise<void> {
  if (!token || PUBLIC_OPERATIONS.has(operationName ?? '')) return;
  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch {
    return; // JWT verify error ditangani di resolver
  }
  const id = decoded.id ?? decoded.userId; // handle REST token lama (userId) + GraphQL token (id)
  const role = decoded.role;
  if (!id) return;

  try {
    // Cek apakah token di DB di-null-kan (logout eksplisit).
    // Tidak memeriksa kecocokan string penuh — hanya pastikan token tidak null.
    // Alasan: REST login dan GraphQL login masing-masing menyimpan token berbeda ke DB,
    // sehingga perbandingan string penuh tidak reliable untuk multi-login-path.
    if (role === 'technician') {
      const teknisi = await Technician.findById(id).select('token').lean() as any;
      if (teknisi && teknisi.token === null) {
        throw new Error('Sesi tidak valid. Silakan login ulang.');
      }
    } else {
      const admin = await AdminAccount.findById(id).select('token').lean() as any;
      if (admin && admin.token === null) {
        throw new Error('Sesi tidak valid. Silakan login ulang.');
      }
    }
  } catch (err: any) {
    if (err.message === 'Sesi tidak valid. Silakan login ulang.') throw err;
    // DB error → graceful degrade, JWT masih berlaku
  }
}

// Rate limiter for login operations — 10 attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: (req: Request) => {
    const body = req.body;
    if (!body || !body.query) return true;
    const op = (body.operationName || '').toLowerCase();
    const query = body.query.toLowerCase();
    const isLogin = op.includes('login') || query.includes('loginadmin') || query.includes('logintechnician');
    return !isLogin;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      errors: [{ message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }],
    });
  },
});

export async function setupApolloServer(app: Express): Promise<ApolloServer<any>> {
  const server = new ApolloServer<any>({
    typeDefs,
    resolvers,
    introspection: process.env.NODE_ENV !== 'production',
    formatError: (error: any) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
      };
    },
  });

  await server.start();

  app.use(
    '/graphql',
    loginRateLimiter,
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
        ];
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
        }
      },
      credentials: true,
    }),
    express.json(),
    async (req: Request, res: Response) => {
      try {
        if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
        }

        if (req.method === 'GET') {
          res.json({ message: 'GraphQL server is running. Use POST to send queries.' });
          return;
        }

        const { query, variables, operationName } = req.body;

        const rawToken = req.headers.authorization
          ? req.headers.authorization.replace(/^Bearer\s+/i, '')
          : '';

        // DB session check — dilakukan sebelum resolver berjalan, satu kali per request
        if (rawToken) {
          await validateSessionInDB(rawToken, operationName);
        }

        const result = await server.executeOperation(
          { query, variables, operationName },
          {
            contextValue: {
              token: rawToken,
              req,
            },
          }
        );

        if (result.body.kind === 'single') {
          res.json(result.body.singleResult);
        } else {
          res.status(500).json({ error: 'Incremental delivery not supported' });
        }
      } catch (error: any) {
        console.error('GraphQL execution error:', error);
        res.status(500).json({
          errors: [{ message: error.message || 'Internal server error' }],
        });
      }
    }
  );

  console.log('🚀 GraphQL Server ready at http://localhost:5000/graphql');
  return server;
}
