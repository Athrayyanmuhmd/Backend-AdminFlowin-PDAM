import jwt from 'jsonwebtoken';
import Notification from '../../../models/Notification.js';
import User from '../../../models/User.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

// Disesuaikan dengan Ahmad â€” Notification model fields PascalCase (IdAdmin, IdPelanggan, IdTeknisi, Judul, Pesan, Kategori, Link)
// GQL input uses camelCase â†’ map to PascalCase for DB

// Helper: map GQL camelCase input â†’ DB PascalCase
const mapInputToDb = (input: any) => {
  const mapped: any = {};
  if (input.idPelanggan !== undefined) mapped.IdPelanggan = input.idPelanggan;
  if (input.idAdmin !== undefined) mapped.IdAdmin = input.idAdmin;
  if (input.idTeknisi !== undefined) mapped.IdTeknisi = input.idTeknisi;
  if (input.judul !== undefined) mapped.Judul = input.judul;
  if (input.pesan !== undefined) mapped.Pesan = input.pesan;
  if (input.kategori !== undefined) mapped.Kategori = input.kategori;
  if (input.link !== undefined) mapped.Link = input.link;
  return mapped;
};

export const notifikasiResolvers = {
  Query: {
    getNotifikasi: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Notification.findById(id);
    },

    getNotifikasiByAdmin: async (_, { idAdmin }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Notification.find({ IdAdmin: idAdmin }).sort({ createdAt: -1 });
    },

    getUnreadNotifikasi: async (_, { idAdmin }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Notification.find({ IdAdmin: idAdmin, isRead: false }).sort({ createdAt: -1 });
    },

    // Returns [] instead of throwing when token invalid â€” polled every 30s
    // Returns ALL notifications (admin oversight: sent to pelanggan, teknisi, or admin)
    getAllNotifikasiAdmin: async (_, __, { token }) => {
      try { verifyAdminToken(token); } catch { return []; }
      return await Notification.find({})
        .populate('IdAdmin', 'namaLengkap')
        .populate('IdPelanggan', 'namaLengkap email')
        .populate('IdTeknisi', 'namaLengkap')
        .sort({ createdAt: -1 })
        .limit(200);
    },
  },

  Mutation: {
    createNotifikasi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!input.idAdmin && !input.idTeknisi && !input.idPelanggan) {
        throw new Error('Minimal satu recipient (idAdmin, idTeknisi, atau idPelanggan) harus diisi');
      }
      const dbData = mapInputToDb(input);
      return await new Notification({ ...dbData, isRead: false }).save();
    },

    broadcastNotifikasi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const dbData = mapInputToDb(input);
      const pengguna = await User.find({}, '_id').lean();
      return await Promise.all(
        pengguna.map(p => new Notification({ ...dbData, IdPelanggan: p._id, isRead: false }).save()),
      );
    },

    markNotifikasiAsRead: async (_, { id }) => {
      return await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
    },
  },
};
