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
      const { TarifRendah, TarifTinggi, BiayaBeban, KodeKelompok } = input;

      // Validasi angka negatif
      if (TarifRendah != null && (TarifRendah < 0 || !Number.isFinite(TarifRendah))) throw new Error('TarifRendah harus positif');
      if (TarifTinggi != null && (TarifTinggi < 0 || !Number.isFinite(TarifTinggi))) throw new Error('TarifTinggi harus positif');
      if (BiayaBeban != null && (BiayaBeban < 0 || !Number.isFinite(BiayaBeban))) throw new Error('BiayaBeban harus positif');

      // Cek duplikat sebelum simpan â€” beri pesan yang jelas
      const existing = await KelompokPelanggan.findOne({
        KodeKelompok: { $regex: `^${KodeKelompok.trim().toUpperCase()}$`, $options: 'i' },
      });
      if (existing) {
        throw new Error(`Kode "${KodeKelompok.trim().toUpperCase()}" sudah digunakan. Gunakan kode lain atau edit yang sudah ada.`);
      }

      const kelompok = new KelompokPelanggan({ ...input, KodeKelompok: KodeKelompok.trim().toUpperCase() });
      await kelompok.save();
      await deleteCacheByPattern('kelompok:*');
      return kelompok;
    },

    updateKelompokPelanggan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      const { TarifRendah, TarifTinggi, BiayaBeban } = input;
      if (TarifRendah !== undefined && (TarifRendah < 0 || !Number.isFinite(TarifRendah))) throw new Error('TarifRendah harus positif');
      if (TarifTinggi !== undefined && (TarifTinggi < 0 || !Number.isFinite(TarifTinggi))) throw new Error('TarifTinggi harus positif');
      if (BiayaBeban != null && (BiayaBeban < 0 || !Number.isFinite(BiayaBeban))) throw new Error('BiayaBeban harus positif');
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
