// @ts-nocheck
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import { verifyAdminToken } from '../helpers.js';
import { getCache, setCache, deleteCacheByPattern } from '../../../utils/redis.js';

export const kelompokPelangganResolvers = {
  Query: {
    getKelompokPelanggan: async (_, { id }) => {
      const cacheKey = `kelompok:${id}`;
      const cached = await getCache(cacheKey);
      if (cached) return cached;
      const kelompok = await KelompokPelanggan.findById(id);
      if (kelompok) await setCache(cacheKey, kelompok.toObject(), 3600);
      return kelompok;
    },

    getAllKelompokPelanggan: async () => {
      const cacheKey = 'kelompok:all';
      const cached = await getCache(cacheKey);
      if (cached) return cached;
      const list = await KelompokPelanggan.find();
      await setCache(cacheKey, list.map(k => k.toObject()), 3600);
      return list;
    },
  },

  Mutation: {
    createKelompokPelanggan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const { hargaDiBawah10mKubik, hargaDiAtas10mKubik, biayaBeban } = input;
      if (hargaDiBawah10mKubik < 0 || !Number.isFinite(hargaDiBawah10mKubik)) throw new Error('hargaDiBawah10mKubik harus positif');
      if (hargaDiAtas10mKubik < 0 || !Number.isFinite(hargaDiAtas10mKubik)) throw new Error('hargaDiAtas10mKubik harus positif');
      if (biayaBeban != null && (biayaBeban < 0 || !Number.isFinite(biayaBeban))) throw new Error('biayaBeban harus positif');
      const kelompok = new KelompokPelanggan(input);
      await kelompok.save();
      await deleteCacheByPattern('kelompok:*');
      return kelompok;
    },

    updateKelompokPelanggan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      const { hargaDiBawah10mKubik, hargaDiAtas10mKubik, biayaBeban } = input;
      if (hargaDiBawah10mKubik !== undefined && (hargaDiBawah10mKubik < 0 || !Number.isFinite(hargaDiBawah10mKubik))) throw new Error('hargaDiBawah10mKubik harus positif');
      if (hargaDiAtas10mKubik !== undefined && (hargaDiAtas10mKubik < 0 || !Number.isFinite(hargaDiAtas10mKubik))) throw new Error('hargaDiAtas10mKubik harus positif');
      if (biayaBeban != null && (biayaBeban < 0 || !Number.isFinite(biayaBeban))) throw new Error('biayaBeban harus positif');
      const kelompok = await KelompokPelanggan.findByIdAndUpdate(id, input, { new: true });
      await deleteCacheByPattern('kelompok:*');
      return kelompok;
    },

    deleteKelompokPelanggan: async (_, { id }) => {
      await KelompokPelanggan.findByIdAndDelete(id);
      await deleteCacheByPattern('kelompok:*');
      return { success: true, message: 'Kelompok Pelanggan deleted successfully' };
    },
  },
};
