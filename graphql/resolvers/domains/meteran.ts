import Meteran from '../../../models/Meteran.js';
import Billing from '../../../models/Billing.js';
import ConnectionData from '../../../models/ConnectionData.js';
import RiwayatPenggunaan from '../../../models/RiwayatPenggunaan.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import { verifyAdminToken, catatAuditLog } from '../helpers.js';
import { getCache, setCache } from '../../../utils/redis.js';
import type { GraphQLContext } from '../../../types/index.js';

const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const METERAN_POPULATE = [
  { path: 'IdKelompokPelanggan', strictPopulate: false },
  { path: 'IdKoneksiData', strictPopulate: false },
];

export const meteranResolvers = {
  Query: {
    getMeteran: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Meteran.findById(id).populate(METERAN_POPULATE as any);
    },

    getAllMeteran: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Meteran.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 500))
        .populate(METERAN_POPULATE as any);
    },

    getMeteranByPelanggan: async (_, { idPelanggan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const connections = await ConnectionData.find({
        $or: [{ IdPelanggan: idPelanggan }, { userId: idPelanggan }],
      }).lean();
      const connectionIds = connections.map(c => c._id);

      if (connectionIds.length > 0) {
        return await Meteran.find({ IdKoneksiData: { $in: connectionIds } })
          .populate('IdKelompokPelanggan')
          .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan', select: 'namaLengkap email noHP' } });
      }

      const { Types } = await import('mongoose');
      let oid: any;
      try { oid = new Types.ObjectId(idPelanggan); } catch { return []; }

      const matched = await Meteran.aggregate([
        { $lookup: { from: 'koneksidatas', localField: 'IdKoneksiData', foreignField: '_id', as: '_kd' } },
        { $match: { $or: [{ '_kd.IdPelanggan': oid }, { '_kd.userId': oid }] } },
      ]);
      if (!matched.length) return [];
      return await Meteran.find({ _id: { $in: matched.map(m => m._id) } })
        .populate('IdKelompokPelanggan')
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan', select: 'namaLengkap email noHP' } });
    },

    getMeteranByKoneksiData: async (_, { IdKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Meteran.findOne({ IdKoneksiData }).populate(METERAN_POPULATE as any);
    },

    getRiwayatPenggunaan: async (_, { meteranId, limit = 30 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // Query langsung ke riwayatpenggunaans dengan field MeterID (dari IoT cron)
      // Gunakan .lean() agar bypass schema validation
      const records = await RiwayatPenggunaan.find({ MeterID: meteranId })
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .lean() as any[];

      if (!records || records.length === 0) {
        return [];
      }

      return records.map((r) => ({
        _id: r._id?.toString() ?? new Date(r.timestamp).toISOString(),
        penggunaanAir: r.PenggunaanAir ?? 0,
        createdAt: r.timestamp ? new Date(r.timestamp).toISOString() : null,
      }));
    },

    getRiwayatPenggunaanBulanan: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = `meteran:${meteranId}:bulanan`;
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      // Ambil daily aggregate docs (tanggal YYYY-MM-DD) untuk meteran ini
      const dailyDocs = await RiwayatPenggunaan.find({
        MeterID: meteranId,
        tanggal: { $exists: true },
      }).lean() as any[];

      if (!dailyDocs || dailyDocs.length === 0) {
        return [];
      }

      // Group per bulan dari tanggal (YYYY-MM-DD → YYYY-MM)
      const bulananMap: Record<string, { total: number; count: number }> = {};
      for (const d of dailyDocs) {
        if (!d.tanggal) continue;
        const key = (d.tanggal as string).substring(0, 7); // YYYY-MM
        if (!bulananMap[key]) bulananMap[key] = { total: 0, count: 0 };
        bulananMap[key].total += d.totalPenggunaan ?? 0;
        bulananMap[key].count += 1;
      }

      const result = Object.entries(bulananMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 12)
        .map(([key, val]) => {
          const parts = key.split('-');
          const bulanIdx = parseInt(parts[1], 10) - 1;
          return {
            bulan: namaBulan[bulanIdx] + ' ' + parts[0],
            totalPemakaian: val.total,
            jumlahRecord: val.count,
          };
        });

      await setCache(cacheKey, result, 300);
      return result;
    },

    getRiwayatBulananAhmad: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // Aggregate daily docs menjadi summary per bulan (YYYY-MM)
      const dailyDocs = await RiwayatPenggunaan.find({
        MeterID: meteranId,
        tanggal: { $exists: true },
      }).lean() as any[];

      const bulananMap: Record<string, number> = {};
      for (const d of dailyDocs) {
        if (!d.tanggal) continue;
        const periode = (d.tanggal as string).substring(0, 7); // YYYY-MM
        bulananMap[periode] = (bulananMap[periode] ?? 0) + (d.totalPenggunaan ?? 0);
      }

      return Object.entries(bulananMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 24)
        .map(([periode, total]) => ({
          _id: periode,
          periode,
          totalPenggunaan: total,
          createdAt: null,
        }));
    },

    getEstimasiBiaya: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = `meteran:${meteranId}:estimasi`;
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const meteran = await Meteran.findById(meteranId).populate('IdKelompokPelanggan');
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      const kelompok = (meteran as any).IdKelompokPelanggan as any;
      const pemakaian = meteran.pemakaianBelumTerbayar || 0;
      const batasRendah = kelompok?.BatasRendah ?? 10;
      const biaya = pemakaian <= batasRendah
        ? pemakaian * (kelompok?.TarifRendah ?? 1500)
        : pemakaian * (kelompok?.TarifTinggi ?? 2000);
      const biayaBeban = kelompok?.BiayaBeban ?? 5000;
      const result = {
        pemakaianBelumTerbayar: pemakaian,
        estimasiBiaya: biaya,
        biayaBeban,
        totalEstimasi: biaya + biayaBeban,
        namaKelompok: kelompok?.NamaKelompok || null,
      };
      await setCache(cacheKey, result, 3600);
      return result;
    },
  },

  Mutation: {
    createMeteran: async (_, { IdKelompokPelanggan, NomorMeteran, NomorAkun, IdKoneksiData }, { token }) => {
      verifyAdminToken(token);
      const existing = await Meteran.findOne({ NomorAkun });
      if (existing) throw new Error(`Nomor akun ${NomorAkun} sudah digunakan`);
      const meteran = new Meteran({
        IdKelompokPelanggan,
        NomorMeteran,
        NomorAkun,
        IdKoneksiData: IdKoneksiData || null,
      });
      await meteran.save();
      await catatAuditLog({
        token,
        aksi: 'METERAN_CREATE',
        resource: 'Meteran',
        resourceId: meteran._id,
        nilaiAfter: { NomorMeteran, NomorAkun, IdKoneksiData, IdKelompokPelanggan },
      });
      return await Meteran.findById(meteran._id)
        .populate('IdKelompokPelanggan')
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan' } });
    },

    updateMeteran: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const before = await Meteran.findById(id, 'NomorMeteran NomorAkun IdKelompokPelanggan IdKoneksiData').lean() as any;
      const meteran = await Meteran.findByIdAndUpdate(id, updates, { new: true })
        .populate('IdKelompokPelanggan')
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan' } });
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      await catatAuditLog({
        token,
        aksi: 'METERAN_UPDATE',
        resource: 'Meteran',
        resourceId: id,
        nilaiBefore: before ? { NomorMeteran: before.NomorMeteran, NomorAkun: before.NomorAkun } : null,
        nilaiAfter: { ...updates },
      });
      return meteran;
    },

    deleteMeteran: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(id).lean() as any;
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      const activeBilling = await Billing.findOne({ IdMeteran: id, StatusPembayaran: { $in: ['pending'] } });
      if (activeBilling) throw new Error('Meteran masih memiliki tagihan yang belum dibayar');
      await catatAuditLog({
        token,
        aksi: 'METERAN_DELETE',
        resource: 'Meteran',
        resourceId: id,
        nilaiBefore: { NomorMeteran: meteran.NomorMeteran, NomorAkun: meteran.NomorAkun },
      });
      await Meteran.findByIdAndDelete(id);
      return { success: true, message: 'Meteran berhasil dihapus' };
    },
  },
};
