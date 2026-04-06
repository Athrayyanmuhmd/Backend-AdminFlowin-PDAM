import { Router, type Request, type Response } from 'express';
import { verifyInternalSecret } from '../middleware/internalAuth.js';
import ConnectionData from '../models/ConnectionData.js';
import Technician from '../models/Technician.js';
import { notifikasiSemuaAdmin } from '../graphql/resolvers/helpers.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /internal/verify-teknisi
 *
 * Dipanggil oleh backend Rafli (flowin-teknisi-graphql) saat teknisi
 * telah menyelesaikan verifikasi survei lapangan.
 *
 * Body:
 *   koneksiDataId  — ID dokumen KoneksiData yang diverifikasi
 *   teknisiId      — ID teknisi yang melakukan verifikasi
 *   catatanTeknisi — Catatan/ringkasan dari teknisi (opsional)
 *
 * Header wajib: x-internal-secret: <INTERNAL_API_SECRET>
 */
router.post('/verify-teknisi', verifyInternalSecret, async (req: Request, res: Response) => {
  const { koneksiDataId, teknisiId, catatanTeknisi } = req.body;

  if (!koneksiDataId) {
    res.status(400).json({ success: false, message: 'koneksiDataId wajib diisi' });
    return;
  }

  try {
    const koneksi = await ConnectionData.findById(koneksiDataId).populate('idPelanggan');
    if (!koneksi) {
      res.status(404).json({ success: false, message: 'Data koneksi tidak ditemukan' });
      return;
    }

    if (koneksi.isVerifiedByTeknisi) {
      res.status(200).json({ success: true, message: 'Sudah diverifikasi sebelumnya', data: koneksi });
      return;
    }

    // Verify teknisi exists if provided
    if (teknisiId) {
      const teknisi = await Technician.findById(teknisiId);
      if (!teknisi) {
        res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
        return;
      }
    }

    koneksi.isVerifiedByTeknisi = true;
    koneksi.catatanTeknisi = catatanTeknisi || null;
    koneksi.tanggalVerifikasiTeknisi = new Date();
    await koneksi.save();

    // Notify all admins that technician has completed verification
    const pelangganNama = (koneksi.idPelanggan as any)?.namaLengkap || 'Pelanggan';
    await notifikasiSemuaAdmin(
      'Verifikasi Teknisi Selesai',
      `Teknisi telah menyelesaikan verifikasi untuk pengajuan sambungan atas nama ${pelangganNama}. Silakan lakukan penyelesaian prosedur akhir.`,
      'Informasi',
      `/operations/connection-data/${koneksiDataId}`,
    );

    logger.info({ koneksiDataId, teknisiId }, 'Verifikasi teknisi berhasil dari backend Rafli');

    res.status(200).json({
      success: true,
      message: 'Verifikasi teknisi berhasil dicatat',
      data: {
        _id: koneksi._id,
        isVerifiedByTeknisi: koneksi.isVerifiedByTeknisi,
        tanggalVerifikasiTeknisi: koneksi.tanggalVerifikasiTeknisi,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Gagal memproses verifikasi teknisi dari backend Rafli');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
