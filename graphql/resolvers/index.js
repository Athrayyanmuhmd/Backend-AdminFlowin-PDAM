import AdminAccount from '../../models/AdminAccount.js';
import AuditLog from '../../models/AuditLog.js';
import User from '../../models/User.js';
import Technician from '../../models/Technician.js';
import KelompokPelanggan from '../../models/KelompokPelanggan.js';
import Meteran from '../../models/Meteran.js';
import ConnectionData from '../../models/ConnectionData.js';
import Billing from '../../models/Billing.js';
import HistoryUsage from '../../models/HistoryUsage.js';
import Report from '../../models/Report.js';
import WorkOrder from '../../models/WorkOrder.js';
import PekerjaanTeknisi from '../../models/PekerjaanTeknisi.js';
import RabConnection from '../../models/RabConnection.js';
import SurveyData from '../../models/SurveyData.js';
import Notification from '../../models/Notification.js';
import PenyelesaianLaporan from '../../models/PenyelesaianLaporan.js';
import Pemasangan from '../../models/Pemasangan.js';
import PengawasanPemasangan from '../../models/PengawasanPemasangan.js';
import PengawasanSetelahPemasangan from '../../models/PengawasanSetelahPemasangan.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getCache, setCache, deleteCacheByPattern } from '../../utils/redis.js';

// Helper: verifikasi token admin
function verifyAdminToken(token) {
  if (!token) throw new Error('Token tidak ditemukan. Silakan login terlebih dahulu.');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (err) {
    throw new Error('Token tidak valid atau sudah kadaluarsa.');
  }
}

// Helper: catat audit log (fire-and-forget, tidak throw jika gagal)
async function catatAuditLog({ token, aksi, resource, resourceId = null, nilaiBefore = null, nilaiAfter = null, catatan = null }) {
  try {
    let namaAdmin = 'Sistem';
    let idAdmin = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        idAdmin = decoded.id;
        const admin = await AdminAccount.findById(decoded.id, 'namaLengkap');
        if (admin) namaAdmin = admin.namaLengkap;
      } catch (_) {}
    }
    await AuditLog.create({ idAdmin, namaAdmin, aksi, resource, resourceId: resourceId ? String(resourceId) : null, nilaiBefore, nilaiAfter, catatan });
  } catch (err) {
    console.error('Gagal mencatat audit log:', err.message);
  }
}

// Helper: kirim notifikasi ke semua admin
async function notifikasiSemuaAdmin(judul, pesan, kategori, link = null) {
  try {
    const admins = await AdminAccount.find({}, '_id');
    const notifs = admins.map(admin => ({
      idAdmin: admin._id,
      judul,
      pesan,
      kategori,
      link,
      isRead: false,
    }));
    if (notifs.length > 0) await Notification.insertMany(notifs);
  } catch (err) {
    console.error('Gagal kirim notifikasi admin:', err.message);
  }
}

