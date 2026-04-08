import { Router, type Request, type Response } from 'express';
import { verifyInternalSecret } from '../middleware/internalAuth.js';
import ConnectionData from '../models/ConnectionData.js';
import SurveyData from '../models/SurveyData.js';
import PekerjaanTeknisi from '../models/PekerjaanTeknisi.js';
import Technician from '../models/Technician.js';
import { notifikasiSemuaAdmin } from '../graphql/resolvers/helpers.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /internal/survei-selesai
 *
 * Dipanggil oleh backend Rafli (flowin-teknisi-graphql) saat teknisi
 * telah menyelesaikan survei lapangan dan mengisi data survei.
 *
 * Body:
 *   koneksiDataId  — ID dokumen KoneksiData yang disurvei
 *   teknisiId      — ID teknisi yang melakukan survei
 *   surveiId       — ID SurveyData yang sudah dibuat teknisi (opsional)
 *   catatan        — Catatan dari teknisi (opsional)
 *
 * Header wajib: x-internal-secret: <INTERNAL_API_SECRET>
 */
router.post('/survei-selesai', verifyInternalSecret, async (req: Request, res: Response) => {
  const { koneksiDataId, teknisiId, surveiId, catatan } = req.body;

  if (!koneksiDataId || !teknisiId) {
    res.status(400).json({ success: false, message: 'koneksiDataId dan teknisiId wajib diisi' });
    return;
  }

  try {
    const koneksi = await ConnectionData.findById(koneksiDataId).populate('idPelanggan');
    if (!koneksi) {
      res.status(404).json({ success: false, message: 'Data koneksi tidak ditemukan' });
      return;
    }

    const teknisi = await Technician.findById(teknisiId);
    if (!teknisi) {
      res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
      return;
    }

    // Cari survei yang terkait dengan koneksi ini
    let survei = surveiId
      ? await SurveyData.findById(surveiId)
      : await SurveyData.findOne({ idKoneksiData: koneksiDataId });

    if (!survei) {
      res.status(404).json({ success: false, message: 'Data survei tidak ditemukan. Pastikan teknisi sudah mengisi data survei.' });
      return;
    }

    // Buat atau update PekerjaanTeknisi untuk survei ini
    let wo = await PekerjaanTeknisi.findOne({ idSurvei: survei._id });
    if (!wo) {
      wo = new PekerjaanTeknisi({
        idSurvei: survei._id,
        tim: [teknisiId],
        status: 'DitinjauAdmin',
        disetujui: null,
        catatan: catatan || null,
      });
      await wo.save();
    } else {
      // Update ke DitinjauAdmin agar admin bisa review
      wo.status = 'DitinjauAdmin';
      if (catatan) wo.catatan = catatan;
      await wo.save();
    }

    // Notify admin
    const pelangganNama = (koneksi.idPelanggan as any)?.namaLengkap || 'Pelanggan';
    await notifikasiSemuaAdmin(
      'Survei Lapangan Selesai',
      `Teknisi ${teknisi.namaLengkap} telah menyelesaikan survei lapangan untuk pengajuan atas nama ${pelangganNama}. Silakan review dan setujui work order survei.`,
      'Informasi',
      `/operations/connection-data/${koneksiDataId}`,
    );

    logger.info({ koneksiDataId, teknisiId, surveiId: survei._id, woId: wo._id }, 'Survei selesai dari backend Rafli');

    res.status(200).json({
      success: true,
      message: 'Survei selesai dicatat. Work order menunggu persetujuan admin.',
      data: {
        surveiId: survei._id,
        woId: wo._id,
        status: wo.status,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Gagal memproses survei selesai dari backend Rafli');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /internal/rab-selesai
 *
 * Dipanggil oleh backend Rafli saat teknisi telah selesai membuat dokumen DED/RAB.
 *
 * Body:
 *   koneksiDataId — ID dokumen KoneksiData
 *   teknisiId     — ID teknisi
 *   rabId         — ID RabConnection yang sudah dibuat
 *   catatan       — Catatan dari teknisi (opsional)
 */
router.post('/rab-selesai', verifyInternalSecret, async (req: Request, res: Response) => {
  const { koneksiDataId, teknisiId, rabId, catatan } = req.body;

  if (!koneksiDataId || !teknisiId || !rabId) {
    res.status(400).json({ success: false, message: 'koneksiDataId, teknisiId, dan rabId wajib diisi' });
    return;
  }

  try {
    const koneksi = await ConnectionData.findById(koneksiDataId).populate('idPelanggan');
    if (!koneksi) {
      res.status(404).json({ success: false, message: 'Data koneksi tidak ditemukan' });
      return;
    }

    const teknisi = await Technician.findById(teknisiId);
    if (!teknisi) {
      res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
      return;
    }

    // Buat atau update PekerjaanTeknisi untuk RAB ini
    let wo = await PekerjaanTeknisi.findOne({ rabId });
    if (!wo) {
      wo = new PekerjaanTeknisi({
        rabId,
        tim: [teknisiId],
        status: 'DitinjauAdmin',
        disetujui: null,
        catatan: catatan || null,
      });
      await wo.save();
    } else {
      wo.status = 'DitinjauAdmin';
      if (catatan) wo.catatan = catatan;
      await wo.save();
    }

    const pelangganNama = (koneksi.idPelanggan as any)?.namaLengkap || 'Pelanggan';
    await notifikasiSemuaAdmin(
      'Dokumen DED/RAB Selesai',
      `Teknisi ${teknisi.namaLengkap} telah menyelesaikan dokumen DED/RAB untuk pengajuan atas nama ${pelangganNama}. Silakan review dan setujui work order RAB.`,
      'Informasi',
      `/operations/connection-data/${koneksiDataId}`,
    );

    logger.info({ koneksiDataId, teknisiId, rabId, woId: wo._id }, 'RAB selesai dari backend Rafli');

    res.status(200).json({
      success: true,
      message: 'Dokumen RAB selesai dicatat. Work order menunggu persetujuan admin.',
      data: {
        rabId,
        woId: wo._id,
        status: wo.status,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Gagal memproses RAB selesai dari backend Rafli');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
