// @ts-nocheck
import PekerjaanTeknisi from '../../../models/PekerjaanTeknisi.js';
import { verifyAdminToken, notifikasiSemuaAdmin } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

const WO_POPULATE = [
  { path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } },
  { path: 'rabId' },
  { path: 'idLaporan', populate: { path: 'idPengguna' } },
  { path: 'tim' },
];

export const workOrderResolvers = {
  Query: {
    getWorkOrder: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.findById(id).populate(WO_POPULATE as any);
    },

    getAllWorkOrders: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find().limit(500).populate(WO_POPULATE as any).sort({ createdAt: -1 });
    },

    getWorkOrdersByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ status }).populate(WO_POPULATE as any).sort({ createdAt: -1 });
    },

    getWorkOrdersByTeknisi: async (_, { idTeknisi }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ tim: idTeknisi }).populate(WO_POPULATE as any).sort({ createdAt: -1 });
    },

    getPekerjaanTeknisi: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.findById(id)
        .populate('idSurvei').populate('rabId').populate('idPenyelesaianLaporan')
        .populate('idPemasangan').populate('idPengawasanPemasangan').populate('idPengawasanSetelahPemasangan')
        .populate('tim');
    },

    getAllPekerjaanTeknisi: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find().limit(500).populate('tim').sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ status }).populate('tim').sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiByTeknisi: async (_, { teknisiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ tim: teknisiId }).populate('tim').sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiPendingApproval: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ disetujui: null, status: 'DitinjauAdmin' }).populate('tim').sort({ createdAt: -1 });
    },
  },

  Mutation: {
    createWorkOrder: async (_, { input }) => {
      const workOrder = new PekerjaanTeknisi({ ...input, status: 'Ditugaskan', disetujui: null });
      const saved = await (await workOrder.save()).populate('tim');
      await notifikasiSemuaAdmin('Work Order Baru Dibuat', 'Work order baru telah dibuat dan ditugaskan ke teknisi.', 'Informasi', '/operations/work-orders');
      return saved;
    },

    assignWorkOrder: async (_, { id, teknisiIds }) => {
      return await PekerjaanTeknisi.findByIdAndUpdate(id, { tim: teknisiIds }, { new: true }).populate('tim');
    },

    updateWorkOrderStatus: async (_, { id, status, catatan }) => {
      const updated = await PekerjaanTeknisi.findByIdAndUpdate(id, { status, catatan }, { new: true }).populate('tim');
      if (status === 'DitinjauAdmin') {
        await notifikasiSemuaAdmin('Work Order Menunggu Peninjauan', 'Teknisi telah menyelesaikan pekerjaan dan membutuhkan persetujuan admin.', 'Peringatan', '/operations/work-orders');
      }
      return updated;
    },

    approveWorkOrder: async (_, { id, disetujui, catatan }) => {
      return await PekerjaanTeknisi.findByIdAndUpdate(id, { disetujui, catatan }, { new: true }).populate('tim');
    },
  },
};
