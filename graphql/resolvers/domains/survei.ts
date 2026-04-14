// @ts-nocheck
import SurveyData from '../../../models/SurveyData.js';
import RabConnection from '../../../models/RabConnection.js';
import { verifyAdminToken, catatAuditLog } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

// Populate sesuai PascalCase field names Ahmad/Rafli
const SURVEI_POPULATE = [
  { path: 'idKoneksiData', populate: { path: 'IdPelanggan' } },
];

const RAB_POPULATE = [
  { path: 'idKoneksiData', populate: { path: 'IdPelanggan' } },
];

export const surveiResolvers = {
  Query: {
    getSurvei: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.findById(id).populate(SURVEI_POPULATE as any);
    },

    getAllSurvei: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.find().sort({ createdAt: -1 }).populate(SURVEI_POPULATE as any);
    },

    getSurveiByKoneksiData: async (_, { idKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.findOne({ idKoneksiData }).populate(SURVEI_POPULATE as any);
    },

    getRABConnection: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.findById(id).populate(RAB_POPULATE as any);
    },

    getAllRABConnections: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.find().sort({ createdAt: -1 }).populate(RAB_POPULATE as any);
    },

    getPendingRAB: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.find({ statusPembayaran: 'pending' }).populate(RAB_POPULATE as any);
    },

    getRABByKoneksiData: async (_, { idKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.findOne({ idKoneksiData }).populate(RAB_POPULATE as any);
    },
  },

  Mutation: {
    createSurvei: async (_, args, { token }) => {
      verifyAdminToken(token);
      const { idKoneksiData, urlJaringan, diameterPipa, urlPosisiBak, posisiMeteran, jumlahPenghuni, standar, catatan, koordinat } = args;
      const survei = new SurveyData({
        idKoneksiData,
        urlJaringan,
        diameterPipa,
        urlPosisiBak,
        posisiMeteran,
        jumlahPenghuni: jumlahPenghuni ?? null,  // Int sesuai Rafli
        standar: standar ?? false,
        catatan: catatan || '',
        koordinat: koordinat || { longitude: null, latitude: null },
      });
      await survei.save();
      return await SurveyData.findById(survei._id).populate(SURVEI_POPULATE as any);
    },

    updateSurvei: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      Object.keys(updates).forEach(key => { if (updates[key] !== undefined) (survei as any)[key] = updates[key]; });
      await survei.save();
      return await SurveyData.findById(id).populate(SURVEI_POPULATE as any);
    },

    deleteSurvei: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      await SurveyData.findByIdAndDelete(id);
      return { success: true, message: 'Survei berhasil dihapus' };
    },

    createRABConnection: async (_, { idKoneksiData, totalBiaya, urlRab, catatan }, { token }) => {
      verifyAdminToken(token);
      const existing = await RabConnection.findOne({ idKoneksiData });
      if (existing) throw new Error('RAB untuk koneksi data ini sudah ada');
      const rab = new RabConnection({
        idKoneksiData,
        totalBiaya: totalBiaya ?? null,
        urlRab: urlRab || '',
        catatan: catatan || '',
        statusPembayaran: 'pending',
      });
      await rab.save();
      return await RabConnection.findById(rab._id).populate(RAB_POPULATE as any);
    },

    updateRABConnection: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      Object.keys(updates).forEach(key => { if (updates[key] !== undefined) (rab as any)[key] = updates[key]; });
      await rab.save();
      return await RabConnection.findById(id).populate(RAB_POPULATE as any);
    },

    deleteRABConnection: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      await RabConnection.findByIdAndDelete(id);
      return { success: true, message: 'RAB Connection berhasil dihapus' };
    },
  },
};
