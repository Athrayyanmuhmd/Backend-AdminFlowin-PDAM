import { ApolloServer } from '@apollo/server';
import { typeDefs } from './schemas/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

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

        const result = await server.executeOperation(
          { query, variables, operationName },
          {
            contextValue: {
              token: req.headers.authorization
                ? req.headers.authorization.replace(/^Bearer\s+/i, '')
                : '',
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
