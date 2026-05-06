import AksesLog from '../../../models/AksesLog.js';
import { verifyAdminOnlyToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const aksesLogResolvers = {
  Query: {
    getAksesLog: async (
      _: any,
      { idAdmin, idPemilik, limit = 100, offset = 0 }: { idAdmin?: string; idPemilik?: string; limit?: number; offset?: number },
      { token }: GraphQLContext
    ) => {
      verifyAdminOnlyToken(token);
      const filter: Record<string, any> = {};
      if (idAdmin)   filter.idAdmin   = idAdmin;
      if (idPemilik) filter.idPemilik = idPemilik;
      return await AksesLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 500))
        .lean();
    },

    getAksesLogStats: async (
      _: any,
      { jamTerakhir = 24 }: { jamTerakhir?: number },
      { token }: GraphQLContext
    ) => {
      verifyAdminOnlyToken(token);
      const batasWaktu = new Date(Date.now() - jamTerakhir * 60 * 60 * 1000);
      const stats = await AksesLog.aggregate([
        { $match: { createdAt: { $gte: batasWaktu } } },
        { $group: { _id: { idAdmin: '$idAdmin', namaAdmin: '$namaAdmin' }, jumlahAkses: { $sum: 1 } } },
        { $sort: { jumlahAkses: -1 } },
        { $project: { _id: 0, idAdmin: '$_id.idAdmin', namaAdmin: '$_id.namaAdmin', jumlahAkses: 1 } },
      ]);
      return stats;
    },
  },
};
