import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { configDotenv } from 'dotenv';
import userRouter from './routes/userRouter.js';
import reportRouter from './routes/reportRouter.js';
import transactionRouter from './routes/transactionRoutes.js';
import paymentRouter from './routes/paymentRouter.js';
import waterCreditRouter from './routes/waterCreditRoutes.js';
import subscribeRouter from './routes/subscribeRouter.js';
import walletRouter from './routes/walletRouter.js';
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
import iotRouter from './routes/iotRoutes.js';
import adminCustomerRouter from './routes/adminCustomerRoutes.js';
import workOrderRouter from './routes/workOrderRoutes.js';
import {
  setupBillingCron,
  setupOverdueCron,
  setupReminderCron,
} from './utils/billingCron.js';
import { setupApolloServer } from './graphql/apolloServer.js';

const app = express();
const port = 5000;

configDotenv();

// Validate required environment variables before anything else
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Environment variable ${key} is required but not set. Check your .env file.`);
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
});
app.use('/admin/auth/login', restAuthLimiter);
app.use('/technician/login', restAuthLimiter);

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
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
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const clientOptions = {
  serverApi: { version: '1' as const, strict: true, deprecationErrors: true },
};

async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGO_URI as string, clientOptions);
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (error) {
    console.error('Koneksi ke MongoDB gagal:', error);
    process.exit(1);
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
app.use('/transactions', transactionRouter);
app.use('/midtrans', paymentRouter);
app.use('/waterCredit', waterCreditRouter);
app.use('/subscribe', subscribeRouter);
app.use('/wallet', walletRouter);
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
app.use('/iot', iotRouter);
app.use('/admin/customers', adminCustomerRouter);
app.use('/work-orders', workOrderRouter);

// Global error handler — must be after all routes
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(status).json({ status, message });
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

connectDB()
  .then(async () => {
    await setupApolloServer(app);

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`🚀 GraphQL endpoint: http://localhost:${port}/graphql`);

      console.log('\n🚀 Setting up billing cron jobs...');
      setupBillingCron();
      setupOverdueCron();
      setupReminderCron();
      console.log('✅ All cron jobs are active\n');
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} sudah digunakan. Hentikan proses lain dulu (taskkill /F /IM node.exe) atau ganti PORT di .env`);
        process.exit(1);
      } else {
        throw err;
      }
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Closing server gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed. Server stopped.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch(console.dir);
