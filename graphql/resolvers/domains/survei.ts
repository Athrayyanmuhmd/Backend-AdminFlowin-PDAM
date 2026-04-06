// @ts-nocheck
import SurveyData from '../../../models/SurveyData.js';
import RabConnection from '../../../models/RabConnection.js';
import ConnectionData from '../../../models/ConnectionData.js';
import { verifyAdminToken, notifikasiSemuaAdmin } from '../helpers.js';
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

    approveRAB: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB tidak ditemukan');
      rab.statusVerifikasiAdmin = 'Disetujui';
      rab.alasanPenolakan = null;
      rab.tanggalVerifikasiAdmin = new Date();
      await rab.save();
      return await RabConnection.findById(id).populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    rejectRAB: async (_, { id, alasanPenolakan }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB tidak ditemukan');
      rab.statusVerifikasiAdmin = 'Ditolak';
      rab.alasanPenolakan = alasanPenolakan;
      rab.tanggalVerifikasiAdmin = new Date();
      await rab.save();
      return await RabConnection.findById(id).populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    approveSurvei: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      survei.statusSurvei = 'Disetujui';
      survei.alasanPenolakan = null;
      survei.tanggalVerifikasiAdmin = new Date();
      await survei.save();
      return await SurveyData.findById(id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .populate('idTeknisi');
    },

    rejectSurvei: async (_, { id, alasanPenolakan }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id).populate('idKoneksiData');
      if (!survei) throw new Error('Survei tidak ditemukan');

      survei.statusSurvei = 'Ditolak';
      survei.alasanPenolakan = alasanPenolakan;
      survei.tanggalVerifikasiAdmin = new Date();
      await survei.save();

      // Reset KoneksiData so admin can reassign teknisi for new survey
      if (survei.idKoneksiData) {
        await ConnectionData.findByIdAndUpdate(survei.idKoneksiData._id || survei.idKoneksiData, {
          $set: { isVerifiedByTeknisi: false, catatanTeknisi: null, tanggalVerifikasiTeknisi: null },
        });
      }

      // Notify all admins
      const koneksiData = await ConnectionData.findById(survei.idKoneksiData._id || survei.idKoneksiData)
        .populate('idPelanggan');
      const namaPelanggan = (koneksiData?.idPelanggan as any)?.namaLengkap || 'Pelanggan';
      await notifikasiSemuaAdmin(
        'Survei Ditolak',
        `Hasil survei dari ${namaPelanggan} telah ditolak. Alasan: ${alasanPenolakan}. Silakan assign teknisi baru untuk survei ulang.`,
        'Peringatan',
        `/operations/connection-data/${survei.idKoneksiData._id || survei.idKoneksiData}`,
      );

      return await SurveyData.findById(id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .populate('idTeknisi');
    },
  },
};
