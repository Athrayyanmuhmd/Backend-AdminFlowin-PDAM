// @ts-nocheck
import KoneksiData from '../../../models/ConnectionData.js';
import { verifyAdminToken, catatAuditLog, notifikasiUntukPelanggan, notifikasiSemuaAdmin } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const koneksiDataResolvers = {
  Query: {
    getKoneksiData: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.findById(id).populate('IdPelanggan');
    },

    getKoneksiDataByPelanggan: async (_, { idPelanggan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.findOne({ IdPelanggan: idPelanggan })
        .sort({ createdAt: -1 })
        .populate('IdPelanggan');
    },

    getAllKoneksiData: async (_, { limit = 50, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 500))
        .populate('IdPelanggan');
    },

    getPendingKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // Mendukung format baru (PascalCase) dan lama (camelCase Ahmad)
      return await KoneksiData.find({
        $or: [
          { StatusPengajuan: 'PENDING' },
          { statusPengajuan: 'pending' },
          { statusVerifikasi: 'menunggu' },
        ],
      }).sort({ createdAt: -1 }).populate('IdPelanggan');
    },

    getApprovedKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.find({
        $or: [
          { StatusPengajuan: 'APPROVED' },
          { statusPengajuan: 'approved' },
          { statusVerifikasi: 'disetujui' },
        ],
      }).sort({ createdAt: -1 }).populate('IdPelanggan');
    },

    getRejectedKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.find({
        $or: [
          { StatusPengajuan: 'REJECTED' },
          { statusPengajuan: 'rejected' },
          { statusVerifikasi: 'ditolak' },
        ],
      }).sort({ createdAt: -1 }).populate('IdPelanggan');
    },
  },

  Mutation: {
    createKoneksiData: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const koneksi = new KoneksiData({
        IdPelanggan: input.IdPelanggan,
        NIK: input.NIK,
        NIKUrl: input.NIKUrl,
        NoKK: input.NoKK,
        KKUrl: input.KKUrl,
        IMB: input.IMB,
        IMBUrl: input.IMBUrl,
        Alamat: input.Alamat,
        Kelurahan: input.Kelurahan,
        Kecamatan: input.Kecamatan,
        LuasBangunan: input.LuasBangunan,
        StatusPengajuan: 'PENDING',
        catatan: input.catatan || null,
      });
      await koneksi.save();

      // Notify semua admin bahwa ada pengajuan sambungan baru
      await notifikasiSemuaAdmin(
        'Pengajuan Sambungan Baru',
        'Ada pengajuan sambungan air baru yang menunggu verifikasi.',
        'INFORMASI',
        `/operations/connection-data/${koneksi._id}`,
      );

      return await KoneksiData.findById(koneksi._id).populate('IdPelanggan');
    },

    verifyKoneksiData: async (_, { id, status, alasanPenolakan, catatan }, { token }) => {
      verifyAdminToken(token);
      if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
        throw new Error('Status tidak valid. Gunakan: PENDING, APPROVED, atau REJECTED');
      }
      if (status === 'REJECTED' && !alasanPenolakan) {
        throw new Error('Alasan penolakan wajib diisi saat menolak pengajuan');
      }
      const before = await KoneksiData.findById(id, 'StatusPengajuan');
      const updateData: any = {
        StatusPengajuan: status,
        TanggalVerifikasi: status !== 'PENDING' ? new Date() : null,
        AlasanPenolakan: status === 'REJECTED' ? alasanPenolakan : null,
      };
      if (catatan !== undefined) updateData.catatan = catatan;

      const result = await KoneksiData.findByIdAndUpdate(id, updateData, { new: true })
        .populate('IdPelanggan');
      await catatAuditLog({
        token,
        aksi: 'KONEKSI_VERIFY',
        resource: 'KoneksiData',
        resourceId: id,
        nilaiBefore: { StatusPengajuan: before?.StatusPengajuan },
        nilaiAfter: { StatusPengajuan: status, AlasanPenolakan: alasanPenolakan },
      });

      // Kirim notifikasi ke pelanggan — dibaca oleh Ahmad's user app
      const pelangganId = (result?.IdPelanggan as any)?._id?.toString()
        ?? (result?.IdPelanggan as any)?.toString();
      if (pelangganId) {
        if (status === 'APPROVED') {
          await notifikasiUntukPelanggan(
            pelangganId,
            'Pengajuan Sambungan Disetujui',
            'Selamat! Pengajuan sambungan air Anda telah disetujui. Tim teknisi akan segera menghubungi Anda untuk survei.',
            'INFORMASI',
            '/connection-data',
          );
        } else if (status === 'REJECTED') {
          await notifikasiUntukPelanggan(
            pelangganId,
            'Pengajuan Sambungan Ditolak',
            `Pengajuan sambungan air Anda ditolak. Alasan: ${alasanPenolakan || 'Tidak ada keterangan'}. Anda dapat mengajukan ulang setelah memperbaiki dokumen.`,
            'INFORMASI',
            '/connection-data',
          );
        }
      }

      return result;
    },

    updateKoneksiData: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await KoneksiData.findByIdAndUpdate(id, input, { new: true }).populate('IdPelanggan');
    },

    deleteKoneksiData: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await KoneksiData.findByIdAndDelete(id);
      return { success: true, message: 'KoneksiData berhasil dihapus' };
    },
  },
};
