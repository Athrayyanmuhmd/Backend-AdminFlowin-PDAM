import AdminAccount from '../../models/AdminAccount.js';
import User from '../../models/User.js';
import Technician from '../../models/Technician.js';
import KelompokPelanggan from '../../models/KelompokPelanggan.js';
import Meteran from '../../models/Meteran.js';
import ConnectionData from '../../models/ConnectionData.js';
import Billing from '../../models/Billing.js';
import HistoryUsage from '../../models/HistoryUsage.js';
import Report from '../../models/Report.js';
import WorkOrder from '../../models/WorkOrder.js';
import RabConnection from '../../models/RabConnection.js';
import SurveyData from '../../models/SurveyData.js';
import Notification from '../../models/Notification.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getCache, setCache } from '../../utils/redis.js';

export const resolvers = {
  Query: {
    // ==================== ADMIN QUERIES ====================
    getAdmin: async (_, { id }) => {
      return await AdminAccount.findById(id);
    },

    getAllAdmins: async () => {
      return await AdminAccount.find();
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
      return await KelompokPelanggan.findById(id);
    },

    getAllKelompokPelanggan: async () => {
      return await KelompokPelanggan.find();
    },

    // ==================== METERAN QUERIES ====================
    getMeteran: async (_, { id }) => {
      return await Meteran.findById(id)
        .populate('kelompokPelangganId')
        .populate('connectionDataId')
        .populate('userId');
    },

    getAllMeteran: async () => {
      return await Meteran.find()
        .populate('kelompokPelangganId')
        .populate('connectionDataId')
        .populate('userId');
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
      return await ConnectionData.findById(id).populate('userId');
    },

    getAllKoneksiData: async () => {
      return await ConnectionData.find().populate('userId');
    },

    getPendingKoneksiData: async () => {
      return await ConnectionData.find({ statusVerifikasi: false }).populate('userId');
    },

    getVerifiedKoneksiData: async () => {
      return await ConnectionData.find({ statusVerifikasi: true }).populate('userId');
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
      return await WorkOrder.findById(id)
        .populate('idSurvei')
        .populate('rabId')
        .populate('tim');
    },

    getAllWorkOrders: async () => {
      return await WorkOrder.find()
        .populate('idSurvei')
        .populate('rabId')
        .populate('tim');
    },

    getWorkOrdersByStatus: async (_, { status }) => {
      return await WorkOrder.find({ status })
        .populate('idSurvei')
        .populate('rabId')
        .populate('tim');
    },

    getWorkOrdersByTeknisi: async (_, { idTeknisi }) => {
      return await WorkOrder.find({ tim: idTeknisi })
        .populate('idSurvei')
        .populate('rabId')
        .populate('tim');
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
      return await Notification.find({ idAdmin });
    },

    getUnreadNotifikasi: async (_, { idAdmin }) => {
      return await Notification.find({ idAdmin, isRead: false });
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
        WorkOrder.countDocuments({ status: { $in: ['Ditugaskan', 'SedangDikerjakan'] } }),
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
            localField: 'kelompokPelangganId',
            foreignField: '_id',
            as: 'kelompok'
          }
        },
        {
          $unwind: { path: '$kelompok', preserveNullAndEmpty: false }
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
      return hasil.map(item => ({
        bulan: `${namaBulan[item._id.bulan - 1]} ${item._id.tahun}`,
        totalTagihan: item.totalTagihan,
        totalLunas: item.totalLunas,
        jumlahTagihan: item.jumlahTagihan,
        jumlahLunas: item.jumlahLunas,
      }));
    },

    getTunggakanPerKelompok: async () => {
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
        { $unwind: { path: '$meteran', preserveNullAndEmpty: false } },
        {
          $lookup: {
            from: 'kelompokpelanggans',
            localField: 'meteran.kelompokPelangganId',
            foreignField: '_id',
            as: 'kelompok'
          }
        },
        { $unwind: { path: '$kelompok', preserveNullAndEmpty: true } },
        {
          $group: {
            _id: { $ifNull: ['$kelompok.namaKelompok', 'Tidak Diketahui'] },
            totalTunggakan: { $sum: '$totalBiaya' },
            jumlahTunggakan: { $count: {} },
          }
        },
        { $sort: { totalTunggakan: -1 } }
      ]);

      return hasil.map(item => ({
        namaKelompok: item._id,
        totalTunggakan: item.totalTunggakan,
        jumlahTunggakan: item.jumlahTunggakan,
      }));
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
        { $unwind: { path: '$meteran', preserveNullAndEmpty: false } },
        {
          $lookup: {
            from: 'kelompokpelanggans',
            localField: 'meteran.kelompokPelangganId',
            foreignField: '_id',
            as: 'kelompok'
          }
        },
        { $unwind: { path: '$kelompok', preserveNullAndEmpty: true } },
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
      return {
        totalTagihan: hasil[0].totalTagihan,
        totalLunas: hasil[0].totalLunas,
        totalTunggakan: hasil[0].totalTunggakan,
        totalPending: hasil[0].totalPending,
        nilaiTotal: hasil[0].nilaiTotal,
        nilaiLunas: hasil[0].nilaiLunas,
        nilaiTunggakan: hasil[0].nilaiTunggakan,
      };
    },

    // ==================== LAPORAN OPERASIONAL QUERIES ====================
    getKpiOperasional: async () => {
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
        WorkOrder.countDocuments({ status: { $in: ['Ditugaskan', 'SedangDikerjakan'] } }),
        WorkOrder.countDocuments({ status: 'Selesai' }),
        Technician.countDocuments(),
      ]);

      const tingkatPenyelesaianLaporan = totalLaporanMasuk > 0
        ? parseFloat(((totalLaporanSelesai / totalLaporanMasuk) * 100).toFixed(1))
        : 0;

      return {
        totalMeteranTerpasang,
        totalPelanggan,
        totalLaporanMasuk,
        totalLaporanSelesai,
        totalWorkOrderAktif,
        totalWorkOrderSelesai,
        totalTeknisi,
        tingkatPenyelesaianLaporan,
      };
    },

    getRingkasanWorkOrder: async () => {
      const hasil = await WorkOrder.aggregate([
        { $group: { _id: '$status', jumlah: { $count: {} } } },
        { $sort: { jumlah: -1 } }
      ]);
      return hasil.map(item => ({ status: item._id || 'Tidak Diketahui', jumlah: item.jumlah }));
    },

    getRingkasanLaporan: async () => {
      const hasil = await Report.aggregate([
        { $group: { _id: '$status', jumlah: { $count: {} } } },
        { $sort: { jumlah: -1 } }
      ]);
      return hasil.map(item => ({ status: item._id || 'Tidak Diketahui', jumlah: item.jumlah }));
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
    createAdmin: async (_, { input }) => {
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const admin = new AdminAccount({
        ...input,
        password: hashedPassword
      });
      return await admin.save();
    },

    updateAdmin: async (_, { id, input }) => {
      if (input.password) {
        input.password = await bcrypt.hash(input.password, 10);
      }
      return await AdminAccount.findByIdAndUpdate(id, input, { new: true });
    },

    deleteAdmin: async (_, { id }) => {
      await AdminAccount.findByIdAndDelete(id);
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
      return await kelompok.save();
    },

    updateKelompokPelanggan: async (_, { id, input }) => {
      return await KelompokPelanggan.findByIdAndUpdate(id, input, { new: true });
    },

    deleteKelompokPelanggan: async (_, { id }) => {
      await KelompokPelanggan.findByIdAndDelete(id);
      return { success: true, message: 'Kelompok Pelanggan deleted successfully' };
    },

    // ==================== CONNECTION DATA MUTATIONS ====================
    verifyKoneksiData: async (_, { id, verified, catatan }) => {
      return await ConnectionData.findByIdAndUpdate(
        id,
        { statusVerifikasi: verified, catatan },
        { new: true }
      ).populate('idPelanggan');
    },

    updateKoneksiData: async (_, { id, input }) => {
      return await ConnectionData.findByIdAndUpdate(id, input, { new: true }).populate('idPelanggan');
    },

    // ==================== WORK ORDER MUTATIONS ====================
    createWorkOrder: async (_, { input }) => {
      const workOrder = new WorkOrder({
        ...input,
        status: 'Ditugaskan',
        disetujui: null
      });
      return await (await workOrder.save()).populate('tim');
    },

    assignWorkOrder: async (_, { id, teknisiIds }) => {
      return await WorkOrder.findByIdAndUpdate(
        id,
        { tim: teknisiIds },
        { new: true }
      ).populate('tim');
    },

    updateWorkOrderStatus: async (_, { id, status, catatan }) => {
      return await WorkOrder.findByIdAndUpdate(
        id,
        { status, catatan },
        { new: true }
      ).populate('tim');
    },

    approveWorkOrder: async (_, { id, disetujui, catatan }) => {
      return await WorkOrder.findByIdAndUpdate(
        id,
        { disetujui, catatan },
        { new: true }
      ).populate('tim');
    },

    // ==================== LAPORAN MUTATIONS ====================
    updateLaporanStatus: async (_, { id, status }) => {
      return await Report.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).populate('idPengguna');
    },

    // ==================== NOTIFIKASI MUTATIONS ====================
    createNotifikasi: async (_, { input }) => {
      const notification = new Notification({
        ...input,
        isRead: false
      });
      return await notification.save();
    },

    markNotifikasiAsRead: async (_, { id }) => {
      return await Notification.findByIdAndUpdate(
        id,
        { isRead: true },
        { new: true }
      );
    }
  },

  // ==================== FIELD RESOLVERS (for schema/model field name mismatches) ====================
  Meteran: {
    idKelompokPelanggan: async (parent) => {
      if (parent.kelompokPelangganId) {
        // If already populated, return it
        if (typeof parent.kelompokPelangganId === 'object' && parent.kelompokPelangganId._id) {
          return parent.kelompokPelangganId;
        }
        // Otherwise fetch it
        return await KelompokPelanggan.findById(parent.kelompokPelangganId);
      }
      return null;
    },
    idKoneksiData: async (parent) => {
      console.log('🔍 idKoneksiData resolver called, parent.connectionDataId:', parent.connectionDataId);
      if (parent.connectionDataId) {
        if (typeof parent.connectionDataId === 'object' && parent.connectionDataId._id) {
          console.log('✅ Already populated');
          return parent.connectionDataId;
        }
        console.log('🔄 Fetching from DB');
        const result = await ConnectionData.findById(parent.connectionDataId).populate('userId');
        console.log('📦 Result:', result ? 'Found' : 'Not found');
        return result;
      }
      console.log('❌ No connectionDataId');
      return null;
    }
  },

  KoneksiData: {
    idPelanggan: async (parent) => {
      if (!parent.userId) {
        return null;
      }

      let user;
      // If already populated
      if (typeof parent.userId === 'object' && parent.userId._id) {
        user = parent.userId;
      } else {
        // Otherwise fetch it
        user = await User.findById(parent.userId);
      }

      if (!user) return null;

      // Return plain object with explicit fields
      const result = {
        _id: user._id,
        email: user.email,
        noHP: user.noHP,
        namaLengkap: user.namaLengkap,
        nik: user.nik,
        address: user.address,
        gender: user.gender,
        birthDate: user.birthDate,
        occupation: user.occupation,
        customerType: user.customerType,
        accountStatus: user.accountStatus,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      console.log('🎯 Returning user:', JSON.stringify({ _id: result._id, namaLengkap: result.namaLengkap, email: result.email }));
      return result;
    }
  }
};
