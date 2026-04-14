// @ts-nocheck
import Pemasangan from '../../../models/Pemasangan.js';
import PengawasanPemasangan from '../../../models/PengawasanPemasangan.js';
import PengawasanSetelahPemasangan from '../../../models/PengawasanSetelahPemasangan.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

// Disesuaikan dengan Rafli — model simplified, no teknisiId/supervisorId/statusVerifikasi

export const pemasanganResolvers = {
  Query: {
    getPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findById(id).populate('idKoneksiData');
    },

    getPemasanganByKoneksiData: async (_, { idKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findOne({ idKoneksiData }).populate('idKoneksiData');
    },

    getAllPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find().limit(500).populate('idKoneksiData').sort({ createdAt: -1 });
    },

    getPengawasanPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.findById(id).populate('idPemasangan');
    },

    getPengawasanPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ idPemasangan }).sort({ createdAt: -1 });
    },

    getAllPengawasanPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find().limit(500).populate('idPemasangan').sort({ createdAt: -1 });
    },

    getPengawasanSetelahPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.findById(id).populate('idPemasangan');
    },

    getPengawasanSetelahPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ idPemasangan }).sort({ createdAt: -1 });
    },

    getAllPengawasanSetelahPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find().limit(500).populate('idPemasangan').sort({ createdAt: -1 });
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
