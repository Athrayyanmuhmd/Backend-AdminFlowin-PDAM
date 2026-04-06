// @ts-nocheck
import jwt from 'jsonwebtoken';
import Notification from '../../../models/Notification.js';
import User from '../../../models/User.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const notifikasiResolvers = {
  Query: {
    getNotifikasi: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Notification.findById(id);
    },

    getNotifikasiByAdmin: async (_, { idAdmin }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Notification.find({ idAdmin }).sort({ createdAt: -1 });
    },

    getUnreadNotifikasi: async (_, { idAdmin }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Notification.find({ idAdmin, isRead: false }).sort({ createdAt: -1 });
    },

    // Returns [] instead of throwing when token invalid — polled every 30s
    getAllNotifikasiAdmin: async (_, __, { token }) => {
      try { verifyAdminToken(token); } catch { return []; }
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      const adminId = decoded.id || decoded.userId;
      return await Notification.find({ idAdmin: adminId })
        .populate('idAdmin', 'namaLengkap')
        .populate('idPelanggan', 'namaLengkap email')
        .populate('idTeknisi', 'namaLengkap')
        .sort({ createdAt: -1 })
        .limit(50);
    },
  },

  Mutation: {
    createNotifikasi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!input.idAdmin && !input.idTeknisi && !input.idPelanggan) {
        throw new Error('Minimal satu recipient (idAdmin, idTeknisi, atau idPelanggan) harus diisi');
      }
      return await new Notification({ ...input, isRead: false }).save();
    },

    broadcastNotifikasi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const pengguna = await User.find({}, '_id').lean();
      return await Promise.all(
        pengguna.map(p => new Notification({ ...input, idPelanggan: p._id, isRead: false }).save()),
      );
    },

    markNotifikasiAsRead: async (_, { id }) => {
      return await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
    },
  },
};
