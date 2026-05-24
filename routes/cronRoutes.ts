import { Router, type Request, type Response } from 'express';
import {
  runBillingJob,
  runOverdueJob,
  runReminderJob,
  runIotSyncJob,
} from '../utils/billingCron.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Verifikasi header Authorization: Bearer <CRON_SECRET>
 * Vercel Cron Jobs otomatis inject header ini dari env CRON_SECRET.
 * Jika CRON_SECRET tidak di-set, endpoint dinonaktifkan (503).
 */
const verifyCronSecret = (req: Request, res: Response): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('CRON_SECRET env var tidak di-set — cron endpoint dinonaktifkan');
    res.status(503).json({ error: 'Cron not configured: CRON_SECRET missing' });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    logger.warn({ ip: req.ip }, 'Cron endpoint: unauthorized access attempt');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
};

// GET /api/cron/billing — Generate tagihan bulanan (1st of month 00:01)
// Vercel Cron Jobs selalu kirim GET request, bukan POST
router.get('/billing', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  logger.info('Vercel Cron: memulai runBillingJob');
  try {
    await runBillingJob();
    res.json({ ok: true, job: 'billing', timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, 'Vercel Cron: runBillingJob gagal');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/cron/overdue — Tandai tagihan overdue (daily 00:05)
router.get('/overdue', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  logger.info('Vercel Cron: memulai runOverdueJob');
  try {
    await runOverdueJob();
    res.json({ ok: true, job: 'overdue', timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, 'Vercel Cron: runOverdueJob gagal');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/cron/reminder — Kirim reminder jatuh tempo (daily 08:00)
router.get('/reminder', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  logger.info('Vercel Cron: memulai runReminderJob');
  try {
    await runReminderJob();
    res.json({ ok: true, job: 'reminder', timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, 'Vercel Cron: runReminderJob gagal');
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/cron/iot-sync — Sync IoT Redis → Meteran + riwayatpenggunaans (daily 02:00 UTC)
router.get('/iot-sync', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;
  logger.info('Vercel Cron: memulai runIotSyncJob');
  try {
    await runIotSyncJob();
    res.json({ ok: true, job: 'iot-sync', timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, 'Vercel Cron: runIotSyncJob gagal');
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
