import { Request, Response } from 'express';
import ConnectionData from '../models/ConnectionData.js';
import { uploadDocument } from '../utils/cloudinary.js';
import logger from '../utils/logger.js';

type JenisDokumen = 'NIK' | 'KK' | 'IMB';

const FIELD_MAP: Record<JenisDokumen, keyof typeof fieldToUrl> = {
  NIK: 'NIKUrl',
  KK: 'KKUrl',
  IMB: 'IMBUrl',
} as const;

// diperlukan agar TypeScript tahu field mana yang diupdate
const fieldToUrl = {
  NIKUrl: true,
  KKUrl: true,
  IMBUrl: true,
} as const;

/**
 * POST /api/connection-data/:id/upload-dokumen?jenis=NIK|KK|IMB
 *
 * Admin mengupload hardcopy yang sudah di-scan untuk pelanggan walk-in.
 * File dikirim sebagai multipart/form-data dengan field name "file".
 * Setelah upload ke Cloudinary, URL disimpan ke field NIKUrl/KKUrl/IMBUrl.
 */
export const uploadDokumenKoneksiData = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const jenis = (req.query.jenis as string)?.toUpperCase() as JenisDokumen;

  if (!['NIK', 'KK', 'IMB'].includes(jenis)) {
    res.status(400).json({ status: 400, pesan: 'Parameter jenis harus NIK, KK, atau IMB.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ status: 400, pesan: 'File dokumen wajib disertakan.' });
    return;
  }

  try {
    const koneksiData = await ConnectionData.findById(id);
    if (!koneksiData) {
      res.status(404).json({ status: 404, pesan: 'Data sambungan tidak ditemukan.' });
      return;
    }

    // Upload ke Cloudinary — pakai uploadDocument agar watermark otomatis diterapkan
    const url = await uploadDocument(
      req.file.buffer,
      'aqualink/dokumen-pengajuan',
      req.file.mimetype,
    );

    // Update field yang sesuai
    const urlField = `${jenis}Url` as 'NIKUrl' | 'KKUrl' | 'IMBUrl';
    (koneksiData as any)[urlField] = url;
    await koneksiData.save();

    logger.info(
      { id, jenis, urlField, adminId: (req as any).admin?._id },
      'Dokumen pengajuan berhasil diupload oleh admin',
    );

    res.json({
      status: 200,
      pesan: `Dokumen ${jenis} berhasil diupload.`,
      url,
      jenis,
    });
  } catch (err: any) {
    logger.error({ err, id, jenis }, 'Gagal upload dokumen koneksi data');
    res.status(500).json({ status: 500, pesan: err.message || 'Gagal mengupload dokumen.' });
  }
};
