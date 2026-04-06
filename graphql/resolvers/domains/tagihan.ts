// @ts-nocheck
import Billing from '../../../models/Billing.js';
import Meteran from '../../../models/Meteran.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import User from '../../../models/User.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

const DENDA_RINGAN = 150_000;
const DENDA_BERAT = 1_500_000;

export const tagihanResolvers = {
  Query: {
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
      const inactiveUsers = await User.find({ accountStatus: 'inactive' }, '_id').lean();
      const inactiveIds = new Set(inactiveUsers.map((u: any) => u._id.toString()));
      const mergedBillings = await Billing.find({ isMergedBilling: true, statusPembayaran: 'Pending' }, 'userId').lean();
      const mergedIds = new Set(mergedBillings.map((b: any) => b.userId.toString()));
      const allUserIds = [...new Set([...inactiveIds, ...mergedIds])];
      if (allUserIds.length === 0) return [];

      const result = [];
      for (const uid of allUserIds) {
        const user = await User.findById(uid).lean();
        if (!user) continue;
        const tagihanTunggakan = await Billing.find({ userId: uid, statusPembayaran: 'Pending' }).sort({ periode: 1 }).lean();
        const jumlahBulanTunggak = tagihanTunggakan.reduce((sum: number, b: any) => sum + (b.bulanCakupan ?? 1), 0);
        const totalTunggakan = tagihanTunggakan.reduce((sum: number, b: any) => sum + (b.totalBiaya ?? 0), 0);
        const denda = jumlahBulanTunggak >= 3 ? DENDA_BERAT : DENDA_RINGAN;
        result.push({ user, tagihanTunggakan, jumlahBulanTunggak, totalTunggakan, denda, sudahDiputus: inactiveIds.has(uid) });
      }
      return result;
    },
  },

  Mutation: {
    generateTagihan: async (_, { idMeteran, periode }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(idMeteran).populate('idKoneksiData');
      if (!meteran) throw new Error('Meteran tidak ditemukan');

      const periodeDate = new Date(periode + '-01');
      const nextMonth = new Date(periodeDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const existing = await Billing.findOne({ idMeteran, periode: { $gte: periodeDate, $lt: nextMonth } });
      if (existing) throw new Error(`Tagihan untuk meteran ini pada periode ${periode} sudah ada`);

      const kelompok = await KelompokPelanggan.findById(meteran.idKelompokPelanggan);
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
      return await Billing.findById(billing._id).populate({ path: 'idMeteran', populate: [{ path: 'idKelompokPelanggan' }, { path: 'idKoneksiData' }] });
    },

    generateTagihanBulanan: async (_, { periode, idMeteranList }, { token }) => {
      verifyAdminToken(token);
      let berhasil = 0;
      let gagal = 0;
      const detailGagal: any[] = [];

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
          if (!meteran) { gagal++; detailGagal.push({ idMeteran: idMeteran.toString(), alasan: 'Meteran tidak ditemukan di database' }); continue; }
          if (existingSet.has(idMeteran.toString())) {
            gagal++;
            const koneksi = meteran.idKoneksiData as any;
            detailGagal.push({ idMeteran: idMeteran.toString(), nomorMeteran: meteran.nomorMeteran, nomorAkun: meteran.nomorAkun, namaLengkap: koneksi?.idPelanggan?.namaLengkap || '-', alasan: `Tagihan periode ${periode} sudah pernah dibuat` });
            continue;
          }

          const kelompok = kelompokMap.get(meteran.idKelompokPelanggan?.toString());
          const pemakaian = meteran.pemakaianBelumTerbayar || 0;
          const penggunaanSebelum = meteran.totalPemakaian - pemakaian;
          const biaya = pemakaian <= 10
            ? pemakaian * (kelompok?.hargaDiBawah10mKubik || 1500)
            : 10 * (kelompok?.hargaDiBawah10mKubik || 1500) + (pemakaian - 10) * (kelompok?.hargaDiAtas10mKubik || 2000);
          const biayaBeban = kelompok?.biayaBeban || 5000;

          await new Billing({
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
          }).save();
          berhasil++;
        } catch (err: any) {
          const meteran = meteranMap.get(idMeteran.toString());
          const koneksi = meteran ? (meteran.idKoneksiData as any) : null;
          gagal++;
          detailGagal.push({ idMeteran: idMeteran.toString(), nomorMeteran: meteran?.nomorMeteran, nomorAkun: meteran?.nomorAkun, namaLengkap: koneksi?.idPelanggan?.namaLengkap || '-', alasan: err?.message || 'Gagal menyimpan tagihan' });
        }
      }
      return { berhasil, gagal, pesan: `Generate selesai: ${berhasil} berhasil, ${gagal} gagal`, detailGagal };
    },

    updateStatusPembayaran: async (_, { id, status }, { token }) => {
      verifyAdminToken(token);
      const tagihan = await Billing.findById(id);
      if (!tagihan) throw new Error('Tagihan tidak ditemukan');
      const updateData: Record<string, any> = { statusPembayaran: status };
      if (status === 'Settlement') updateData.tanggalPembayaran = new Date().toISOString();
      return await Billing.findByIdAndUpdate(id, updateData, { new: true }).populate('idMeteran');
    },
  },
};
