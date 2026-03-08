import { ApolloServer } from '@apollo/server';
import { typeDefs } from './schemas/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Rate limiter for login operations — 10 attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  skip: (req) => {
    // Only apply to loginAdmin / loginTechnician operations
    const body = req.body;
    if (!body || !body.query) return true;
    const op = (body.operationName || '').toLowerCase();
    const query = body.query.toLowerCase();
    const isLogin = op.includes('login') || query.includes('loginadmin') || query.includes('logintechnician');
    return !isLogin;
  },
  handler: (_req, res) => {
    res.status(429).json({
      errors: [{ message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }],
    });
  },
});

export async function setupApolloServer(app) {
  // Apollo Server v5 configuration
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true, // Enable GraphQL Playground in development
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
      };
    },
  });

  await server.start();

  // Manual middleware setup compatible with Apollo Server v4+
  app.use(
    '/graphql',
    loginRateLimiter,
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, or same-origin)
        if (!origin) return callback(null, true);

        // Allow all localhost origins for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }

        // Allow other origins in production (add your production URLs here)
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
        ];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Allow all for now in development
        }
      },
      credentials: true,
    }),
    express.json(),
    async (req, res) => {
      try {
        // Handle OPTIONS preflight request
        if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
        }

        // Handle GET requests
        if (req.method === 'GET') {
          // Return GraphQL Playground or introspection schema
          res.json({
            message: 'GraphQL server is running. Use POST to send queries.',
          });
          return;
        }

        const { query, variables, operationName } = req.body;

        const result = await server.executeOperation(
          {
            query,
            variables,
            operationName,
          },
          {
            contextValue: {
              token: req.headers.authorization
                ? req.headers.authorization.replace(/^Bearer\s+/i, '')
                : '',
              req,
            },
          }
        );

        // Handle single result (not incremental delivery)
        if (result.body.kind === 'single') {
          res.json(result.body.singleResult);
        } else {
          res.status(500).json({ error: 'Incremental delivery not supported' });
        }
      } catch (error) {
        console.error('GraphQL execution error:', error);
        res.status(500).json({
          errors: [
            {
              message: error.message || 'Internal server error',
            },
          ],
        });
      }
    }
  );

  console.log('🚀 GraphQL Server ready at http://localhost:5000/graphql');
  return server;
}
