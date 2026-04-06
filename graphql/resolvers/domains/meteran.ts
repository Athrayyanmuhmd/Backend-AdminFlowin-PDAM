// @ts-nocheck
import Meteran from '../../../models/Meteran.js';
import Billing from '../../../models/Billing.js';
import ConnectionData from '../../../models/ConnectionData.js';
import HistoryUsage from '../../../models/HistoryUsage.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import { verifyAdminToken, catatAuditLog } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export const meteranResolvers = {
  Query: {
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
      const connections = await ConnectionData.find({ $or: [{ idPelanggan }, { userId: idPelanggan }] }).lean();
      const connectionIds = connections.map(c => c._id);

      if (connectionIds.length > 0) {
        return await Meteran.find({ idKoneksiData: { $in: connectionIds } })
          .populate('idKelompokPelanggan')
          .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan', select: 'namaLengkap email noHP' } });
      }

      const { Types } = await import('mongoose');
      let oid: any;
      try { oid = new Types.ObjectId(idPelanggan); } catch { return []; }

      const matched = await Meteran.aggregate([
        { $lookup: { from: 'koneksidatas', localField: 'idKoneksiData', foreignField: '_id', as: '_kd' } },
        { $match: { $or: [{ '_kd.idPelanggan': oid }, { '_kd.userId': oid }] } },
      ]);
      if (!matched.length) return [];
      return await Meteran.find({ _id: { $in: matched.map(m => m._id) } })
        .populate('idKelompokPelanggan')
        .populate({ path: 'idKoneksiData', populate: { path: 'idPelanggan', select: 'namaLengkap email noHP' } });
    },

    getRiwayatPenggunaan: async (_, { meteranId, limit = 50 }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await HistoryUsage.find({ meteranId }).sort({ createdAt: -1 }).limit(limit);
    },

    getRiwayatPenggunaanBulanan: async (_, { meteranId }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const mongoose = await import('mongoose');
      const hasil = await HistoryUsage.aggregate([
        { $match: { meteranId: new mongoose.default.Types.ObjectId(meteranId) } },
        { $group: { _id: { tahun: { $year: '$createdAt' }, bulan: { $month: '$createdAt' } }, totalPemakaian: { $sum: '$penggunaanAir' }, jumlahRecord: { $count: {} } } },
        { $sort: { '_id.tahun': 1, '_id.bulan': 1 } },
        { $limit: 12 },
      ]);
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
      return { pemakaianBelumTerbayar: pemakaian, estimasiBiaya: biaya, biayaBeban, totalEstimasi: biaya + biayaBeban, namaKelompok: kelompok?.namaKelompok || null };
    },
  },

  Mutation: {
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
  },
};
