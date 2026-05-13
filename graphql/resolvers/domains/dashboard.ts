import User from '../../../models/User.js';
import Technician from '../../../models/Technician.js';
import Meteran from '../../../models/Meteran.js';
import Billing from '../../../models/Billing.js';
import ConnectionData from '../../../models/ConnectionData.js';
import Report from '../../../models/Report.js';
import PekerjaanTeknisi from '../../../models/PekerjaanTeknisi.js';
import AuditLog from '../../../models/AuditLog.js';
import { verifyAdminToken } from '../helpers.js';
import { getCache, setCache } from '../../../utils/redis.js';
import type { GraphQLContext } from '../../../types/index.js';

// Disesuaikan dengan Ahmad/Rafli â€” DB fields PascalCase
// Billing: TotalBiaya, StatusPembayaran (lowercase: pending/settlement/cancel/etc.), Menunggak, IdMeteran
// Report: Status (Ditunda/Ditugaskan/DitinjauAdmin/SedangDikerjakan/Selesai/Dibatalkan)
// Meteran: IdKelompokPelanggan, NomorMeteran, NomorAkun â€” collection 'meterans'
// KelompokPelanggan: NamaKelompok â€” collection 'kelompokpelanggans'

const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

export const dashboardResolvers = {
  Query: {
    getAuditLogs: async (_, { limit = 100, offset = 0, aksi, resource, startDate, endDate }, { token }) => {
      verifyAdminToken(token);
      const filter: Record<string, any> = {};
      if (aksi) filter.aksi = aksi;
      if (resource) filter.resource = resource;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      return await AuditLog.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).populate('idAdmin', 'namaLengkap email');
    },

    getDashboardStats: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'dashboard:stats';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const [totalPelanggan, totalTeknisi, totalMeteran, pendingKoneksi, activeWorkOrders, tunggakanAktif, laporanTerbuka, koneksiMenunggu, koneksiDisetujui, koneksiDitolak] = await Promise.all([
        User.countDocuments(),
        Technician.countDocuments(),
        Meteran.countDocuments(),
        ConnectionData.countDocuments({ StatusPengajuan: 'PENDING' }),
        PekerjaanTeknisi.countDocuments({ status: { $in: ['ditugaskan', 'sedang_dikerjakan'] } }),
        Billing.countDocuments({ Menunggak: true }),
        Report.countDocuments({ Status: { $in: ['Ditunda', 'Ditugaskan', 'DitinjauAdmin', 'SedangDikerjakan'] } }),
        ConnectionData.countDocuments({ StatusPengajuan: 'PENDING' }),
        ConnectionData.countDocuments({ StatusPengajuan: 'APPROVED' }),
        ConnectionData.countDocuments({ StatusPengajuan: 'REJECTED' }),
      ]);

      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      const tagihanBulanIni = await Billing.aggregate([
        { $match: { createdAt: { $gte: currentMonth } } },
        { $group: { _id: null, total: { $sum: '$TotalBiaya' } } },
      ]);

      const stats = { totalPelanggan, totalTeknisi, totalMeteran, pendingKoneksi, activeWorkOrders, totalTagihanBulanIni: tagihanBulanIni[0]?.total || 0, tunggakanAktif, laporanTerbuka, koneksiMenunggu, koneksiDisetujui, koneksiDitolak };
      await setCache(cacheKey, stats, 300);
      return stats;
    },

    getChartKonsumsiPerBulan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const enamBulanLalu = new Date();
      enamBulanLalu.setMonth(enamBulanLalu.getMonth() - 5);
      enamBulanLalu.setDate(1);
      enamBulanLalu.setHours(0, 0, 0, 0);

      const hasil = await Billing.aggregate([
        { $match: { createdAt: { $gte: enamBulanLalu } } },
        { $group: { _id: { tahun: { $year: '$createdAt' }, bulan: { $month: '$createdAt' } }, totalTagihan: { $sum: '$TotalBiaya' }, jumlahTagihan: { $count: {} } } },
        { $sort: { '_id.tahun': 1, '_id.bulan': 1 } },
      ]);
      return hasil.map(item => ({ bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`, totalTagihan: item.totalTagihan, jumlahTagihan: item.jumlahTagihan }));
    },

    getDistribusiKelompokPelanggan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const hasil = await Meteran.aggregate([
        { $lookup: { from: 'kelompokpelanggans', localField: 'IdKelompokPelanggan', foreignField: '_id', as: 'kelompok' } },
        { $unwind: { path: '$kelompok', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$kelompok.NamaKelompok', jumlahMeteran: { $count: {} } } },
        { $sort: { jumlahMeteran: -1 } },
      ]);
      return hasil.map(item => ({ namaKelompok: item._id, jumlahMeteran: item.jumlahMeteran }));
    },

    getLaporanKeuanganBulanan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'laporan:keuangan_bulanan';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const enamBulanLalu = new Date();
      enamBulanLalu.setMonth(enamBulanLalu.getMonth() - 5);
      enamBulanLalu.setDate(1);
      enamBulanLalu.setHours(0, 0, 0, 0);

      const hasil = await Billing.aggregate([
        { $match: { createdAt: { $gte: enamBulanLalu } } },
        { $group: { _id: { tahun: { $year: '$createdAt' }, bulan: { $month: '$createdAt' } }, totalTagihan: { $sum: '$TotalBiaya' }, jumlahTagihan: { $count: {} }, totalLunas: { $sum: { $cond: [{ $eq: ['$StatusPembayaran', 'settlement'] }, '$TotalBiaya', 0] } }, jumlahLunas: { $sum: { $cond: [{ $eq: ['$StatusPembayaran', 'settlement'] }, 1, 0] } } } },
        { $sort: { '_id.tahun': 1, '_id.bulan': 1 } },
      ]);
      const result = hasil.map(item => ({ bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`, totalTagihan: item.totalTagihan, totalLunas: item.totalLunas, jumlahTagihan: item.jumlahTagihan, jumlahLunas: item.jumlahLunas }));
      await setCache(cacheKey, result, 300);
      return result;
    },

    getTunggakanPerKelompok: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'laporan:tunggakan_kelompok';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await Billing.aggregate([
        { $match: { Menunggak: true } },
        { $lookup: { from: 'meterans', localField: 'IdMeteran', foreignField: '_id', as: 'meteran' } },
        { $unwind: { path: '$meteran', preserveNullAndEmptyArrays: false } },
        { $lookup: { from: 'kelompokpelanggans', localField: 'meteran.IdKelompokPelanggan', foreignField: '_id', as: 'kelompok' } },
        { $unwind: { path: '$kelompok', preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ['$kelompok.NamaKelompok', 'Tidak Diketahui'] }, totalTunggakan: { $sum: '$TotalBiaya' }, jumlahTunggakan: { $count: {} } } },
        { $sort: { totalTunggakan: -1 } },
      ]);
      const result = hasil.map(item => ({ namaKelompok: item._id, totalTunggakan: item.totalTunggakan, jumlahTunggakan: item.jumlahTunggakan }));
      await setCache(cacheKey, result, 300);
      return result;
    },

    getTagihanTertinggi: async (_, { limit = 10 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const hasil = await Billing.aggregate([
        { $lookup: { from: 'meterans', localField: 'IdMeteran', foreignField: '_id', as: 'meteran' } },
        { $unwind: { path: '$meteran', preserveNullAndEmptyArrays: false } },
        { $lookup: { from: 'kelompokpelanggans', localField: 'meteran.IdKelompokPelanggan', foreignField: '_id', as: 'kelompok' } },
        { $unwind: { path: '$kelompok', preserveNullAndEmptyArrays: true } },
        { $sort: { TotalBiaya: -1 } },
        { $limit: limit },
        { $project: { nomorMeteran: '$meteran.NomorMeteran', nomorAkun: '$meteran.NomorAkun', namaKelompok: { $ifNull: ['$kelompok.NamaKelompok', '-'] }, totalBiaya: '$TotalBiaya', periode: '$Periode', statusPembayaran: { $toUpper: '$StatusPembayaran' } } },
      ]);
      return hasil;
    },

    getRingkasanStatusTagihan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'laporan:ringkasan_tagihan';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await Billing.aggregate([
        { $group: { _id: null, totalTagihan: { $count: {} }, nilaiTotal: { $sum: '$TotalBiaya' }, totalLunas: { $sum: { $cond: [{ $eq: ['$StatusPembayaran', 'settlement'] }, 1, 0] } }, nilaiLunas: { $sum: { $cond: [{ $eq: ['$StatusPembayaran', 'settlement'] }, '$TotalBiaya', 0] } }, totalTunggakan: { $sum: { $cond: ['$Menunggak', 1, 0] } }, nilaiTunggakan: { $sum: { $cond: ['$Menunggak', '$TotalBiaya', 0] } }, totalPending: { $sum: { $cond: [{ $eq: ['$StatusPembayaran', 'pending'] }, 1, 0] } } } },
      ]);
      if (hasil.length === 0) return { totalTagihan: 0, totalLunas: 0, totalTunggakan: 0, totalPending: 0, nilaiTotal: 0, nilaiLunas: 0, nilaiTunggakan: 0 };
      const result = { totalTagihan: hasil[0].totalTagihan, totalLunas: hasil[0].totalLunas, totalTunggakan: hasil[0].totalTunggakan, totalPending: hasil[0].totalPending, nilaiTotal: hasil[0].nilaiTotal, nilaiLunas: hasil[0].nilaiLunas, nilaiTunggakan: hasil[0].nilaiTunggakan };
      await setCache(cacheKey, result, 120);
      return result;
    },

    getKpiOperasional: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'laporan:kpi_operasional';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const [totalMeteranTerpasang, totalPelanggan, totalLaporanMasuk, totalLaporanSelesai, totalWorkOrderAktif, totalWorkOrderSelesai, totalTeknisi] = await Promise.all([
        Meteran.countDocuments(),
        User.countDocuments(),
        Report.countDocuments(),
        Report.countDocuments({ Status: 'Selesai' }),
        PekerjaanTeknisi.countDocuments({ status: { $in: ['ditugaskan', 'sedang_dikerjakan'] } }),
        PekerjaanTeknisi.countDocuments({ status: 'selesai' }),
        Technician.countDocuments(),
      ]);

      const tingkatPenyelesaianLaporan = totalLaporanMasuk > 0 ? parseFloat(((totalLaporanSelesai / totalLaporanMasuk) * 100).toFixed(1)) : 0;
      const result = { totalMeteranTerpasang, totalPelanggan, totalLaporanMasuk, totalLaporanSelesai, totalWorkOrderAktif, totalWorkOrderSelesai, totalTeknisi, tingkatPenyelesaianLaporan };
      await setCache(cacheKey, result, 300);
      return result;
    },

    getRingkasanWorkOrder: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'laporan:ringkasan_wo';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await PekerjaanTeknisi.aggregate([{ $group: { _id: '$status', jumlah: { $count: {} } } }, { $sort: { jumlah: -1 } }]);
      const result = hasil.map(item => ({ status: item._id || 'Tidak Diketahui', jumlah: item.jumlah }));
      await setCache(cacheKey, result, 120);
      return result;
    },

    getRingkasanLaporan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const cacheKey = 'laporan:ringkasan_laporan';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await Report.aggregate([{ $group: { _id: '$Status', jumlah: { $count: {} } } }, { $sort: { jumlah: -1 } }]);
      const result = hasil.map(item => ({ status: item._id || 'Tidak Diketahui', jumlah: item.jumlah }));
      await setCache(cacheKey, result, 120);
      return result;
    },
  },
};
