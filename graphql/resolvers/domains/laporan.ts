// @ts-nocheck
import Report from '../../../models/Report.js';
import PekerjaanTeknisi from '../../../models/PekerjaanTeknisi.js';
import PenyelesaianLaporan from '../../../models/PenyelesaianLaporan.js';
import { verifyAdminToken, notifikasiSemuaAdmin } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const laporanResolvers = {
  Query: {
    getLaporan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.findById(id).populate('idPengguna');
    },

    getAllLaporan: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500)).populate('idPengguna');
    },

    getLaporanByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find({ status }).populate('idPengguna');
    },

    getLaporanByPelanggan: async (_, { idPelanggan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find({ idPengguna: idPelanggan }).populate('idPengguna');
    },

    getPenyelesaianLaporan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.findById(id).populate('idLaporan').populate('teknisiId');
    },

    getPenyelesaianLaporanByLaporan: async (_, { idLaporan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find({ idLaporan }).populate('teknisiId').sort({ tanggalSelesai: -1 });
    },

    getPenyelesaianLaporanByTeknisi: async (_, { teknisiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find({ teknisiId }).populate('idLaporan').sort({ tanggalSelesai: -1 });
    },

    getAllPenyelesaianLaporan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find().limit(500).populate('idLaporan').populate('teknisiId').sort({ tanggalSelesai: -1 });
    },
  },

  Mutation: {
    updateLaporanStatus: async (_, { id, status }) => {
      const updated = await Report.findByIdAndUpdate(id, { status }, { new: true }).populate('idPengguna');
      if (status === 'Diajukan') {
        await notifikasiSemuaAdmin('Laporan Pelanggan Baru', 'Ada laporan baru dari pelanggan yang memerlukan penanganan.', 'Peringatan', '/operations/laporan');
      }
      return updated;
    },

    createWorkOrderFromLaporan: async (_, { idLaporan, teknisiIds, catatan }) => {
      const laporan = await Report.findById(idLaporan);
      if (!laporan) throw new Error('Laporan tidak ditemukan');
      const existingWO = await PekerjaanTeknisi.findOne({ idLaporan, status: { $nin: ['Selesai', 'Dibatalkan'] } });
      if (existingWO) throw new Error('Work order aktif untuk laporan ini sudah ada');

      const workOrder = new PekerjaanTeknisi({ idLaporan, tim: teknisiIds, status: 'Ditugaskan', disetujui: null, catatan: catatan || '' });
      const saved = await workOrder.save();
      await Report.findByIdAndUpdate(idLaporan, { status: 'ProsesPerbaikan' });
      await notifikasiSemuaAdmin('Work Order Baru dari Laporan', `Work order telah dibuat untuk menangani laporan: ${laporan.namaLaporan}`, 'Informasi', '/operations/work-orders');

      return await PekerjaanTeknisi.findById(saved._id)
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim');
    },

    createPenyelesaianLaporan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const penyelesaian = new PenyelesaianLaporan(input);
      const saved = await penyelesaian.save();
      if (input.idLaporan) await Report.findByIdAndUpdate(input.idLaporan, { status: 'Selesai' });
      return saved;
    },

    updatePenyelesaianLaporan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.findByIdAndUpdate(id, input, { new: true });
    },

    deletePenyelesaianLaporan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await PenyelesaianLaporan.findByIdAndDelete(id);
      return true;
    },
  },
};
