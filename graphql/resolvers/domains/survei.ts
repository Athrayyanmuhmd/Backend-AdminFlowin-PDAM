// @ts-nocheck
import SurveyData from '../../../models/SurveyData.js';
import RabConnection from '../../../models/RabConnection.js';
import PekerjaanTeknisi from '../../../models/PekerjaanTeknisi.js';
import Technician from '../../../models/Technician.js';
import { verifyAdminToken, catatAuditLog } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

const SURVEI_POPULATE = [
  { path: 'idKoneksiData', populate: { path: 'idPelanggan' } },
];

const RAB_POPULATE = [
  { path: 'idKoneksiData', populate: { path: 'idPelanggan' } },
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
      return await RabConnection.find({ statusPembayaran: 'Pending' }).populate(RAB_POPULATE as any);
    },

    // Work order untuk survei tertentu
    getWOBySurvei: async (_, { surveiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.findOne({ idSurvei: surveiId }).populate('tim');
    },

    // Work order untuk RAB tertentu
    getWOByRAB: async (_, { rabId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.findOne({ rabId }).populate('tim');
    },
  },

  Mutation: {
    createSurvei: async (_, args, { token }) => {
      verifyAdminToken(token);
      const { idKoneksiData, urlJaringan, diameterPipa, urlPosisiBak, posisiMeteran, jumlahPenghuni, standar, catatan, koordinat } = args;
      const survei = new SurveyData({
        idKoneksiData, urlJaringan, diameterPipa, urlPosisiBak, posisiMeteran, jumlahPenghuni, standar,
        catatan: catatan || '',
        koordinat: koordinat || { latitude: null, longitude: null },
      });
      await survei.save();
      return await SurveyData.findById(survei._id).populate(SURVEI_POPULATE as any);
    },

    updateSurvei: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      Object.keys(updates).forEach(key => { if (updates[key] !== undefined) survei[key] = updates[key]; });
      await survei.save();
      return await SurveyData.findById(id).populate(SURVEI_POPULATE as any);
    },

    deleteSurvei: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      await SurveyData.findByIdAndDelete(id);
      return true;
    },

    // Assign teknisi untuk survei → buat PekerjaanTeknisi dengan idSurvei
    assignTeknisiSurvei: async (_, { surveiId, teknisiIds }, { token }) => {
      const adminPayload = verifyAdminToken(token);
      const survei = await SurveyData.findById(surveiId);
      if (!survei) throw new Error('Survei tidak ditemukan');

      // Cek apakah sudah ada WO untuk survei ini
      const existing = await PekerjaanTeknisi.findOne({ idSurvei: surveiId });
      if (existing) {
        // Update tim saja
        existing.tim = teknisiIds;
        existing.status = 'Ditugaskan';
        existing.disetujui = null;
        await existing.save();
        return await PekerjaanTeknisi.findById(existing._id).populate('tim').populate({ path: 'idSurvei', populate: SURVEI_POPULATE });
      }

      // Buat WO baru
      const wo = new PekerjaanTeknisi({
        idSurvei: surveiId,
        tim: teknisiIds,
        status: 'Ditugaskan',
        disetujui: null,
      });
      await wo.save();
      await catatAuditLog({ token, aksi: 'WO_ASSIGN_SURVEI', resource: 'PekerjaanTeknisi', resourceId: wo._id.toString(), nilaiAfter: { surveiId, teknisiIds } });
      return await PekerjaanTeknisi.findById(wo._id).populate('tim').populate({ path: 'idSurvei', populate: SURVEI_POPULATE });
    },

    // Assign teknisi untuk DED/RAB → buat PekerjaanTeknisi dengan rabId
    assignTeknisiRAB: async (_, { rabId, teknisiIds }, { token }) => {
      const adminPayload = verifyAdminToken(token);
      const rab = await RabConnection.findById(rabId);
      if (!rab) throw new Error('RAB tidak ditemukan');

      const existing = await PekerjaanTeknisi.findOne({ rabId });
      if (existing) {
        existing.tim = teknisiIds;
        existing.status = 'Ditugaskan';
        existing.disetujui = null;
        await existing.save();
        return await PekerjaanTeknisi.findById(existing._id).populate('tim');
      }

      const wo = new PekerjaanTeknisi({
        rabId,
        tim: teknisiIds,
        status: 'Ditugaskan',
        disetujui: null,
      });
      await wo.save();
      await catatAuditLog({ token, aksi: 'WO_ASSIGN_RAB', resource: 'PekerjaanTeknisi', resourceId: wo._id.toString(), nilaiAfter: { rabId, teknisiIds } });
      return await PekerjaanTeknisi.findById(wo._id).populate('tim');
    },

    createRABConnection: async (_, { idKoneksiData, totalBiaya, urlRab, catatan }, { token }) => {
      verifyAdminToken(token);
      const existing = await RabConnection.findOne({ idKoneksiData });
      if (existing) throw new Error('RAB untuk koneksi data ini sudah ada');
      const rab = new RabConnection({ idKoneksiData, totalBiaya, urlRab, catatan: catatan || '', statusPembayaran: 'Pending' });
      await rab.save();
      return await RabConnection.findById(rab._id).populate(RAB_POPULATE as any);
    },

    updateRABConnection: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      Object.keys(updates).forEach(key => { if (updates[key] !== undefined) rab[key] = updates[key]; });
      await rab.save();
      return await RabConnection.findById(id).populate(RAB_POPULATE as any);
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
