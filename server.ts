import { configDotenv } from 'dotenv';
configDotenv(); // Harus dipanggil PERTAMA sebelum import lain agar env vars tersedia

import express, { type Request, type Response, type NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttpPkg from 'pino-http';
const pinoHttp = (pinoHttpPkg as any).default ?? pinoHttpPkg;
import logger from './utils/logger.js';
import userRouter from './routes/userRouter.js';
import reportRouter from './routes/reportRouter.js';
// Legacy routes removed — collections dropped (iotconnections, subscribes, transactionmidtrans, transactions, wallets, watercredits)
// import transactionRouter from './routes/transactionRoutes.js';
// import paymentRouter from './routes/paymentRouter.js';
// import waterCreditRouter from './routes/waterCreditRoutes.js';
// import subscribeRouter from './routes/subscribeRouter.js';
// import walletRouter from './routes/walletRouter.js';
import notificationRouter from './routes/notificationRoutes.js';
import historyRouter from './routes/historyRoutes.js';
import adminAccountRouter from './routes/adminAccountRoutes.js';
import connectionDataRouter from './routes/connectionDataRoutes.js';
import surveyDataRouter from './routes/surveyDataRoutes.js';
import rabConnectionRouter from './routes/rabConnectionRoutes.js';
import meteranRouter from './routes/meteranRoutes.js';
import kelompokPelangganRouter from './routes/kelompokPelangganRoutes.js';
import technicianRouter from './routes/technicianRoutes.js';
import billingRouter from './routes/billingRoutes.js';
import monitoringRouter from './routes/monitoringRoutes.js';
import webhookRouter from './routes/webhookRoutes.js';
import documentRouter from './routes/documentRoutes.js';
// import iotRouter from './routes/iotRoutes.js'; // iotconnections dropped
import adminCustomerRouter from './routes/adminCustomerRoutes.js';
import internalRouter from './routes/internalRoutes.js';
import cronRouter from './routes/cronRoutes.js';

import {
  setupBillingCron,
  setupOverdueCron,
  setupReminderCron,
  setupIotSyncCron,
} from './utils/billingCron.js';
import { setupApolloServer } from './graphql/apolloServer.js';

const app = express();
const port = 5000;

// Trust Vercel/proxy forwarded headers so req.ip reflects real client IP
// Required for express-rate-limit to work correctly behind Vercel's proxy
app.set('trust proxy', 1);

// Validate required environment variables before anything else
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'JWT_ACCESS_SECRET', 'INTERNAL_API_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.fatal(`Required env var ${key} is not set`);
    process.exit(1);
  }
}

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow Cloudinary images
  contentSecurityPolicy: false, // Disabled — handled by frontend
}));

// Rate limiter untuk REST auth endpoints (5 percobaan per 15 menit)
const restAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { status: 429, pesan: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
app.use('/admin/auth/login', restAuthLimiter);
app.use('/technician/login', restAuthLimiter);

// HTTP request logging (skip health check to avoid noise)
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

// CORS — allow known origins + local dev (API secured by JWT)
const ALLOWED_ORIGINS = [
  // 'https://aqualink-admin-panel.vercel.app',  // old — sebelum Cloudflare proxy
  'https://adminflowin.my.id',                   // Cloudflare proxy → Vercel frontend
  'http://localhost:3000',
  'http://localhost:3001',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-secret', 'apollo-require-preflight', 'x-vercel-protection-bypass'],
}));
app.options('*', cors()); // Handle preflight for all routes

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const clientOptions = {
  serverApi: { version: '1' as const, strict: true, deprecationErrors: true },
  serverSelectionTimeoutMS: 5000, // gagal cepat pada attempt pertama, tidak tunggu 30 detik
  connectTimeoutMS: 10000,
};

async function connectDB(retries = 3, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGO_URI as string, clientOptions);
      logger.info('MongoDB connected successfully');
      return;
    } catch (error) {
      logger.error({ err: error }, `MongoDB connection failed (attempt ${attempt}/${retries})`);
      if (attempt < retries) {
        logger.info(`Retrying in ${delayMs / 1000}s...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        logger.fatal('MongoDB unreachable after all retries. Check Atlas IP whitelist: https://cloud.mongodb.com → Network Access → Add IP Address');
        process.exit(1);
      }
    }
  }
}

app.get('/', (_req: Request, res: Response) => {
  res.send('hallo');
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbConnected: ['connected', 'open'].includes(
      ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'][mongoose.connection.readyState] ?? 'disconnected'
    ),
  });
});

// Webhook routes (HARUS di atas semua route lain, tanpa middleware auth)
app.use('/webhook', webhookRouter);

app.use('/users', userRouter);
app.use('/report', reportRouter);
// app.use('/transactions', transactionRouter);   // dropped
// app.use('/midtrans', paymentRouter);            // dropped (wallet top-up — unused)
// app.use('/waterCredit', waterCreditRouter);     // dropped
// app.use('/subscribe', subscribeRouter);         // dropped
// app.use('/wallet', walletRouter);               // dropped
app.use('/notification', notificationRouter);
app.use('/history', historyRouter);
app.use('/billing', billingRouter);
app.use('/admin/auth', adminAccountRouter);
app.use('/connection-data', connectionDataRouter);
app.use('/survey-data', surveyDataRouter);
app.use('/rab-connection', rabConnectionRouter);
app.use('/meteran', meteranRouter);
app.use('/kelompok-pelanggan', kelompokPelangganRouter);
app.use('/technician', technicianRouter);
app.use('/monitoring', monitoringRouter);
app.use('/documents', documentRouter);
// app.use('/iot', iotRouter);                    // dropped
app.use('/admin/customers', adminCustomerRouter);
app.use('/internal', internalRouter);
app.use('/api/cron', cronRouter); // Vercel Cron Jobs endpoint


// Global error handler — must be after all routes
app.use((err: any, _req: Request, res: Response, _next: any) => {
  logger.error({ err }, 'Unhandled Express error');
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(status).json({ status, message });
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
});

// Initialization promise — runs once on cold start (Vercel) or on startup (local)
const initPromise = connectDB()
  .then(async () => {
    await setupApolloServer(app);
    logger.info('Server initialized (DB + Apollo ready)');
  })
  .catch((err) => {
    logger.fatal({ err }, 'Server initialization failed');
    throw err;
  });

// Local development: listen on port + setup cron jobs
if (!process.env.VERCEL) {
  initPromise.then(() => {
    const server = app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`GraphQL endpoint: http://localhost:${port}/graphql`);

      logger.info('Setting up billing cron jobs...');
      setupBillingCron();
      setupOverdueCron();
      setupReminderCron();
      setupIotSyncCron();
      logger.info('All cron jobs are active');
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.fatal(`Port ${port} already in use — stop the existing process`);
        process.exit(1);
      } else {
        throw err;
      }
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, closing gracefully`);
      server.close(async () => {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed. Server stopped.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch((err) => logger.fatal({ err }, 'Server startup failed'));
}

// Vercel serverless handler — wait for init, then delegate to Express
export default async function handler(req: any, res: any) {
  await initPromise;
  return app(req, res);
}
