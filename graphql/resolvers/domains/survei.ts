// @ts-nocheck
import SurveyData from '../../../models/SurveyData.js';
import RabConnection from '../../../models/RabConnection.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const surveiResolvers = {
  Query: {
    getSurvei: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.findById(id).populate('idKoneksiData').populate('idTeknisi');
    },

    getAllSurvei: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.find().populate('idKoneksiData').populate('idTeknisi');
    },

    getRABConnection: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.findById(id).populate('idKoneksiData');
    },

    getAllRABConnections: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.find().populate('idKoneksiData');
    },

    getPendingRAB: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.find({ statusPembayaran: 'Pending' }).populate('idKoneksiData');
    },
  },

  Mutation: {
    createSurvei: async (_, args, { token }) => {
      verifyAdminToken(token);
      const { idKoneksiData, idTeknisi, urlJaringan, diameterPipa, urlPosisiBak, posisiMeteran, jumlahPenghuni, standar, catatan, koordinat } = args;
      const survei = new SurveyData({
        idKoneksiData, idTeknisi, urlJaringan, diameterPipa, urlPosisiBak, posisiMeteran, jumlahPenghuni, standar,
        catatan: catatan || '',
        koordinat: koordinat || { latitude: null, longitude: null },
      });
      await survei.save();
      return await SurveyData.findById(survei._id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .populate('idTeknisi');
    },

    updateSurvei: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      Object.keys(updates).forEach(key => { if (updates[key] !== undefined) survei[key] = updates[key]; });
      await survei.save();
      return await SurveyData.findById(id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .populate('idTeknisi');
    },

    deleteSurvei: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      await SurveyData.findByIdAndDelete(id);
      return true;
    },

    createRABConnection: async (_, { idKoneksiData, totalBiaya, urlRab, catatan }, { token }) => {
      verifyAdminToken(token);
      const existing = await RabConnection.findOne({ idKoneksiData });
      if (existing) throw new Error('RAB untuk koneksi data ini sudah ada');
      const rab = new RabConnection({ idKoneksiData, totalBiaya, urlRab, catatan: catatan || '', statusPembayaran: 'Pending' });
      await rab.save();
      return await RabConnection.findById(rab._id).populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    updateRABConnection: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      Object.keys(updates).forEach(key => { if (updates[key] !== undefined) rab[key] = updates[key]; });
      await rab.save();
      return await RabConnection.findById(id).populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    deleteRABConnection: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      await RabConnection.findByIdAndDelete(id);
      return true;
    },
  },
};
