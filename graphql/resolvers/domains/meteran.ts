// @ts-nocheck
import Meteran from '../../../models/Meteran.js';
import Billing from '../../../models/Billing.js';
import ConnectionData from '../../../models/ConnectionData.js';
import HistoryUsage from '../../../models/HistoryUsage.js';
import RiwayatPenggunaan from '../../../models/RiwayatPenggunaan.js';
// PemakaianHarian dihapus — Opsi A: query langsung ke HistoryUsage (riwayatpenggunaans)
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import { verifyAdminToken, /* catatAuditLog */ } from '../helpers.js';
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
      // Cari KoneksiData milik pelanggan (field PascalCase sesuai Ahmad)
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
      // Opsi A: agregasi per hari dari HistoryUsage (riwayatpenggunaans)
      // billingCron menulis raw entries; resolver ini mengelompokkan per hari WIB
      const { Types } = await import('mongoose');
      const records = await HistoryUsage.aggregate([
        { $match: { meteranId: new Types.ObjectId(meteranId) } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Jakarta' } },
          totalM3: { $sum: '$penggunaanAir' },
          jumlahEntry: { $sum: 1 },
        }},
        { $sort: { _id: -1 } },
        { $limit: Math.min(limit, 90) },
      ]);
      return records.map((r: any) => ({
        _id: r._id,
        penggunaanAir: r.totalM3 * 1000, // m³ → liter (frontend expects liter)
        createdAt: new Date(r._id).toISOString(),
      }));
    },

    getRiwayatPenggunaanBulanan: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = `meteran:${meteranId}:bulanan`;
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      // Opsi A: agregasi bulanan dari HistoryUsage dengan timezone WIB
      const { Types } = await import('mongoose');
      const hasil = await HistoryUsage.aggregate([
        { $match: { meteranId: new Types.ObjectId(meteranId) } },
        { $group: {
          _id: {
            tahun: { $year:  { date: '$createdAt', timezone: 'Asia/Jakarta' } },
            bulan: { $month: { date: '$createdAt', timezone: 'Asia/Jakarta' } },
          },
          totalPemakaian: { $sum: { $multiply: ['$penggunaanAir', 1000] } }, // m³ → liter
          jumlahRecord: { $sum: 1 },
        }},
        { $sort: { '_id.tahun': -1, '_id.bulan': -1 } },
        { $limit: 12 },
      ]);
      const result = hasil.map((item: any) => ({
        bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`,
        totalPemakaian: item.totalPemakaian,
        jumlahRecord: item.jumlahRecord,
      }));
      await setCache(cacheKey, result, 300);
      return result;
    },

    getRiwayatBulananAhmad: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // Baca dari Ahmad's RiwayatPenggunaan (collection: riwayatpenggunaas)
      // MeteranId di Ahmad adalah ObjectId ref ke Meter
      const records = await RiwayatPenggunaan.find({ MeteranId: meteranId })
        .sort({ Periode: -1 })
        .limit(24)
        .lean();
      return records.map((r) => ({
        _id: r._id,
        periode: r.Periode,
        totalPenggunaan: r.TotalPenggunaan ?? 0,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
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
        : batasRendah * (kelompok?.TarifRendah ?? 1500) + (pemakaian - batasRendah) * (kelompok?.TarifTinggi ?? 2000);
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
      /* [auditlog nonaktif — uncomment untuk mengaktifkan kembali]
      await catatAuditLog({
        token,
        aksi: 'METERAN_CREATE',
        resource: 'Meteran',
        resourceId: meteran._id,
        nilaiAfter: { NomorMeteran, NomorAkun, IdKoneksiData },
      }); */
      return await Meteran.findById(meteran._id)
        .populate('IdKelompokPelanggan')
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan' } });
    },

    updateMeteran: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findByIdAndUpdate(id, updates, { new: true })
        .populate('IdKelompokPelanggan')
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan' } });
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      return meteran;
    },

    deleteMeteran: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(id);
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      const activeBilling = await Billing.findOne({ IdMeteran: id, StatusPembayaran: { $in: ['pending'] } });
      if (activeBilling) throw new Error('Meteran masih memiliki tagihan yang belum dibayar');
      /* [auditlog nonaktif — uncomment untuk mengaktifkan kembali]
      await catatAuditLog({
        token,
        aksi: 'METERAN_DELETE',
        resource: 'Meteran',
        resourceId: id,
        nilaiBefore: { NomorMeteran: (meteran as any).NomorMeteran, NomorAkun: (meteran as any).NomorAkun },
      }); */
      await Meteran.findByIdAndDelete(id);
      return { success: true, message: 'Meteran berhasil dihapus' };
    },
  },
};
