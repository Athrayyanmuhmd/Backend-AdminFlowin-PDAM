// @ts-nocheck
import Pemasangan from '../../../models/Pemasangan.js';
import PengawasanPemasangan from '../../../models/PengawasanPemasangan.js';
import PengawasanSetelahPemasangan from '../../../models/PengawasanSetelahPemasangan.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const pemasanganResolvers = {
  Query: {
    getPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findById(id).populate('idKoneksiData').populate('teknisiId').populate('diverifikasiOleh');
    },

    getPemasanganByKoneksiData: async (_, { idKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findOne({ idKoneksiData }).populate('idKoneksiData').populate('teknisiId').populate('diverifikasiOleh');
    },

    getPemasanganByTeknisi: async (_, { teknisiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find({ teknisiId }).populate('idKoneksiData').populate('diverifikasiOleh').sort({ tanggalPemasangan: -1 });
    },

    getPemasanganByStatus: async (_, { statusVerifikasi }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find({ statusVerifikasi }).populate('idKoneksiData').populate('teknisiId').populate('diverifikasiOleh').sort({ tanggalPemasangan: -1 });
    },

    getAllPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find().limit(500).populate('idKoneksiData').populate('teknisiId').populate('diverifikasiOleh').sort({ tanggalPemasangan: -1 });
    },

    getPengawasanPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.findById(id).populate('idPemasangan').populate('supervisorId');
    },

    getPengawasanPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ idPemasangan }).populate('supervisorId').sort({ tanggalPengawasan: -1 });
    },

    getPengawasanPemasanganBySupervisor: async (_, { supervisorId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ supervisorId }).populate('idPemasangan').sort({ tanggalPengawasan: -1 });
    },

    getPengawasanPemasanganProblematic: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ $or: [{ hasilPengawasan: { $in: ['Perbaikan Diperlukan', 'Tidak Sesuai'] } }, { perluTindakLanjut: true }] })
        .populate('idPemasangan').populate('supervisorId').sort({ tanggalPengawasan: -1 });
    },

    getAllPengawasanPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find().limit(500).populate('idPemasangan').populate('supervisorId').sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.findById(id).populate('idPemasangan').populate('supervisorId');
    },

    getPengawasanSetelahPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ idPemasangan }).populate('supervisorId').sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasanganBySupervisor: async (_, { supervisorId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ supervisorId }).populate('idPemasangan').sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasanganProblematic: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ $or: [{ hasilPengawasan: 'Bermasalah' }, { statusMeteran: { $ne: 'Berfungsi Normal' } }, { perluTindakLanjut: true }] })
        .populate('idPemasangan').populate('supervisorId').sort({ tanggalPengawasan: -1 });
    },

    getAllPengawasanSetelahPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find().limit(500).populate('idPemasangan').populate('supervisorId').sort({ tanggalPengawasan: -1 });
    },

    getAverageCustomerRating: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.getAverageRating();
    },
  },

  Mutation: {
    createPemasangan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      return await new Pemasangan(input).save();
    },

    updatePemasangan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await Pemasangan.findByIdAndUpdate(id, input, { new: true });
    },

    deletePemasangan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await Pemasangan.findByIdAndDelete(id);
      return true;
    },

    verifyPemasangan: async (_, { id, statusVerifikasi, catatan }, { token }) => {
      const admin = verifyAdminToken(token);
      return await Pemasangan.findByIdAndUpdate(
        id,
        { statusVerifikasi, diverifikasiOleh: (admin as any).id, tanggalVerifikasi: new Date().toISOString(), ...(catatan && { catatan }) },
        { new: true },
      );
    },

    createPengawasanPemasangan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      return await new PengawasanPemasangan(input).save();
    },

    updatePengawasanPemasangan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.findByIdAndUpdate(id, input, { new: true });
    },

    deletePengawasanPemasangan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await PengawasanPemasangan.findByIdAndDelete(id);
      return true;
    },

    createPengawasanSetelahPemasangan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      return await new PengawasanSetelahPemasangan(input).save();
    },

    updatePengawasanSetelahPemasangan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.findByIdAndUpdate(id, input, { new: true });
    },

    deletePengawasanSetelahPemasangan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await PengawasanSetelahPemasangan.findByIdAndDelete(id);
      return true;
    },
  },
};
