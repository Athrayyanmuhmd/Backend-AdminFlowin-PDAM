// @ts-nocheck
import ConnectionData from '../../../models/ConnectionData.js';
import Technician from '../../../models/Technician.js';
import { verifyAdminToken, catatAuditLog } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const koneksiDataResolvers = {
  Query: {
    getKoneksiData: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.findById(id).populate('idPelanggan').populate('idTeknisi').populate('assignedBy');
    },

    getAllKoneksiData: async (_, { limit = 50, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500)).populate('idPelanggan');
    },

    getPendingKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find({ statusVerifikasi: 'Menunggu' }).populate('idPelanggan');
    },

    getVerifiedKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find({ statusVerifikasi: 'Disetujui' }).populate('idPelanggan');
    },

    getDitolakKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find({ statusVerifikasi: 'Ditolak' }).populate('idPelanggan');
    },
  },

  Mutation: {
    createKoneksiData: async (_, args, { token }) => {
      verifyAdminToken(token);
      const { idPelanggan, NIK, NIKUrl, noKK, KKUrl, IMB, IMBUrl, alamat, kelurahan, kecamatan, luasBangunan } = args;
      const koneksi = new ConnectionData({
        idPelanggan: idPelanggan || null,
        NIK: NIK || null,
        NIKUrl: NIKUrl || null,
        noKK: noKK || null,
        KKUrl: KKUrl || null,
        IMB: IMB || null,
        IMBUrl: IMBUrl || null,
        alamat: alamat || null,
        kelurahan: kelurahan || null,
        kecamatan: kecamatan || null,
        luasBangunan: luasBangunan || null,
        statusVerifikasi: false,
      });
      await koneksi.save();
      return await ConnectionData.findById(koneksi._id).populate('idPelanggan');
    },

    verifyKoneksiData: async (_, { id, status, catatan, alasanPenolakan }, { token }) => {
      const validStatus = ['Menunggu', 'Disetujui', 'Ditolak'];
      if (!validStatus.includes(status)) throw new Error('Status tidak valid. Gunakan: Menunggu, Disetujui, atau Ditolak');
      if (status === 'Ditolak' && !alasanPenolakan) throw new Error('Alasan penolakan wajib diisi saat menolak pengajuan');
      const before = await ConnectionData.findById(id, 'statusVerifikasi');
      const updateData = {
        statusVerifikasi: status,
        catatan: catatan || null,
        tanggalVerifikasi: status !== 'Menunggu' ? new Date() : null,
        alasanPenolakan: status === 'Ditolak' ? alasanPenolakan : null,
      };
      const result = await ConnectionData.findByIdAndUpdate(id, updateData, { new: true })
        .populate('idPelanggan').populate('idTeknisi').populate('assignedBy');
      await catatAuditLog({ token, aksi: 'KONEKSI_VERIFY', resource: 'KoneksiData', resourceId: id, nilaiBefore: { statusVerifikasi: before?.statusVerifikasi }, nilaiAfter: { statusVerifikasi: status, alasanPenolakan } });
      return result;
    },

    updateKoneksiData: async (_, { id, input }) => {
      return await ConnectionData.findByIdAndUpdate(id, input, { new: true }).populate('idPelanggan');
    },

    deleteKoneksiData: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const koneksi = await ConnectionData.findById(id);
      if (!koneksi) throw new Error('Data koneksi tidak ditemukan');
      await ConnectionData.findByIdAndDelete(id);
      return true;
    },

    assignTeknisiToKoneksi: async (_, { id, technicianId }, { token }) => {
      const adminPayload = verifyAdminToken(token);
      const koneksi = await ConnectionData.findById(id);
      if (!koneksi) throw new Error('Data koneksi tidak ditemukan');
      const teknisi = await Technician.findById(technicianId);
      if (!teknisi) throw new Error('Teknisi tidak ditemukan');
      await catatAuditLog({ token, aksi: 'KONEKSI_ASSIGN_TEKNISI', resource: 'KoneksiData', resourceId: id, nilaiAfter: { idTeknisi: technicianId, namaTeknisi: teknisi.namaLengkap } });
      koneksi.idTeknisi = technicianId;
      koneksi.assignedAt = new Date();
      koneksi.assignedBy = (adminPayload as any).id;
      await koneksi.save();
      return await ConnectionData.findById(id).populate('idPelanggan').populate('idTeknisi').populate('assignedBy');
    },

    unassignTeknisiFromKoneksi: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const koneksi = await ConnectionData.findById(id);
      if (!koneksi) throw new Error('Data koneksi tidak ditemukan');
      await catatAuditLog({ token, aksi: 'KONEKSI_UNASSIGN_TEKNISI', resource: 'KoneksiData', resourceId: id, nilaiBefore: { idTeknisi: koneksi.idTeknisi } });
      koneksi.idTeknisi = null;
      koneksi.assignedAt = null;
      koneksi.assignedBy = null;
      await koneksi.save();
      return await ConnectionData.findById(id).populate('idPelanggan').populate('idTeknisi').populate('assignedBy');
    },
  },
};
