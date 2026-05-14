import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import { verifyAdminToken, catatAuditLog } from '../helpers.js';
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

      if (TarifRendah != null && (TarifRendah < 0 || !Number.isFinite(TarifRendah))) throw new Error('TarifRendah harus positif');
      if (TarifTinggi != null && (TarifTinggi < 0 || !Number.isFinite(TarifTinggi))) throw new Error('TarifTinggi harus positif');
      if (BiayaBeban != null && (BiayaBeban < 0 || !Number.isFinite(BiayaBeban))) throw new Error('BiayaBeban harus positif');

      const normalizedKode = KodeKelompok.trim().toUpperCase();
      const existing = await KelompokPelanggan.findOne({ KodeKelompok: normalizedKode });
      if (existing) {
        throw new Error(`Kode "${normalizedKode}" sudah digunakan. Gunakan kode lain atau edit yang sudah ada.`);
      }

      const kelompok = new KelompokPelanggan({ ...input, KodeKelompok: normalizedKode });
      await kelompok.save();
      await deleteCacheByPattern('kelompok:*');
      await catatAuditLog({
        token,
        aksi: 'KELOMPOK_CREATE',
        resource: 'KelompokPelanggan',
        resourceId: kelompok._id,
        nilaiAfter: { KodeKelompok: normalizedKode, NamaKelompok: input.NamaKelompok, TarifRendah, TarifTinggi, BiayaBeban },
      });
      return kelompok;
    },

    updateKelompokPelanggan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      const { TarifRendah, TarifTinggi, BiayaBeban } = input;
      if (TarifRendah !== undefined && (TarifRendah < 0 || !Number.isFinite(TarifRendah))) throw new Error('TarifRendah harus positif');
      if (TarifTinggi !== undefined && (TarifTinggi < 0 || !Number.isFinite(TarifTinggi))) throw new Error('TarifTinggi harus positif');
      if (BiayaBeban != null && (BiayaBeban < 0 || !Number.isFinite(BiayaBeban))) throw new Error('BiayaBeban harus positif');
      const before = await KelompokPelanggan.findById(id, 'KodeKelompok NamaKelompok TarifRendah TarifTinggi BiayaBeban').lean() as any;
      const kelompok = await KelompokPelanggan.findByIdAndUpdate(id, input, { new: true });
      await deleteCacheByPattern('kelompok:*');
      await catatAuditLog({
        token,
        aksi: 'KELOMPOK_UPDATE',
        resource: 'KelompokPelanggan',
        resourceId: id,
        nilaiBefore: before ? { KodeKelompok: before.KodeKelompok, NamaKelompok: before.NamaKelompok, TarifRendah: before.TarifRendah, TarifTinggi: before.TarifTinggi, BiayaBeban: before.BiayaBeban } : null,
        nilaiAfter: { ...input },
      });
      return kelompok;
    },

    deleteKelompokPelanggan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const before = await KelompokPelanggan.findById(id, 'KodeKelompok NamaKelompok').lean() as any;
      await KelompokPelanggan.findByIdAndDelete(id);
      await deleteCacheByPattern('kelompok:*');
      await catatAuditLog({
        token,
        aksi: 'KELOMPOK_DELETE',
        resource: 'KelompokPelanggan',
        resourceId: id,
        nilaiBefore: before ? { KodeKelompok: before.KodeKelompok, NamaKelompok: before.NamaKelompok } : null,
      });
      return { success: true, message: 'Kelompok Pelanggan deleted successfully' };
    },
  },
};