export const resolvers = {
  Query: {
    // ==================== ADMIN QUERIES ====================
    getAdmin: async (_, { id }) => {
      return await AdminAccount.findById(id);
    },

    getAllAdmins: async () => {
      return await AdminAccount.find();
    },

    // ==================== AUDIT LOG QUERIES ====================
    getAuditLogs: async (_, { limit = 100, offset = 0, aksi, resource, startDate, endDate }, { token }) => {
      verifyAdminToken(token);
      const filter = {};
      if (aksi) filter.aksi = aksi;
      if (resource) filter.resource = resource;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      return await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('idAdmin', 'namaLengkap email');
    },

    loginAdmin: async (_, { email, password }) => {
      const admin = await AdminAccount.findOne({ email });
      if (!admin) {
        throw new Error('Admin not found');
      }

      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      const token = jwt.sign(
        { id: admin._id, email: admin.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return {
        token,
        admin: { ...admin._doc, token }
      };
    },

    // ==================== PELANGGAN QUERIES ====================
    getPengguna: async (_, { id }) => {
      const user = await User.findById(id);
      if (!user) return null;
      return {
        ...user.toObject(),
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
      };
    },

    getAllPengguna: async () => {
      const users = await User.find().sort({ createdAt: -1 }); // Sort by newest first
      return users.map(user => ({
        ...user.toObject(),
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
      }));
    },

    searchPengguna: async (_, { search }) => {
      const users = await User.find({
        $or: [
          { namaLengkap: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { noHP: { $regex: search, $options: 'i' } }
        ]
      }).sort({ createdAt: -1 }); // Sort by newest first
      return users.map(user => ({
        ...user.toObject(),
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
      }));
    },

    // ==================== TEKNISI QUERIES ====================
    getTeknisi: async (_, { id }) => {
      const teknisi = await Technician.findById(id);
      if (!teknisi) return null;
      return {
        ...teknisi.toObject(),
        createdAt: teknisi.createdAt?.toISOString(),
        updatedAt: teknisi.updatedAt?.toISOString(),
      };
    },

    getAllTeknisi: async () => {
      const teknisis = await Technician.find();
      return teknisis.map(tek => ({
        ...tek.toObject(),
        createdAt: tek.createdAt?.toISOString(),
        updatedAt: tek.updatedAt?.toISOString(),
      }));
    },

    getTeknisiByDivisi: async (_, { divisi }) => {
      const teknisis = await Technician.find({ divisi });
      return teknisis.map(tek => ({
        ...tek.toObject(),
        createdAt: tek.createdAt?.toISOString(),
        updatedAt: tek.updatedAt?.toISOString(),
      }));
    },

    // ==================== KELOMPOK PELANGGAN QUERIES ====================
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

    // ==================== METERAN QUERIES ====================
    getMeteran: async (_, { id }) => {
      return await Meteran.findById(id)
        .populate({ path: 'idKelompokPelanggan', strictPopulate: false })
        .populate({ path: 'idKoneksiData', strictPopulate: false });
    },

    getAllMeteran: async () => {
      return await Meteran.find()
        .populate({ path: 'idKelompokPelanggan', strictPopulate: false })
        .populate({ path: 'idKoneksiData', strictPopulate: false });
    },

    getMeteranByPelanggan: async (_, { idPelanggan }) => {
      const connections = await ConnectionData.find({ idPelanggan });
      const connectionIds = connections.map(c => c._id);
      return await Meteran.find({ idKoneksiData: { $in: connectionIds } })
        .populate('idKelompokPelanggan')
        .populate('idKoneksiData');
    },

    // ==================== CONNECTION DATA QUERIES ====================
    getKoneksiData: async (_, { id }) => {
      return await ConnectionData.findById(id).populate('idPelanggan');
    },

    getAllKoneksiData: async () => {
      return await ConnectionData.find().populate('idPelanggan');
    },

    getPendingKoneksiData: async () => {
      return await ConnectionData.find({ statusVerifikasi: false }).populate('idPelanggan');
    },

    getVerifiedKoneksiData: async () => {
      return await ConnectionData.find({ statusVerifikasi: true }).populate('idPelanggan');
    },

    // ==================== TAGIHAN QUERIES ====================
    getTagihan: async (_, { id }) => {
      return await Billing.findById(id).populate('idMeteran');
    },

    getAllTagihan: async () => {
      return await Billing.find().populate('idMeteran');
    },

    getTagihanByMeteran: async (_, { idMeteran }) => {
      return await Billing.find({ idMeteran }).populate('idMeteran');
    },

    getTagihanByStatus: async (_, { status }) => {
      return await Billing.find({ statusPembayaran: status }).populate('idMeteran');
    },

    getTunggakan: async () => {
      return await Billing.find({ menunggak: true }).populate('idMeteran');
    },

    // ==================== LAPORAN QUERIES ====================
    getLaporan: async (_, { id }) => {
      return await Report.findById(id).populate('idPengguna');
    },

    getAllLaporan: async () => {
      return await Report.find().populate('idPengguna');
    },

    getLaporanByStatus: async (_, { status }) => {
      return await Report.find({ status }).populate('idPengguna');
    },

    getLaporanByPelanggan: async (_, { idPelanggan }) => {
      return await Report.find({ idPengguna: idPelanggan }).populate('idPengguna');
    },

    // ==================== WORK ORDER QUERIES ====================
    getWorkOrder: async (_, { id }) => {
      return await PekerjaanTeknisi.findById(id)
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim');
    },

    getAllWorkOrders: async () => {
      return await PekerjaanTeknisi.find()
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getWorkOrdersByStatus: async (_, { status }) => {
      return await PekerjaanTeknisi.find({ status })
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getWorkOrdersByTeknisi: async (_, { idTeknisi }) => {
      return await PekerjaanTeknisi.find({ tim: idTeknisi })
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    // ==================== RAB CONNECTION QUERIES ====================
    getRABConnection: async (_, { id }) => {
      return await RabConnection.findById(id).populate('idKoneksiData');
    },

    getAllRABConnections: async () => {
      return await RabConnection.find().populate('idKoneksiData');
    },

    getPendingRAB: async () => {
      return await RabConnection.find({ statusPembayaran: 'Pending' }).populate('idKoneksiData');
    },

    // ==================== SURVEI QUERIES ====================
    getSurvei: async (_, { id }) => {
      return await SurveyData.findById(id)
        .populate('idKoneksiData')
        .populate('idTeknisi');
    },

    getAllSurvei: async () => {
      return await SurveyData.find()
        .populate('idKoneksiData')
        .populate('idTeknisi');
    },

    // ==================== NOTIFIKASI QUERIES ====================
    getNotifikasi: async (_, { id }) => {
      return await Notification.findById(id);
    },

    getNotifikasiByAdmin: async (_, { idAdmin }) => {
      return await Notification.find({ idAdmin }).sort({ createdAt: -1 });
    },

    getUnreadNotifikasi: async (_, { idAdmin }) => {
      return await Notification.find({ idAdmin, isRead: false }).sort({ createdAt: -1 });
    },

    getAllNotifikasiAdmin: async () => {
      // Return all admin-targeted notifications (sorted newest first)
      return await Notification.find({ idAdmin: { $ne: null } }).sort({ createdAt: -1 }).limit(50);
    },

    // ==================== DASHBOARD STATS ====================
    getDashboardStats: async () => {
      // Try to get from cache first (5 minutes TTL)
      const cacheKey = 'dashboard:stats';
      const cached = await getCache(cacheKey);
      if (cached) {
        return cached;
      }

      // If not in cache, fetch from database (existing logic unchanged)
      const [
        totalPelanggan,
        totalTeknisi,
        totalMeteran,
        pendingKoneksi,
        activeWorkOrders,
        tunggakanAktif,
        laporanTerbuka
      ] = await Promise.all([
        User.countDocuments(),
        Technician.countDocuments(),
        Meteran.countDocuments(),
        ConnectionData.countDocuments({ statusVerifikasi: false }),
        PekerjaanTeknisi.countDocuments({ status: { $in: ['Ditugaskan', 'SedangDikerjakan'] } }),
        Billing.countDocuments({ menunggak: true }),
        Report.countDocuments({ status: { $in: ['Diajukan', 'ProsesPerbaikan'] } })
      ]);

      // Calculate total tagihan bulan ini
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const tagihanBulanIni = await Billing.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalBiaya' }
          }
        }
      ]);

      const stats = {
        totalPelanggan,
        totalTeknisi,
        totalMeteran,
        pendingKoneksi,
        activeWorkOrders,
        totalTagihanBulanIni: tagihanBulanIni[0]?.total || 0,
        tunggakanAktif,
        laporanTerbuka
      };

      // Cache for 5 minutes (300 seconds)
      await setCache(cacheKey, stats, 300);

      return stats;
    },

    // ==================== DASHBOARD CHART QUERIES ====================
    getChartKonsumsiPerBulan: async () => {
      // Ambil data tagihan 6 bulan terakhir, group by bulan
      const enamBulanLalu = new Date();
      enamBulanLalu.setMonth(enamBulanLalu.getMonth() - 5);
      enamBulanLalu.setDate(1);
      enamBulanLalu.setHours(0, 0, 0, 0);

      const hasilAgregasi = await Billing.aggregate([
        {
          $match: {
            createdAt: { $gte: enamBulanLalu }
          }
        },
        {
          $group: {
            _id: {
              tahun: { $year: '$createdAt' },
              bulan: { $month: '$createdAt' }
            },
            totalTagihan: { $sum: '$totalBiaya' },
            jumlahTagihan: { $count: {} }
          }
        },
        {
          $sort: { '_id.tahun': 1, '_id.bulan': 1 }
        }
      ]);

      const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

      return hasilAgregasi.map(item => ({
        bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`,
        totalTagihan: item.totalTagihan,
        jumlahTagihan: item.jumlahTagihan
      }));
    },

    getDistribusiKelompokPelanggan: async () => {
      // Ambil semua meteran dengan kelompok pelanggan, hitung distribusi
      const hasilAgregasi = await Meteran.aggregate([
        {
          $lookup: {
            from: 'kelompokpelanggans',
            localField: 'idKelompokPelanggan',
            foreignField: '_id',
            as: 'kelompok'
          }
        },
        {
          $unwind: { path: '$kelompok', preserveNullAndEmptyArrays: false }
        },
        {
          $group: {
            _id: '$kelompok.namaKelompok',
            jumlahMeteran: { $count: {} }
          }
        },
        {
          $sort: { jumlahMeteran: -1 }
        }
      ]);

      return hasilAgregasi.map(item => ({
        namaKelompok: item._id,
        jumlahMeteran: item.jumlahMeteran
      }));
    },

    // ==================== LAPORAN KEUANGAN QUERIES ====================
    getLaporanKeuanganBulanan: async () => {
      const cacheKey = 'laporan:keuangan_bulanan';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const enamBulanLalu = new Date();
      enamBulanLalu.setMonth(enamBulanLalu.getMonth() - 5);
      enamBulanLalu.setDate(1);
      enamBulanLalu.setHours(0, 0, 0, 0);

      const hasil = await Billing.aggregate([
        { $match: { createdAt: { $gte: enamBulanLalu } } },
        {
          $group: {
            _id: { tahun: { $year: '$createdAt' }, bulan: { $month: '$createdAt' } },
            totalTagihan: { $sum: '$totalBiaya' },
            jumlahTagihan: { $count: {} },
            totalLunas: {
              $sum: { $cond: [{ $eq: ['$statusPembayaran', 'Settlement'] }, '$totalBiaya', 0] }
            },
            jumlahLunas: {
              $sum: { $cond: [{ $eq: ['$statusPembayaran', 'Settlement'] }, 1, 0] }
            },
          }
        },
        { $sort: { '_id.tahun': 1, '_id.bulan': 1 } }
      ]);

      const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
      const result = hasil.map(item => ({
        bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`,
        totalTagihan: item.totalTagihan,
        totalLunas: item.totalLunas,
        jumlahTagihan: item.jumlahTagihan,
        jumlahLunas: item.jumlahLunas,
      }));
      await setCache(cacheKey, result, 300); // 5 menit
      return result;
    },

    getTunggakanPerKelompok: async () => {
      const cacheKey = 'laporan:tunggakan_kelompok';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await Billing.aggregate([
        { $match: { menunggak: true } },
        {
          $lookup: {
            from: 'meterans',
            localField: 'idMeteran',
            foreignField: '_id',
            as: 'meteran'
          }
        },
        { $unwind: { path: '$meteran', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'kelompokpelanggans',
            localField: 'meteran.idKelompokPelanggan',
            foreignField: '_id',
            as: 'kelompok'
          }
        },
        { $unwind: { path: '$kelompok', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$kelompok.namaKelompok', 'Tidak Diketahui'] },
            totalTunggakan: { $sum: '$totalBiaya' },
            jumlahTunggakan: { $count: {} },
          }
        },
        { $sort: { totalTunggakan: -1 } }
      ]);

      const result = hasil.map(item => ({
        namaKelompok: item._id,
        totalTunggakan: item.totalTunggakan,
        jumlahTunggakan: item.jumlahTunggakan,
      }));
      await setCache(cacheKey, result, 300); // 5 menit
      return result;
    },

    getTagihanTertinggi: async (_, { limit = 10 }) => {
      const hasil = await Billing.aggregate([
        {
          $lookup: {
            from: 'meterans',
            localField: 'idMeteran',
            foreignField: '_id',
            as: 'meteran'
          }
        },
        { $unwind: { path: '$meteran', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'kelompokpelanggans',
            localField: 'meteran.idKelompokPelanggan',
            foreignField: '_id',
            as: 'kelompok'
          }
        },
        { $unwind: { path: '$kelompok', preserveNullAndEmptyArrays: true } },
        { $sort: { totalBiaya: -1 } },
        { $limit: limit },
        {
          $project: {
            nomorMeteran: '$meteran.nomorMeteran',
            nomorAkun: '$meteran.nomorAkun',
            namaKelompok: { $ifNull: ['$kelompok.namaKelompok', '-'] },
            totalBiaya: 1,
            periode: { $dateToString: { format: '%Y-%m', date: '$periode' } },
            statusPembayaran: 1,
          }
        }
      ]);

      return hasil.map(item => ({
        nomorMeteran: item.nomorMeteran,
        nomorAkun: item.nomorAkun,
        namaKelompok: item.namaKelompok,
        totalBiaya: item.totalBiaya,
        periode: item.periode,
        statusPembayaran: item.statusPembayaran,
      }));
    },

    getRingkasanStatusTagihan: async () => {
      const cacheKey = 'laporan:ringkasan_tagihan';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await Billing.aggregate([
        {
          $group: {
            _id: null,
            totalTagihan: { $count: {} },
            nilaiTotal: { $sum: '$totalBiaya' },
            totalLunas: { $sum: { $cond: [{ $eq: ['$statusPembayaran', 'Settlement'] }, 1, 0] } },
            nilaiLunas: { $sum: { $cond: [{ $eq: ['$statusPembayaran', 'Settlement'] }, '$totalBiaya', 0] } },
            totalTunggakan: { $sum: { $cond: ['$menunggak', 1, 0] } },
            nilaiTunggakan: { $sum: { $cond: ['$menunggak', '$totalBiaya', 0] } },
            totalPending: { $sum: { $cond: [{ $eq: ['$statusPembayaran', 'Pending'] }, 1, 0] } },
          }
        }
      ]);

      if (hasil.length === 0) {
        return { totalTagihan: 0, totalLunas: 0, totalTunggakan: 0, totalPending: 0, nilaiTotal: 0, nilaiLunas: 0, nilaiTunggakan: 0 };
      }
      const result = {
        totalTagihan: hasil[0].totalTagihan,
        totalLunas: hasil[0].totalLunas,
        totalTunggakan: hasil[0].totalTunggakan,
        totalPending: hasil[0].totalPending,
        nilaiTotal: hasil[0].nilaiTotal,
        nilaiLunas: hasil[0].nilaiLunas,
        nilaiTunggakan: hasil[0].nilaiTunggakan,
      };
      await setCache(cacheKey, result, 120); // 2 menit
      return result;
    },

    // ==================== LAPORAN OPERASIONAL QUERIES ====================
    getKpiOperasional: async () => {
      const cacheKey = 'laporan:kpi_operasional';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const [
        totalMeteranTerpasang,
        totalPelanggan,
        totalLaporanMasuk,
        totalLaporanSelesai,
        totalWorkOrderAktif,
        totalWorkOrderSelesai,
        totalTeknisi,
      ] = await Promise.all([
        Meteran.countDocuments(),
        User.countDocuments(),
        Report.countDocuments(),
        Report.countDocuments({ status: 'Selesai' }),
        PekerjaanTeknisi.countDocuments({ status: { $in: ['Ditugaskan', 'SedangDikerjakan'] } }),
        PekerjaanTeknisi.countDocuments({ status: 'Selesai' }),
        Technician.countDocuments(),
      ]);

      const tingkatPenyelesaianLaporan = totalLaporanMasuk > 0
        ? parseFloat(((totalLaporanSelesai / totalLaporanMasuk) * 100).toFixed(1))
        : 0;

      const result = {
        totalMeteranTerpasang,
        totalPelanggan,
        totalLaporanMasuk,
        totalLaporanSelesai,
        totalWorkOrderAktif,
        totalWorkOrderSelesai,
        totalTeknisi,
        tingkatPenyelesaianLaporan,
      };
      await setCache(cacheKey, result, 300); // 5 menit
      return result;
    },

    getRingkasanWorkOrder: async () => {
      const cacheKey = 'laporan:ringkasan_wo';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await PekerjaanTeknisi.aggregate([
        { $group: { _id: '$status', jumlah: { $count: {} } } },
        { $sort: { jumlah: -1 } }
      ]);
      const result = hasil.map(item => ({ status: item._id || 'Tidak Diketahui', jumlah: item.jumlah }));
      await setCache(cacheKey, result, 120); // 2 menit
      return result;
    },

    getRingkasanLaporan: async () => {
      const cacheKey = 'laporan:ringkasan_laporan';
      const cached = await getCache(cacheKey);
      if (cached) return cached;

      const hasil = await Report.aggregate([
        { $group: { _id: '$status', jumlah: { $count: {} } } },
        { $sort: { jumlah: -1 } }
      ]);
      const result = hasil.map(item => ({ status: item._id || 'Tidak Diketahui', jumlah: item.jumlah }));
      await setCache(cacheKey, result, 120); // 2 menit
      return result;
    },

    // ==================== PEKERJAAN TEKNISI QUERIES (ERD Compliant) ====================
    getPekerjaanTeknisi: async (_, { id }) => {
      return await PekerjaanTeknisi.findById(id)
        .populate('idSurvei')
        .populate('rabId')
        .populate('idPenyelesaianLaporan')
        .populate('idPemasangan')
        .populate('idPengawasanPemasangan')
        .populate('idPengawasanSetelahPemasangan')
        .populate('tim');
    },

    getAllPekerjaanTeknisi: async () => {
      return await PekerjaanTeknisi.find()
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiByStatus: async (_, { status }) => {
      return await PekerjaanTeknisi.find({ status })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiByTeknisi: async (_, { teknisiId }) => {
      return await PekerjaanTeknisi.find({ tim: teknisiId })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiPendingApproval: async () => {
      return await PekerjaanTeknisi.find({
        disetujui: null,
        status: 'DitinjauAdmin'
      })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    // ==================== PENYELESAIAN LAPORAN QUERIES ====================
    getPenyelesaianLaporan: async (_, { id }) => {
      return await PenyelesaianLaporan.findById(id)
        .populate('idLaporan')
        .populate('teknisiId');
    },

    getPenyelesaianLaporanByLaporan: async (_, { idLaporan }) => {
      return await PenyelesaianLaporan.find({ idLaporan })
        .populate('teknisiId')
        .sort({ tanggalSelesai: -1 });
    },

    getPenyelesaianLaporanByTeknisi: async (_, { teknisiId }) => {
      return await PenyelesaianLaporan.find({ teknisiId })
        .populate('idLaporan')
        .sort({ tanggalSelesai: -1 });
    },

    getAllPenyelesaianLaporan: async () => {
      return await PenyelesaianLaporan.find()
        .populate('idLaporan')
        .populate('teknisiId')
        .sort({ tanggalSelesai: -1 });
    },

    // ==================== PEMASANGAN QUERIES ====================
    getPemasangan: async (_, { id }) => {
      return await Pemasangan.findById(id)
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh');
    },

    getPemasanganByKoneksiData: async (_, { idKoneksiData }) => {
      return await Pemasangan.findOne({ idKoneksiData })
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh');
    },

    getPemasanganByTeknisi: async (_, { teknisiId }) => {
      return await Pemasangan.find({ teknisiId })
        .populate('idKoneksiData')
        .populate('diverifikasiOleh')
        .sort({ tanggalPemasangan: -1 });
    },

    getPemasanganByStatus: async (_, { statusVerifikasi }) => {
      return await Pemasangan.find({ statusVerifikasi })
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh')
        .sort({ tanggalPemasangan: -1 });
    },

    getAllPemasangan: async () => {
      return await Pemasangan.find()
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh')
        .sort({ tanggalPemasangan: -1 });
    },

    // ==================== PENGAWASAN PEMASANGAN QUERIES ====================
    getPengawasanPemasangan: async (_, { id }) => {
      return await PengawasanPemasangan.findById(id)
        .populate('idPemasangan')
        .populate('supervisorId');
    },

    getPengawasanPemasanganByPemasangan: async (_, { idPemasangan }) => {
      return await PengawasanPemasangan.find({ idPemasangan })
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanPemasanganBySupervisor: async (_, { supervisorId }) => {
      return await PengawasanPemasangan.find({ supervisorId })
        .populate('idPemasangan')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanPemasanganProblematic: async () => {
      return await PengawasanPemasangan.find({
        $or: [
          { hasilPengawasan: { $in: ['Perbaikan Diperlukan', 'Tidak Sesuai'] } },
          { perluTindakLanjut: true }
        ]
      })
        .populate('idPemasangan')
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getAllPengawasanPemasangan: async () => {
      return await PengawasanPemasangan.find()
        .populate('idPemasangan')
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    // ==================== PENGAWASAN SETELAH PEMASANGAN QUERIES ====================
    getPengawasanSetelahPemasangan: async (_, { id }) => {
      return await PengawasanSetelahPemasangan.findById(id)
        .populate('idPemasangan')
        .populate('supervisorId');
    },

    getPengawasanSetelahPemasanganByPemasangan: async (_, { idPemasangan }) => {
      return await PengawasanSetelahPemasangan.find({ idPemasangan })
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasanganBySupervisor: async (_, { supervisorId }) => {
      return await PengawasanSetelahPemasangan.find({ supervisorId })
        .populate('idPemasangan')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasanganProblematic: async () => {
      return await PengawasanSetelahPemasangan.find({
        $or: [
          { hasilPengawasan: 'Bermasalah' },
          { statusMeteran: { $ne: 'Berfungsi Normal' } },
          { perluTindakLanjut: true }
        ]
      })
        .populate('idPemasangan')
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getAllPengawasanSetelahPemasangan: async () => {
      return await PengawasanSetelahPemasangan.find()
        .populate('idPemasangan')
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getAverageCustomerRating: async () => {
      return await PengawasanSetelahPemasangan.getAverageRating();
    }
  },

  Mutation: {
    // ==================== ADMIN MUTATIONS ====================
    createAdmin: async (_, { input }, { token }) => {
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const admin = new AdminAccount({
        ...input,
        password: hashedPassword
      });
      const saved = await admin.save();
      await catatAuditLog({ token, aksi: 'ADMIN_CREATE', resource: 'Admin', resourceId: saved._id, nilaiAfter: { NIP: input.NIP, namaLengkap: input.namaLengkap, email: input.email } });
      return saved;
    },

    updateAdmin: async (_, { id, input }) => {
      if (input.password) {
        input.password = await bcrypt.hash(input.password, 10);
      }
      return await AdminAccount.findByIdAndUpdate(id, input, { new: true });
    },

    deleteAdmin: async (_, { id }, { token }) => {
      const existing = await AdminAccount.findById(id, 'namaLengkap email');
      await AdminAccount.findByIdAndDelete(id);
      await catatAuditLog({ token, aksi: 'ADMIN_DELETE', resource: 'Admin', resourceId: id, nilaiBefore: existing ? { namaLengkap: existing.namaLengkap, email: existing.email } : null });
      return { success: true, message: 'Admin deleted successfully' };
    },

    // ==================== PELANGGAN MUTATIONS ====================
    createPelanggan: async (_, { input }) => {
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = new User({
        ...input,
        password: hashedPassword,
        isVerified: false
      });
      return await user.save();
    },

    updatePelanggan: async (_, { id, input }) => {
      return await User.findByIdAndUpdate(id, input, { new: true });
    },

    deletePelanggan: async (_, { id }) => {
      await User.findByIdAndDelete(id);
      return { success: true, message: 'Pelanggan deleted successfully' };
    },

    // ==================== TEKNISI MUTATIONS ====================
    createTeknisi: async (_, { input }) => {
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const technician = new Technician({
        ...input,
        password: hashedPassword
      });
      return await technician.save();
    },

    updateTeknisi: async (_, { id, input }) => {
      return await Technician.findByIdAndUpdate(id, input, { new: true });
    },

    deleteTeknisi: async (_, { id }) => {
      await Technician.findByIdAndDelete(id);
      return { success: true, message: 'Teknisi deleted successfully' };
    },

    // ==================== KELOMPOK PELANGGAN MUTATIONS ====================
    createKelompokPelanggan: async (_, { input }) => {
      const kelompok = new KelompokPelanggan(input);
      await kelompok.save();
      await deleteCacheByPattern('kelompok:*');
      return kelompok;
    },

    updateKelompokPelanggan: async (_, { id, input }) => {
      const kelompok = await KelompokPelanggan.findByIdAndUpdate(id, input, { new: true });
      await deleteCacheByPattern('kelompok:*');
      return kelompok;
    },

    deleteKelompokPelanggan: async (_, { id }) => {
      await KelompokPelanggan.findByIdAndDelete(id);
      await deleteCacheByPattern('kelompok:*');
      return { success: true, message: 'Kelompok Pelanggan deleted successfully' };
    },

    // ==================== CONNECTION DATA MUTATIONS ====================
    createKoneksiData: async (_, args, { token }) => {
      verifyAdminToken(token);
      const { idPelanggan, NIK, NIKUrl, noKK, KKUrl, IMB, IMBUrl, alamat, kelurahan, kecamatan, luasBangunan } = args;
      const koneksi = new ConnectionData({
        idPelanggan: idPelanggan || null,
        NIK: NIK || null,
        NIKUrl: NIKUrl || null,
        noKK: noKK || null,
        KKUrl: KKUrl || null,
        IMB: IMB || null,
        IMBUrl: IMBUrl || null,
        alamat: alamat || null,
        kelurahan: kelurahan || null,
        kecamatan: kecamatan || null,
        luasBangunan: luasBangunan || null,
        statusVerifikasi: false,
      });
      await koneksi.save();
      return await ConnectionData.findById(koneksi._id).populate('idPelanggan');
    },

    deleteKoneksiData: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const koneksi = await ConnectionData.findById(id);
      if (!koneksi) throw new Error('Data koneksi tidak ditemukan');
      await ConnectionData.findByIdAndDelete(id);
      return true;
    },

    assignTeknisiToKoneksi: async (_, { id, technicianId }, { token }) => {
      const adminPayload = verifyAdminToken(token);
      const koneksi = await ConnectionData.findById(id);
      if (!koneksi) throw new Error('Data koneksi tidak ditemukan');
      const teknisi = await Technician.findById(technicianId);
      if (!teknisi) throw new Error('Teknisi tidak ditemukan');
      await catatAuditLog({ token, aksi: 'KONEKSI_ASSIGN_TEKNISI', resource: 'KoneksiData', resourceId: id, nilaiAfter: { idTeknisi: technicianId, namaTeknisi: teknisi.namaLengkap } });
      koneksi.idTeknisi = technicianId;
      koneksi.assignedAt = new Date();
      koneksi.assignedBy = adminPayload.id;
      await koneksi.save();
      return await ConnectionData.findById(id)
        .populate('idPelanggan')
        .populate('idTeknisi')
        .populate('assignedBy');
    },

    unassignTeknisiFromKoneksi: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const koneksi = await ConnectionData.findById(id);
      if (!koneksi) throw new Error('Data koneksi tidak ditemukan');
      await catatAuditLog({ token, aksi: 'KONEKSI_UNASSIGN_TEKNISI', resource: 'KoneksiData', resourceId: id, nilaiBefore: { idTeknisi: koneksi.idTeknisi } });
      koneksi.idTeknisi = null;
      koneksi.assignedAt = null;
      koneksi.assignedBy = null;
      await koneksi.save();
      return await ConnectionData.findById(id)
        .populate('idPelanggan')
        .populate('idTeknisi')
        .populate('assignedBy');
    },

    verifyKoneksiData: async (_, { id, verified, catatan }, { token }) => {
      const before = await ConnectionData.findById(id, 'statusVerifikasi');
      const result = await ConnectionData.findByIdAndUpdate(
        id,
        { statusVerifikasi: verified, catatan },
        { new: true }
      ).populate('idPelanggan');
      await catatAuditLog({ token, aksi: 'KONEKSI_VERIFY', resource: 'KoneksiData', resourceId: id, nilaiBefore: { statusVerifikasi: before?.statusVerifikasi }, nilaiAfter: { statusVerifikasi: verified, catatan } });
      return result;
    },

    updateKoneksiData: async (_, { id, input }) => {
      return await ConnectionData.findByIdAndUpdate(id, input, { new: true }).populate('idPelanggan');
    },

    // ==================== WORK ORDER MUTATIONS ====================
    createWorkOrder: async (_, { input }) => {
      const workOrder = new PekerjaanTeknisi({
        ...input,
        status: 'Ditugaskan',
        disetujui: null
      });
      const saved = await (await workOrder.save()).populate('tim');
      await notifikasiSemuaAdmin(
        'Work Order Baru Dibuat',
        'Work order baru telah dibuat dan ditugaskan ke teknisi.',
        'Informasi',
        '/operations/work-orders'
      );
      return saved;
    },

    assignWorkOrder: async (_, { id, teknisiIds }) => {
      return await PekerjaanTeknisi.findByIdAndUpdate(
        id,
        { tim: teknisiIds },
        { new: true }
      ).populate('tim');
    },

    updateWorkOrderStatus: async (_, { id, status, catatan }) => {
      const updated = await PekerjaanTeknisi.findByIdAndUpdate(
        id,
        { status, catatan },
        { new: true }
      ).populate('tim');
      // Notif ke admin saat teknisi mengubah status ke DitinjauAdmin
      if (status === 'DitinjauAdmin') {
        await notifikasiSemuaAdmin(
          'Work Order Menunggu Peninjauan',
          'Teknisi telah menyelesaikan pekerjaan dan membutuhkan persetujuan admin.',
          'Peringatan',
          '/operations/work-orders'
        );
      }
      return updated;
    },

    approveWorkOrder: async (_, { id, disetujui, catatan }) => {
      return await PekerjaanTeknisi.findByIdAndUpdate(
        id,
        { disetujui, catatan },
        { new: true }
      ).populate('tim');
    },

    // ==================== LAPORAN MUTATIONS ====================
    updateLaporanStatus: async (_, { id, status }) => {
      const updated = await Report.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).populate('idPengguna');
      // Notif ke admin saat laporan baru masuk (status Diajukan)
      if (status === 'Diajukan') {
        await notifikasiSemuaAdmin(
          'Laporan Pelanggan Baru',
          'Ada laporan baru dari pelanggan yang memerlukan penanganan.',
          'Peringatan',
          '/operations/laporan'
        );
      }
      return updated;
    },

    createWorkOrderFromLaporan: async (_, { idLaporan, teknisiIds, catatan }) => {
      // Cek laporan ada
      const laporan = await Report.findById(idLaporan);
      if (!laporan) throw new Error('Laporan tidak ditemukan');

      // Cek belum ada work order aktif untuk laporan ini
      const existingWO = await PekerjaanTeknisi.findOne({
        idLaporan,
        status: { $nin: ['Selesai', 'Dibatalkan'] }
      });
      if (existingWO) throw new Error('Work order aktif untuk laporan ini sudah ada');

      // Buat PekerjaanTeknisi (Work Order) dengan referensi langsung ke laporan
      const workOrder = new PekerjaanTeknisi({
        idLaporan,
        tim: teknisiIds,
        status: 'Ditugaskan',
        disetujui: null,
        catatan: catatan || '',
      });
      const saved = await workOrder.save();

      // Update status laporan menjadi ProsesPerbaikan
      await Report.findByIdAndUpdate(idLaporan, { status: 'ProsesPerbaikan' });

      // Kirim notifikasi
      await notifikasiSemuaAdmin(
        'Work Order Baru dari Laporan',
        `Work order telah dibuat untuk menangani laporan: ${laporan.namaLaporan}`,
        'Informasi',
        '/operations/work-orders'
      );

      return await PekerjaanTeknisi.findById(saved._id)
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim');
    },

    // ==================== METERAN MUTATIONS ====================
    createMeteran: async (_, { idKelompokPelanggan, nomorMeteran, nomorAkun, idKoneksiData }, { token }) => {
      verifyAdminToken(token);
      const existing = await Meteran.findOne({ nomorAkun });
      if (existing) throw new Error(`Nomor akun ${nomorAkun} sudah digunakan`);
      const meteran = new Meteran({ idKelompokPelanggan, nomorMeteran, nomorAkun, idKoneksiData: idKoneksiData || null });
      await meteran.save();
      await catatAuditLog({ token, aksi: 'METERAN_CREATE', resource: 'Meteran', resourceId: meteran._id, nilaiAfter: { nomorMeteran, nomorAkun, idKoneksiData } });
      return await Meteran.findById(meteran._id).populate('idKelompokPelanggan').populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    updateMeteran: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findByIdAndUpdate(id, updates, { new: true })
        .populate('idKelompokPelanggan')
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      return meteran;
    },

    deleteMeteran: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(id);
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      const activeBilling = await Billing.findOne({ idMeteran: id, statusPembayaran: { $in: ['Pending'] } });
      if (activeBilling) throw new Error('Meteran masih memiliki tagihan yang belum dibayar');
      await catatAuditLog({ token, aksi: 'METERAN_DELETE', resource: 'Meteran', resourceId: id, nilaiBefore: { nomorMeteran: meteran.nomorMeteran, nomorAkun: meteran.nomorAkun } });
      await Meteran.findByIdAndDelete(id);
      return true;
    },

    // ==================== TAGIHAN MUTATIONS ====================
    generateTagihan: async (_, { idMeteran, periode }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(idMeteran).populate('idKoneksiData');
      if (!meteran) throw new Error('Meteran tidak ditemukan');

      // Cek tagihan periode ini sudah ada
      const periodeDate = new Date(periode + '-01');
      const nextMonth = new Date(periodeDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const existing = await Billing.findOne({ idMeteran, periode: { $gte: periodeDate, $lt: nextMonth } });
      if (existing) throw new Error(`Tagihan untuk meteran ini pada periode ${periode} sudah ada`);

      const kelompok = await KelompokPelanggan.findById(meteran.idKelompokPelanggan);

      // Gunakan pemakaianBelumTerbayar dari meteran (diisi oleh IoT via REST pipeline)
      // Jika belum ada data IoT, fallback ke 0 (tagihan biaya beban saja)
      const pemakaian = meteran.pemakaianBelumTerbayar || 0;
      const penggunaanSebelum = meteran.totalPemakaian - pemakaian;
      const biaya = pemakaian <= 10
        ? pemakaian * (kelompok?.hargaDiBawah10mKubik || 1500)
        : 10 * (kelompok?.hargaDiBawah10mKubik || 1500) + (pemakaian - 10) * (kelompok?.hargaDiAtas10mKubik || 2000);
      const biayaBeban = kelompok?.biayaBeban || 5000;

      const billing = new Billing({
        userId: meteran.idKoneksiData?.idPelanggan || null,
        idMeteran: meteran._id,
        periode: periodeDate,
        penggunaanSebelum: penggunaanSebelum > 0 ? penggunaanSebelum : 0,
        penggunaanSekarang: meteran.totalPemakaian,
        totalPemakaian: pemakaian,
        biaya,
        biayaBeban,
        totalBiaya: biaya + biayaBeban,
        statusPembayaran: 'Pending',
        tenggatWaktu: new Date(new Date(periodeDate).setDate(new Date(periodeDate).getDate() + 30)),
        menunggak: false,
      });
      await billing.save();
      // Populate untuk memenuhi kontrak GraphQL schema (idMeteran: Meteran!)
      return await Billing.findById(billing._id).populate({
        path: 'idMeteran',
        populate: [{ path: 'idKelompokPelanggan' }, { path: 'idKoneksiData' }],
      });
    },

    updateStatusPembayaran: async (_, { id, status }, { token }) => {
      verifyAdminToken(token);
      const tagihan = await Billing.findById(id);
      if (!tagihan) throw new Error('Tagihan tidak ditemukan');

      const updateData = { statusPembayaran: status };
      if (status === 'Settlement') {
        updateData.tanggalPembayaran = new Date().toISOString();
      }

      const updated = await Billing.findByIdAndUpdate(id, updateData, { new: true }).populate('idMeteran');
      return updated;
    },

    // ==================== TAGIHAN BULK MUTATION ====================
    generateTagihanBulanan: async (_, { periode, idMeteranList }, { token }) => {
      verifyAdminToken(token);
      let berhasil = 0;
      let gagal = 0;

      for (const idMeteran of idMeteranList) {
        try {
          const meteran = await Meteran.findById(idMeteran).populate('idKoneksiData');
          if (!meteran) { gagal++; continue; }

          // Cek apakah tagihan periode ini sudah ada
          const periodeDate = new Date(periode + '-01');
          const existing = await Billing.findOne({ idMeteran, periode: { $gte: periodeDate, $lt: new Date(new Date(periodeDate).setMonth(new Date(periodeDate).getMonth() + 1)) } });
          if (existing) { gagal++; continue; }

          // Ambil kelompok pelanggan untuk tarif
          const kelompok = await KelompokPelanggan.findById(meteran.idKelompokPelanggan);
          // Gunakan pemakaianBelumTerbayar dari meteran (diisi oleh IoT via REST pipeline)
          const pemakaian = meteran.pemakaianBelumTerbayar || 0;
          const penggunaanSebelum = meteran.totalPemakaian - pemakaian;
          const biaya = pemakaian <= 10
            ? pemakaian * (kelompok?.hargaDiBawah10mKubik || 1500)
            : 10 * (kelompok?.hargaDiBawah10mKubik || 1500) + (pemakaian - 10) * (kelompok?.hargaDiAtas10mKubik || 2000);
          const biayaBeban = kelompok?.biayaBeban || 5000;

          const billing = new Billing({
            userId: meteran.idKoneksiData?.idPelanggan || null,
            idMeteran: meteran._id,
            periode: periodeDate,
            penggunaanSebelum: penggunaanSebelum > 0 ? penggunaanSebelum : 0,
            penggunaanSekarang: meteran.totalPemakaian,
            totalPemakaian: pemakaian,
            biaya,
            biayaBeban,
            totalBiaya: biaya + biayaBeban,
            statusPembayaran: 'Pending',
            tenggatWaktu: new Date(new Date(periodeDate).setDate(new Date(periodeDate).getDate() + 30)),
            menunggak: false,
          });
          await billing.save();
          berhasil++;
        } catch (err) {
          console.error('Gagal generate tagihan untuk meteran', idMeteran, err.message);
          gagal++;
        }
      }
      return { berhasil, gagal, pesan: `Generate selesai: ${berhasil} berhasil, ${gagal} gagal` };
    },

    // ==================== SURVEI MUTATIONS ====================
    createSurvei: async (_, args, { token }) => {
      verifyAdminToken(token);
      const { idKoneksiData, idTeknisi, urlJaringan, diameterPipa, urlPosisiBak, posisiMeteran, jumlahPenghuni, standar, catatan, koordinat } = args;
      const survei = new SurveyData({
        idKoneksiData,
        idTeknisi,
        urlJaringan,
        diameterPipa,
        urlPosisiBak,
        posisiMeteran,
        jumlahPenghuni,
        standar,
        catatan: catatan || '',
        koordinat: koordinat || { latitude: null, longitude: null },
      });
      await survei.save();
      return await SurveyData.findById(survei._id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .populate('idTeknisi');
    },

    updateSurvei: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) survei[key] = updates[key];
      });
      await survei.save();
      return await SurveyData.findById(id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } })
        .populate('idTeknisi');
    },

    deleteSurvei: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const survei = await SurveyData.findById(id);
      if (!survei) throw new Error('Survei tidak ditemukan');
      await SurveyData.findByIdAndDelete(id);
      return true;
    },

    // ==================== RAB CONNECTION MUTATIONS ====================
    createRABConnection: async (_, { idKoneksiData, totalBiaya, urlRab, catatan }, { token }) => {
      verifyAdminToken(token);
      const existing = await RabConnection.findOne({ idKoneksiData });
      if (existing) throw new Error('RAB untuk koneksi data ini sudah ada');
      const rab = new RabConnection({
        idKoneksiData,
        totalBiaya,
        urlRab,
        catatan: catatan || '',
        statusPembayaran: 'Pending',
      });
      await rab.save();
      return await RabConnection.findById(rab._id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    updateRABConnection: async (_, { id, ...updates }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) rab[key] = updates[key];
      });
      await rab.save();
      return await RabConnection.findById(id)
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan' } });
    },

    deleteRABConnection: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const rab = await RabConnection.findById(id);
      if (!rab) throw new Error('RAB Connection tidak ditemukan');
      await RabConnection.findByIdAndDelete(id);
      return true;
    },

    // ==================== NOTIFIKASI MUTATIONS ====================
    createNotifikasi: async (_, { input }) => {
      const notification = new Notification({
        ...input,
        isRead: false
      });
      return await notification.save();
    },

    broadcastNotifikasi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const pengguna = await User.find({}, '_id').lean();
      const notifs = await Promise.all(
        pengguna.map(p =>
          new Notification({ ...input, idPelanggan: p._id, isRead: false }).save()
        )
      );
      return notifs;
    },

    markNotifikasiAsRead: async (_, { id }) => {
      return await Notification.findByIdAndUpdate(
        id,
        { isRead: true },
        { new: true }
      );
    },

    // ==================== PEMASANGAN MUTATIONS ====================
    createPemasangan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const pemasangan = new Pemasangan(input);
      return await pemasangan.save();
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

    verifyPemasangan: async (_, { id, statusVerifikasi, catatan }, { token }) => {
      const admin = verifyAdminToken(token);
      return await Pemasangan.findByIdAndUpdate(
        id,
        {
          statusVerifikasi,
          diverifikasiOleh: admin.id,
          tanggalVerifikasi: new Date().toISOString(),
          ...(catatan && { catatan }),
        },
        { new: true }
      );
    },

    // ==================== PENGAWASAN PEMASANGAN MUTATIONS ====================
    createPengawasanPemasangan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const pengawasan = new PengawasanPemasangan(input);
      return await pengawasan.save();
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

    // ==================== PENGAWASAN SETELAH PEMASANGAN MUTATIONS ====================
    createPengawasanSetelahPemasangan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const pengawasan = new PengawasanSetelahPemasangan(input);
      return await pengawasan.save();
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

    // ==================== PENYELESAIAN LAPORAN MUTATIONS ====================
    createPenyelesaianLaporan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const penyelesaian = new PenyelesaianLaporan(input);
      const saved = await penyelesaian.save();
      if (input.idLaporan) {
        await Report.findByIdAndUpdate(input.idLaporan, { status: 'Selesai' });
      }
      return saved;
    },

    updatePenyelesaianLaporan: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.findByIdAndUpdate(id, input, { new: true });
    },

    deletePenyelesaianLaporan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await PenyelesaianLaporan.findByIdAndDelete(id);
      return true;
    },
  },

  // ==================== FIELD RESOLVERS (for schema/model field name mismatches) ====================
  Notifikasi: {
    idAdmin: async (parent) => {
      if (!parent.idAdmin) return null;
      if (typeof parent.idAdmin === 'object' && parent.idAdmin._id) return parent.idAdmin;
      return await AdminAccount.findById(parent.idAdmin);
    },
    idTeknisi: async (parent) => {
      if (!parent.idTeknisi) return null;
      if (typeof parent.idTeknisi === 'object' && parent.idTeknisi._id) return parent.idTeknisi;
      return await Technician.findById(parent.idTeknisi);
    },
  },

  Meteran: {
    idKelompokPelanggan: async (parent) => {
      // Support both new (idKelompokPelanggan) and old (kelompokPelangganId) field names
      const ref = parent.idKelompokPelanggan || parent.kelompokPelangganId;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      const refId = ref.toString();
      const cacheKey = `kelompok:${refId}`;
      const cached = await getCache(cacheKey);
      if (cached) return cached;
      const kelompok = await KelompokPelanggan.findById(refId);
      if (kelompok) await setCache(cacheKey, kelompok.toObject(), 3600);
      return kelompok;
    },
    idKoneksiData: async (parent) => {
      // Support both new (idKoneksiData) and old (connectionDataId) field names
      const ref = parent.idKoneksiData || parent.connectionDataId;
      if (!ref) return null;
      // If already populated object, re-fetch to ensure idPelanggan is populated
      const id = (typeof ref === 'object' && ref._id) ? ref._id : ref;
      return await ConnectionData.findById(id).populate('idPelanggan');
    }
  },

  Laporan: {
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k || (k.latitude == null && k.longitude == null)) return null;
      return {
        _id: parent._id,
        latitude: k.latitude ?? null,
        longitude: k.longitude ?? null,
      };
    }
  },

  PekerjaanTeknisi: {
    idLaporan: async (parent) => {
      if (!parent.idLaporan) return null;
      if (typeof parent.idLaporan === 'object' && parent.idLaporan._id) return parent.idLaporan;
      return await Report.findById(parent.idLaporan).populate('idPengguna');
    }
  },

  Survei: {
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k) return null;
      // Support both new (latitude/longitude) and old (lat/long) field names
      return {
        _id: parent._id,
        latitude: k.latitude ?? k.lat ?? null,
        longitude: k.longitude ?? k.long ?? null,
      };
    }
  },

  AuditLog: {
    nilaiBefore: (parent) => parent.nilaiBefore ? JSON.stringify(parent.nilaiBefore) : null,
    nilaiAfter: (parent) => parent.nilaiAfter ? JSON.stringify(parent.nilaiAfter) : null,
  },

  KoneksiData: {
    idPelanggan: async (parent) => {
      // Support both new (idPelanggan) and old (userId) field names
      const ref = parent.idPelanggan || parent.userId;
      if (!ref) return null;

      let user;
      if (typeof ref === 'object' && ref._id) {
        user = ref;
      } else {
        user = await User.findById(ref);
      }

      if (!user) return null;

      return {
        _id: user._id,
        email: user.email,
        noHP: user.noHP,
        namaLengkap: user.namaLengkap,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    }
  }
};
