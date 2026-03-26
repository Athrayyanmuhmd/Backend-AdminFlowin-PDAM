import type { GraphQLContext } from '../../types/index.js';
import logger from '../../utils/logger.js';
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        idAdmin = decoded.id;
        const admin = await AdminAccount.findById(decoded.id, 'namaLengkap');
        if (admin) namaAdmin = admin.namaLengkap;
      } catch (_) {}
    }
    await AuditLog.create({ idAdmin, namaAdmin, aksi, resource, resourceId: resourceId ? String(resourceId) : null, nilaiBefore, nilaiAfter, catatan });
  } catch (err) {
    logger.error({ err }, 'Gagal mencatat audit log');
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
    logger.error({ err }, 'Gagal kirim notifikasi admin');
  }
}


// Helper: validasi input
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePassword(password) {
  if (!password || password.length < 8) throw new Error('Kata sandi minimal 8 karakter');
}
function validatePhone(noHP) {
  if (noHP && !/^(\+62|62|0)[0-9]{8,13}$/.test(noHP.replace(/\s/g, '')))
    throw new Error('Format nomor HP tidak valid');
}

export const resolvers = {
  Query: {
    // ==================== ADMIN QUERIES ====================
    getAdmin: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await AdminAccount.findById(id);
    },

    getAllAdmins: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await AdminAccount.find().limit(500);
    },

    // ==================== AUDIT LOG QUERIES ====================
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
      return await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('idAdmin', 'namaLengkap email');
    },

    loginAdmin: async (_, { email, password }) => {
      const admin = await AdminAccount.findOne({ email });
      if (!admin) throw new Error('Email atau kata sandi salah.');

      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) throw new Error('Email atau kata sandi salah.');

      const token = jwt.sign(
        { id: admin._id, email: admin.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Save token to DB so it can be invalidated on logout
      admin.token = token;
      await admin.save();

      logger.info({ adminId: admin._id, email: admin.email }, 'Admin login successful');
      return { token, admin: { ...admin.toObject(), token } };
    },

    // ==================== PELANGGAN QUERIES ====================
    getPengguna: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const user = await User.findById(id);
      if (!user) return null;
      return {
        ...user.toObject(),
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
      };
    },

    getAllPengguna: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const users = await User.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500));
      return users.map(user => ({
        ...user.toObject(),
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
      }));
    },

    searchPengguna: async (_, { search }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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
    getTeknisi: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const teknisi = await Technician.findById(id);
      if (!teknisi) return null;
      return {
        ...teknisi.toObject(),
        createdAt: teknisi.createdAt?.toISOString(),
        updatedAt: teknisi.updatedAt?.toISOString(),
      };
    },

    getAllTeknisi: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const teknisis = await Technician.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500));
      return teknisis.map(tek => ({
        ...tek.toObject(),
        createdAt: tek.createdAt?.toISOString(),
        updatedAt: tek.updatedAt?.toISOString(),
      }));
    },

    getTeknisiByDivisi: async (_, { divisi }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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
    getMeteran: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Meteran.findById(id)
        .populate({ path: 'idKelompokPelanggan', strictPopulate: false })
        .populate({ path: 'idKoneksiData', strictPopulate: false });
    },

    getAllMeteran: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Meteran.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500))
        .populate({ path: 'idKelompokPelanggan', strictPopulate: false })
        .populate({ path: 'idKoneksiData', strictPopulate: false });
    },

    getMeteranByPelanggan: async (_, { idPelanggan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const connections = await ConnectionData.find({ idPelanggan });
      const connectionIds = connections.map(c => c._id);
      return await Meteran.find({ idKoneksiData: { $in: connectionIds } })
        .populate('idKelompokPelanggan')
        .populate('idKoneksiData');
    },

    // ==================== CONNECTION DATA QUERIES ====================
    getKoneksiData: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.findById(id).populate('idPelanggan');
    },

    getAllKoneksiData: async (_, { limit = 50, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500)).populate('idPelanggan');
    },

    getPendingKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find({ statusVerifikasi: 'Menunggu' }).populate('idPelanggan');
    },

    getVerifiedKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find({ statusVerifikasi: 'Disetujui' }).populate('idPelanggan');
    },

    getDitolakKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await ConnectionData.find({ statusVerifikasi: 'Ditolak' }).populate('idPelanggan');
    },

    // ==================== RIWAYAT PENGGUNAAN QUERIES ====================
    getRiwayatPenggunaan: async (_, { meteranId, limit = 50 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await HistoryUsage.find({ meteranId })
        .sort({ createdAt: -1 })
        .limit(limit);
    },

    getRiwayatPenggunaanBulanan: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const mongoose = await import('mongoose');
      const hasil = await HistoryUsage.aggregate([
        { $match: { meteranId: new mongoose.default.Types.ObjectId(meteranId) } },
        {
          $group: {
            _id: {
              tahun: { $year: '$createdAt' },
              bulan: { $month: '$createdAt' },
            },
            totalPemakaian: { $sum: '$penggunaanAir' },
            jumlahRecord: { $count: {} },
          },
        },
        { $sort: { '_id.tahun': 1, '_id.bulan': 1 } },
        { $limit: 12 },
      ]);
      const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      return hasil.map(item => ({
        bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`,
        totalPemakaian: item.totalPemakaian,
        jumlahRecord: item.jumlahRecord,
      }));
    },

    getEstimasiBiaya: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(meteranId).populate('idKelompokPelanggan');
      if (!meteran) throw new Error('Meteran tidak ditemukan');
      const kelompok = meteran.idKelompokPelanggan as any;
      const pemakaian = meteran.pemakaianBelumTerbayar || 0;
      const biaya = pemakaian <= 10
        ? pemakaian * (kelompok?.hargaDiBawah10mKubik || 1500)
        : 10 * (kelompok?.hargaDiBawah10mKubik || 1500) + (pemakaian - 10) * (kelompok?.hargaDiAtas10mKubik || 2000);
      const biayaBeban = kelompok?.biayaBeban || 5000;
      return {
        pemakaianBelumTerbayar: pemakaian,
        estimasiBiaya: biaya,
        biayaBeban,
        totalEstimasi: biaya + biayaBeban,
        namaKelompok: kelompok?.namaKelompok || null,
      };
    },

    // ==================== TAGIHAN QUERIES ====================
    getTagihan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.findById(id).populate({ path: 'idMeteran', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } });
    },

    getAllTagihan: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 1000))
        .populate({ path: 'idMeteran', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .lean();
    },

    getTagihanByMeteran: async (_, { idMeteran }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find({ idMeteran }).populate({ path: 'idMeteran', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } });
    },

    getTagihanByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find({ statusPembayaran: status }).populate({ path: 'idMeteran', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } });
    },

    getTunggakan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find({ menunggak: true }).populate({ path: 'idMeteran', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } });
    },

    getDaftarPemutusan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);

      const DENDA_RINGAN   = 150_000;   // < 3 bulan
      const DENDA_BERAT    = 1_500_000; // >= 3 bulan

      // Kumpulkan userId yang sudah inactive
      const inactiveUsers = await User.find({ accountStatus: 'inactive' }, '_id').lean();
      const inactiveIds   = new Set(inactiveUsers.map((u: any) => u._id.toString()));

      // Kumpulkan userId yang punya tagihan merged (sudah ter-detect 3 bulan)
      const mergedBillings = await Billing.find({ isMergedBilling: true, statusPembayaran: 'Pending' }, 'userId').lean();
      const mergedIds      = new Set(mergedBillings.map((b: any) => b.userId.toString()));

      const allUserIds = [...new Set([...inactiveIds, ...mergedIds])];
      if (allUserIds.length === 0) return [];

      const result = [];

      for (const uid of allUserIds) {
        const user = await User.findById(uid).lean();
        if (!user) continue;

        // Ambil semua tagihan Pending (termasuk merged billing, exclude status Merged)
        const tagihanTunggakan = await Billing.find({
          userId: uid,
          statusPembayaran: 'Pending',
        }).sort({ periode: 1 }).lean();

        const jumlahBulanTunggak = tagihanTunggakan.reduce(
          (sum: number, b: any) => sum + (b.bulanCakupan ?? 1), 0
        );
        const totalTunggakan = tagihanTunggakan.reduce(
          (sum: number, b: any) => sum + (b.totalBiaya ?? 0), 0
        );
        const denda = jumlahBulanTunggak >= 3 ? DENDA_BERAT : DENDA_RINGAN;

        result.push({
          user,
          tagihanTunggakan,
          jumlahBulanTunggak,
          totalTunggakan,
          denda,
          sudahDiputus: inactiveIds.has(uid),
        });
      }

      return result;
    },

    // ==================== LAPORAN QUERIES ====================
    getLaporan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.findById(id).populate('idPengguna');
    },

    getAllLaporan: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find().sort({ createdAt: -1 }).lean().skip(offset).limit(Math.min(limit, 500)).populate('idPengguna');
    },

    getLaporanByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find({ status }).populate('idPengguna');
    },

    getLaporanByPelanggan: async (_, { idPelanggan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find({ idPengguna: idPelanggan }).populate('idPengguna');
    },

    // ==================== WORK ORDER QUERIES ====================
    getWorkOrder: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.findById(id)
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim');
    },

    getAllWorkOrders: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find().limit(500)
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getWorkOrdersByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ status })
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getWorkOrdersByTeknisi: async (_, { idTeknisi }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ tim: idTeknisi })
        .populate({ path: 'idSurvei', populate: { path: 'idKoneksiData', populate: { path: 'idPelanggan' } } })
        .populate('rabId')
        .populate({ path: 'idLaporan', populate: { path: 'idPengguna' } })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    // ==================== RAB CONNECTION QUERIES ====================
    getRABConnection: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.findById(id).populate('idKoneksiData');
    },

    getAllRABConnections: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.find().populate('idKoneksiData');
    },

    getPendingRAB: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await RabConnection.find({ statusPembayaran: 'Pending' }).populate('idKoneksiData');
    },

    // ==================== SURVEI QUERIES ====================
    getSurvei: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.findById(id)
        .populate('idKoneksiData')
        .populate('idTeknisi');
    },

    getAllSurvei: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await SurveyData.find()
        .populate('idKoneksiData')
        .populate('idTeknisi');
    },

    // ==================== NOTIFIKASI QUERIES ====================
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

    getAllNotifikasiAdmin: async (_, __, { token }) => {
      // Return [] instead of throwing when token invalid — this query is polled every 30s
      // so throwing would flood the error log on expired sessions
      try { verifyAdminToken(token); } catch { return []; }
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      const adminId = decoded.id || decoded.userId;
      return await Notification.find({ idAdmin: adminId })
        .populate("idAdmin", "namaLengkap")
        .populate("idPelanggan", "namaLengkap email")
        .populate("idTeknisi", "namaLengkap")
        .sort({ createdAt: -1 })
        .limit(50);
    },

    // ==================== DASHBOARD STATS ====================
    getDashboardStats: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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
        laporanTerbuka,
        koneksiMenunggu,
        koneksiDisetujui,
        koneksiDitolak,
      ] = await Promise.all([
        User.countDocuments(),
        Technician.countDocuments(),
        Meteran.countDocuments(),
        ConnectionData.countDocuments({ statusVerifikasi: 'Menunggu' }),
        PekerjaanTeknisi.countDocuments({ status: { $in: ['Ditugaskan', 'SedangDikerjakan'] } }),
        Billing.countDocuments({ menunggak: true }),
        Report.countDocuments({ status: { $in: ['Diajukan', 'ProsesPerbaikan'] } }),
        ConnectionData.countDocuments({ statusVerifikasi: 'Menunggu' }),
        ConnectionData.countDocuments({ statusVerifikasi: 'Disetujui' }),
        ConnectionData.countDocuments({ statusVerifikasi: 'Ditolak' }),
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
        laporanTerbuka,
        koneksiMenunggu,
        koneksiDisetujui,
        koneksiDitolak,
      };

      // Cache for 5 minutes (300 seconds)
      await setCache(cacheKey, stats, 300);

      return stats;
    },

    // ==================== DASHBOARD CHART QUERIES ====================
    getChartKonsumsiPerBulan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getDistribusiKelompokPelanggan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getTunggakanPerKelompok: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getTagihanTertinggi: async (_, { limit = 10 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getRingkasanStatusTagihan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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
    getKpiOperasional: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getRingkasanWorkOrder: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getRingkasanLaporan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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
    getPekerjaanTeknisi: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.findById(id)
        .populate('idSurvei')
        .populate('rabId')
        .populate('idPenyelesaianLaporan')
        .populate('idPemasangan')
        .populate('idPengawasanPemasangan')
        .populate('idPengawasanSetelahPemasangan')
        .populate('tim');
    },

    getAllPekerjaanTeknisi: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find().limit(500)
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ status })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiByTeknisi: async (_, { teknisiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({ tim: teknisiId })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    getPekerjaanTeknisiPendingApproval: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PekerjaanTeknisi.find({
        disetujui: null,
        status: 'DitinjauAdmin'
      })
        .populate('tim')
        .sort({ createdAt: -1 });
    },

    // ==================== PENYELESAIAN LAPORAN QUERIES ====================
    getPenyelesaianLaporan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.findById(id)
        .populate('idLaporan')
        .populate('teknisiId');
    },

    getPenyelesaianLaporanByLaporan: async (_, { idLaporan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find({ idLaporan })
        .populate('teknisiId')
        .sort({ tanggalSelesai: -1 });
    },

    getPenyelesaianLaporanByTeknisi: async (_, { teknisiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find({ teknisiId })
        .populate('idLaporan')
        .sort({ tanggalSelesai: -1 });
    },

    getAllPenyelesaianLaporan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find().limit(500)
        .populate('idLaporan')
        .populate('teknisiId')
        .sort({ tanggalSelesai: -1 });
    },

    // ==================== PEMASANGAN QUERIES ====================
    getPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findById(id)
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh');
    },

    getPemasanganByKoneksiData: async (_, { idKoneksiData }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.findOne({ idKoneksiData })
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh');
    },

    getPemasanganByTeknisi: async (_, { teknisiId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find({ teknisiId })
        .populate('idKoneksiData')
        .populate('diverifikasiOleh')
        .sort({ tanggalPemasangan: -1 });
    },

    getPemasanganByStatus: async (_, { statusVerifikasi }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find({ statusVerifikasi })
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh')
        .sort({ tanggalPemasangan: -1 });
    },

    getAllPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Pemasangan.find().limit(500)
        .populate('idKoneksiData')
        .populate('teknisiId')
        .populate('diverifikasiOleh')
        .sort({ tanggalPemasangan: -1 });
    },

    // ==================== PENGAWASAN PEMASANGAN QUERIES ====================
    getPengawasanPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.findById(id)
        .populate('idPemasangan')
        .populate('supervisorId');
    },

    getPengawasanPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ idPemasangan })
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanPemasanganBySupervisor: async (_, { supervisorId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find({ supervisorId })
        .populate('idPemasangan')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanPemasanganProblematic: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getAllPengawasanPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanPemasangan.find().limit(500)
        .populate('idPemasangan')
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    // ==================== PENGAWASAN SETELAH PEMASANGAN QUERIES ====================
    getPengawasanSetelahPemasangan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.findById(id)
        .populate('idPemasangan')
        .populate('supervisorId');
    },

    getPengawasanSetelahPemasanganByPemasangan: async (_, { idPemasangan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ idPemasangan })
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasanganBySupervisor: async (_, { supervisorId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find({ supervisorId })
        .populate('idPemasangan')
        .sort({ tanggalPengawasan: -1 });
    },

    getPengawasanSetelahPemasanganProblematic: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
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

    getAllPengawasanSetelahPemasangan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.find().limit(500)
        .populate('idPemasangan')
        .populate('supervisorId')
        .sort({ tanggalPengawasan: -1 });
    },

    getAverageCustomerRating: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PengawasanSetelahPemasangan.getAverageRating();
    }
  },

  Mutation: {
    // ==================== ADMIN MUTATIONS ====================
    createAdmin: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePassword(input.password);
      validatePhone(input.noHP);
      const existing = await AdminAccount.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const admin = new AdminAccount({
        ...input,
        password: hashedPassword
      });
      const saved = await admin.save();
      await catatAuditLog({ token, aksi: 'ADMIN_CREATE', resource: 'Admin', resourceId: saved._id, nilaiAfter: { NIP: input.NIP, namaLengkap: input.namaLengkap, email: input.email } });
      return saved;
    },

    updateAdmin: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      if (input.password) {
        input.password = await bcrypt.hash(input.password, 10);
      }
      const updated = await AdminAccount.findByIdAndUpdate(id, input, { new: true });
      await catatAuditLog({ token, aksi: 'ADMIN_UPDATE', resource: 'Admin', resourceId: id, nilaiAfter: { namaLengkap: input.namaLengkap, email: input.email } });
      return updated;
    },

    deleteAdmin: async (_, { id }, { token }) => {
      const existing = await AdminAccount.findById(id, 'namaLengkap email');
      await AdminAccount.findByIdAndDelete(id);
      await catatAuditLog({ token, aksi: 'ADMIN_DELETE', resource: 'Admin', resourceId: id, nilaiBefore: existing ? { namaLengkap: existing.namaLengkap, email: existing.email } : null });
      return { success: true, message: 'Admin deleted successfully' };
    },

    // ==================== PELANGGAN MUTATIONS ====================
    createPelanggan: async (_, { input }) => {
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePassword(input.password);
      validatePhone(input.noHP);
      const existing = await User.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
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
    createTeknisi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePassword(input.password);
      validatePhone(input.noHP);
      const existing = await Technician.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
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
    createKelompokPelanggan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const { hargaDiBawah10mKubik, hargaDiAtas10mKubik, biayaBeban } = input;
      if (hargaDiBawah10mKubik < 0 || !Number.isFinite(hargaDiBawah10mKubik)) throw new Error('hargaDiBawah10mKubik harus positif');
      if (hargaDiAtas10mKubik < 0 || !Number.isFinite(hargaDiAtas10mKubik)) throw new Error('hargaDiAtas10mKubik harus positif');
      if (biayaBeban !== undefined && biayaBeban !== null && (biayaBeban < 0 || !Number.isFinite(biayaBeban))) throw new Error('biayaBeban harus positif');
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
      if (biayaBeban !== undefined && biayaBeban !== null && (biayaBeban < 0 || !Number.isFinite(biayaBeban))) throw new Error('biayaBeban harus positif');
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
      koneksi.assignedBy = (adminPayload as any).id;
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

    verifyKoneksiData: async (_, { id, status, catatan, alasanPenolakan }, { token }) => {
      const validStatus = ['Menunggu', 'Disetujui', 'Ditolak'];
      if (!validStatus.includes(status)) throw new Error('Status tidak valid. Gunakan: Menunggu, Disetujui, atau Ditolak');
      if (status === 'Ditolak' && !alasanPenolakan) throw new Error('Alasan penolakan wajib diisi saat menolak pengajuan');
      const before = await ConnectionData.findById(id, 'statusVerifikasi');
      const updateData = {
        statusVerifikasi: status,
        catatan: catatan || null,
        tanggalVerifikasi: status !== 'Menunggu' ? new Date() : null,
        alasanPenolakan: status === 'Ditolak' ? alasanPenolakan : null,
      };
      const result = await ConnectionData.findByIdAndUpdate(id, updateData, { new: true })
        .populate('idPelanggan')
        .populate('idTeknisi')
        .populate('assignedBy');
      await catatAuditLog({ token, aksi: 'KONEKSI_VERIFY', resource: 'KoneksiData', resourceId: id, nilaiBefore: { statusVerifikasi: before?.statusVerifikasi }, nilaiAfter: { statusVerifikasi: status, alasanPenolakan } });
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
        userId: (meteran.idKoneksiData as any)?.idPelanggan || null,
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

      const updateData: Record<string, any> = { statusPembayaran: status };
      if (status === 'Settlement') {
        updateData.tanggalPembayaran = new Date().toISOString();
      }

      const updated = await Billing.findByIdAndUpdate(id, updateData, { new: true }).populate('idMeteran');
      return updated;
    },

    // ─── Pemutusan: Non-aktifkan pelanggan ────────────────────────────────────
    deactivateCustomer: async (_, { userId }, { token }) => {
      verifyAdminToken(token);
      const DENDA_RINGAN = 150_000;
      const DENDA_BERAT  = 1_500_000;

      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');
      if (user.accountStatus === 'inactive') throw new Error('Pelanggan sudah dalam status non-aktif');

      // Hitung jumlah bulan tunggak
      const pendingBillings = await Billing.find({
        userId,
        statusPembayaran: 'Pending',
        jenisBilling: { $ne: 'denda' },
      }).sort({ periode: 1 }).lean();

      const jumlahBulanTunggak = pendingBillings.reduce(
        (sum: number, b: any) => sum + (b.bulanCakupan ?? 1), 0
      );
      if (jumlahBulanTunggak < 3) throw new Error('Pelanggan belum memenuhi syarat pemutusan (minimal 3 bulan menunggak)');

      const dendaAmount = jumlahBulanTunggak >= 3 ? DENDA_BERAT : DENDA_RINGAN;

      // Buat tagihan denda terpisah
      const meteranTagihan = pendingBillings[0];
      if (meteranTagihan) {
        await Billing.create({
          userId,
          idMeteran:         meteranTagihan.idMeteran,
          periode:           new Date(),
          penggunaanSebelum: 0,
          penggunaanSekarang: 0,
          totalPemakaian:    0,
          biaya:             0,
          biayaBeban:        0,
          totalBiaya:        dendaAmount,
          statusPembayaran:  'Pending',
          tenggatWaktu:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          menunggak:         true,
          jenisBilling:      'denda',
          bulanCakupan:      0,
          catatan:           `Denda pemutusan (${jumlahBulanTunggak} bulan menunggak): Rp${dendaAmount.toLocaleString('id-ID')}`,
        });
      }

      // Non-aktifkan pelanggan
      user.accountStatus = 'inactive';
      await user.save();

      // Notifikasi ke pelanggan
      await Notification.create({
        idPelanggan: userId,
        judul: 'ID Pelanggan Dinonaktifkan',
        pesan: `ID pelanggan Anda telah dinonaktifkan karena menunggak ${jumlahBulanTunggak} bulan. Harap segera lunasi semua tunggakan beserta denda Rp${dendaAmount.toLocaleString('id-ID')} untuk mengaktifkan kembali.`,
        kategori: 'Peringatan',
        link: '/pembayaran',
        isRead: false,
      }).catch(() => {});

      return user;
    },

    // ─── Pemutusan: Konfirmasi pembayaran via loket (cash) ───────────────────
    konfirmasiPembayaranLoket: async (_, { userId }, { token }) => {
      verifyAdminToken(token);

      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');

      // Tandai semua tagihan Pending (termasuk denda) sebagai Settlement
      const now = new Date();
      await Billing.updateMany(
        { userId, statusPembayaran: 'Pending' },
        {
          $set: {
            statusPembayaran:  'Settlement',
            tanggalPembayaran: now,
            metodePembayaran:  'Loket',
            menunggak:         false,
          },
        }
      );

      // Aktifkan kembali pelanggan
      user.accountStatus = 'active';
      await user.save();

      // Notifikasi ke pelanggan
      await Notification.create({
        idPelanggan: userId,
        judul: 'ID Pelanggan Aktif Kembali',
        pesan: 'Pembayaran Anda telah dikonfirmasi. ID pelanggan Anda kini aktif kembali.',
        kategori: 'Transaksi',
        link: '/riwayat-tagihan',
        isRead: false,
      }).catch(() => {});

      return user;
    },

    // ==================== TAGIHAN BULK MUTATION ====================
    generateTagihanBulanan: async (_, { periode, idMeteranList }, { token }) => {
      verifyAdminToken(token);
      let berhasil = 0;
      let gagal = 0;
      const detailGagal: Array<{ idMeteran: string; nomorMeteran?: string; nomorAkun?: string; namaLengkap?: string; alasan: string }> = [];

      // Bulk-fetch all meterans + kelompok pelanggan upfront to avoid N+1 queries
      const periodeDate = new Date(periode + '-01');
      const periodeEnd = new Date(new Date(periodeDate).setMonth(new Date(periodeDate).getMonth() + 1));

      const [meteranList, existingBillings] = await Promise.all([
        Meteran.find({ _id: { $in: idMeteranList } })
          .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan', select: 'namaLengkap' } })
          .lean(),
        Billing.find({ idMeteran: { $in: idMeteranList }, periode: { $gte: periodeDate, $lt: periodeEnd } }).select('idMeteran').lean(),
      ]);

      const meteranMap = new Map(meteranList.map(m => [m._id.toString(), m]));
      const existingSet = new Set(existingBillings.map(b => b.idMeteran.toString()));

      const kelompokIds = [...new Set(meteranList.map(m => m.idKelompokPelanggan?.toString()).filter(Boolean))];
      const kelompokList = await KelompokPelanggan.find({ _id: { $in: kelompokIds } }).lean();
      const kelompokMap = new Map(kelompokList.map(k => [k._id.toString(), k]));

      for (const idMeteran of idMeteranList) {
        try {
          const meteran = meteranMap.get(idMeteran.toString());
          if (!meteran) {
            gagal++;
            detailGagal.push({ idMeteran: idMeteran.toString(), alasan: 'Meteran tidak ditemukan di database' });
            continue;
          }

          // Cek apakah tagihan periode ini sudah ada (dari pre-fetched set)
          if (existingSet.has(idMeteran.toString())) {
            gagal++;
            const koneksi = meteran.idKoneksiData as any;
            detailGagal.push({
              idMeteran: idMeteran.toString(),
              nomorMeteran: meteran.nomorMeteran,
              nomorAkun: meteran.nomorAkun,
              namaLengkap: koneksi?.idPelanggan?.namaLengkap || '-',
              alasan: `Tagihan periode ${periode} sudah pernah dibuat`,
            });
            continue;
          }

          // Ambil kelompok pelanggan dari pre-fetched map
          const kelompok = kelompokMap.get(meteran.idKelompokPelanggan?.toString());
          // Gunakan pemakaianBelumTerbayar dari meteran (diisi oleh IoT via REST pipeline)
          const pemakaian = meteran.pemakaianBelumTerbayar || 0;
          const penggunaanSebelum = meteran.totalPemakaian - pemakaian;
          const biaya = pemakaian <= 10
            ? pemakaian * (kelompok?.hargaDiBawah10mKubik || 1500)
            : 10 * (kelompok?.hargaDiBawah10mKubik || 1500) + (pemakaian - 10) * (kelompok?.hargaDiAtas10mKubik || 2000);
          const biayaBeban = kelompok?.biayaBeban || 5000;

          const billing = new Billing({
            userId: (meteran.idKoneksiData as any)?.idPelanggan?._id || (meteran.idKoneksiData as any)?.idPelanggan || null,
            idMeteran: meteran._id,
            periode: new Date(periodeDate),
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
        } catch (err: any) {
          const meteran = meteranMap.get(idMeteran.toString());
          const koneksi = meteran ? (meteran.idKoneksiData as any) : null;
          logger.error({ err, idMeteran }, 'Gagal generate tagihan untuk meteran');
          gagal++;
          detailGagal.push({
            idMeteran: idMeteran.toString(),
            nomorMeteran: meteran?.nomorMeteran,
            nomorAkun: meteran?.nomorAkun,
            namaLengkap: koneksi?.idPelanggan?.namaLengkap || '-',
            alasan: err?.message || 'Gagal menyimpan tagihan',
          });
        }
      }
      return {
        berhasil,
        gagal,
        pesan: `Generate selesai: ${berhasil} berhasil, ${gagal} gagal`,
        detailGagal,
      };
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

    // ==================== AUTH MUTATIONS ====================
    logoutAdmin: async (_, __, { token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        const adminId = decoded.id || decoded.userId;
        if (adminId) {
          await AdminAccount.findByIdAndUpdate(adminId, { token: null });
          logger.info({ adminId }, 'Admin logout successful');
        }
      } catch (_) { /* token already invalid */ }
      return true;
    },

    logoutTechnician: async (_, __, { token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        if (decoded.id) {
          await Technician.findByIdAndUpdate(decoded.id, { token: null });
        }
      } catch (_) { /* token already invalid */ }
      return true;
    },

        // ==================== NOTIFIKASI MUTATIONS ====================
    createNotifikasi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!input.idAdmin && !input.idTeknisi && !input.idPelanggan) {
        throw new Error('Minimal satu recipient (idAdmin, idTeknisi, atau idPelanggan) harus diisi');
      }
      const notification = new Notification({ ...input, isRead: false });
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
          diverifikasiOleh: (admin as any).id,
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
