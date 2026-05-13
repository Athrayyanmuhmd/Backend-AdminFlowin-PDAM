import Pemasangan from '../../../models/Pemasangan.js';
import PengawasanPemasangan from '../../../models/PengawasanPemasangan.js';
import PengawasanSetelahPemasangan from '../../../models/PengawasanSetelahPemasangan.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

// Disesuaikan dengan Rafli â€” model simplified, no teknisiId/supervisorId/statusVerifikasi

// Deep populate: Pemasangan â†’ KoneksiData â†’ Pengguna (IdPelanggan)
const PEMASANGAN_KONEKSI_POPULATE = {
  path: 'idKoneksiData',
  model: 'KoneksiData',
  populate: { path: 'IdPelanggan', model: 'Pengguna' },
};

// Deep populate: Pengawasan â†’ Pemasangan â†’ KoneksiData â†’ Pengguna
const PENGAWASAN_DEEP_POPULATE = {
  path: 'idPemasangan',
  model: 'Pemasangan',
  populate: {
    path: 'idKoneksiData',
    model: 'KoneksiData',
    populate: { path: 'IdPelanggan', model: 'Pengguna' },
  },
};

export const pemasanganResolvers = {
  Query: {
    getPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findById(id).populate(PEMASANGAN_KONEKSI_POPULATE);
    },

    getPemasanganByKoneksiData: async (_, { idKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findOne({ idKoneksiData }).populate(PEMASANGAN_KONEKSI_POPULATE);
    },

    getAllPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find().limit(500).populate(PEMASANGAN_KONEKSI_POPULATE).sort({ createdAt: -1 });
    },

    getPengawasanPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.findById(id).populate(PENGAWASAN_DEEP_POPULATE);
    },

    getPengawasanPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ idPemasangan }).populate(PENGAWASAN_DEEP_POPULATE).sort({ createdAt: -1 });
    },

    getAllPengawasanPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find().limit(500).populate(PENGAWASAN_DEEP_POPULATE).sort({ createdAt: -1 });
    },

    getPengawasanSetelahPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.findById(id).populate(PENGAWASAN_DEEP_POPULATE);
    },

    getPengawasanSetelahPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ idPemasangan }).populate(PENGAWASAN_DEEP_POPULATE).sort({ createdAt: -1 });
    },

    getAllPengawasanSetelahPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find().limit(500).populate(PENGAWASAN_DEEP_POPULATE).sort({ createdAt: -1 });
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

    reviewPemasangan: async (_, { id, disetujui, catatan }, { token }) => {
      verifyAdminToken(token);
      return await Pemasangan.findByIdAndUpdate(
        id,
        { statusAdmin: disetujui ? 'disetujui' : 'ditolak', catatanAdmin: catatan || null },
        { new: true }
      ).populate(PEMASANGAN_KONEKSI_POPULATE);
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

    reviewPengawasanPemasangan: async (_, { id, disetujui, catatan }, { token }) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.findByIdAndUpdate(
        id,
        { statusAdmin: disetujui ? 'disetujui' : 'ditolak', catatanAdmin: catatan || null },
        { new: true }
      );
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

    reviewPengawasanSetelahPemasangan: async (_, { id, disetujui, catatan }, { token }) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.findByIdAndUpdate(
        id,
        { statusAdmin: disetujui ? 'disetujui' : 'ditolak', catatanAdmin: catatan || null },
        { new: true }
      );
    },
  },
};
