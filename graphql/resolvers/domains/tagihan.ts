// @ts-nocheck
import Billing from '../../../models/Billing.js';
import Meteran from '../../../models/Meteran.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import User from '../../../models/User.js';
import { verifyAdminToken, notifikasiUntukPelanggan } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

const DENDA_RINGAN = 150_000;
const DENDA_BERAT = 1_500_000;

// Populate path — disesuaikan dengan field names baru (PascalCase)
const TAGIHAN_POPULATE = {
  path: 'IdMeteran',
  populate: {
    path: 'IdKoneksiData',
    populate: { path: 'IdPelanggan' },
  },
};

const formatPeriode = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const tagihanResolvers = {
  Query: {
    getTagihan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.findById(id).populate(TAGIHAN_POPULATE);
    },

    getAllTagihan: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 1000))
        .populate(TAGIHAN_POPULATE)
        .lean();
    },

    getTagihanByMeteran: async (_, { IdMeteran }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find({ IdMeteran }).populate(TAGIHAN_POPULATE);
    },

    getTagihanByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find({ StatusPembayaran: status }).populate(TAGIHAN_POPULATE);
    },

    getTunggakan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.find({ Menunggak: true }).populate(TAGIHAN_POPULATE);
    },

    getDaftarPemutusan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const inactiveUsers = await User.find({ accountStatus: 'inactive' }, '_id').lean();
      const inactiveIds = new Set(inactiveUsers.map((u: any) => u._id.toString()));
      const mergedBillings = await Billing.find({ isMergedBilling: true, StatusPembayaran: 'pending' }, 'userId').lean();
      const mergedIds = new Set(mergedBillings.map((b: any) => b.userId?.toString()).filter(Boolean));
      const allUserIds = [...new Set([...inactiveIds, ...mergedIds])];
      if (allUserIds.length === 0) return [];

      const result = [];
      for (const uid of allUserIds) {
        const user = await User.findById(uid).lean();
        if (!user) continue;
        const tagihanTunggakan = await Billing.find({ userId: uid, StatusPembayaran: 'pending' }).sort({ Periode: 1 }).lean();
        const jumlahBulanTunggak = tagihanTunggakan.reduce((sum: number, b: any) => sum + (b.bulanCakupan ?? 1), 0);
        const totalTunggakan = tagihanTunggakan.reduce((sum: number, b: any) => sum + (b.TotalBiaya ?? 0), 0);
        const denda = jumlahBulanTunggak >= 3 ? DENDA_BERAT : DENDA_RINGAN;
        result.push({ user, tagihanTunggakan, jumlahBulanTunggak, totalTunggakan, denda, sudahDiputus: inactiveIds.has(uid) });
      }
      return result;
    },
  },

  Mutation: {
    generateTagihan: async (_, { IdMeteran, Periode }, { token }) => {
      verifyAdminToken(token);
      const meteran = await Meteran.findById(IdMeteran).populate('IdKoneksiData');
      if (!meteran) throw new Error('Meteran tidak ditemukan');

      const existing = await Billing.findOne({ IdMeteran, Periode });
      if (existing) throw new Error(`Tagihan untuk meteran ini pada periode ${Periode} sudah ada`);

      const kelompok = await KelompokPelanggan.findById(meteran.IdKelompokPelanggan);
      const pemakaian = meteran.pemakaianBelumTerbayar || 0;
      const penggunaanSebelum = Math.max(0, (meteran.totalPemakaian || 0) - pemakaian);
      const batasRendah = kelompok?.BatasRendah ?? 10;
      const biaya = pemakaian <= batasRendah
        ? pemakaian * (kelompok?.TarifRendah ?? 1500)
        : batasRendah * (kelompok?.TarifRendah ?? 1500) + (pemakaian - batasRendah) * (kelompok?.TarifTinggi ?? 2000);
      const biayaBeban = kelompok?.BiayaBeban ?? 5000;

      // TenggatWaktu = akhir bulan berikutnya tanggal 25
      const [year, month] = Periode.split('-').map(Number);
      const tenggatWaktu = new Date(year, month, 25); // bulan berikutnya tgl 25

      const billing = new Billing({
        userId: (meteran.IdKoneksiData as any)?.IdPelanggan || null,
        IdMeteran: meteran._id,
        Periode,
        PenggunaanSebelum: penggunaanSebelum,
        PenggunaanSekarang: meteran.totalPemakaian || 0,
        TotalPemakaian: pemakaian,
        Biaya: biaya,
        BiayaBeban: biayaBeban,
        TotalBiaya: biaya + biayaBeban,
        StatusPembayaran: 'pending',
        TenggatWaktu: tenggatWaktu,
        Menunggak: false,
        Denda: 0,
      });
      await billing.save();

      // Kirim notifikasi ke pelanggan — dibaca Ahmad via { IdPelanggan: userId }
      if (userId) {
        await notifikasiUntukPelanggan(
          userId.toString(),
          'Tagihan Air Baru',
          `Tagihan air sebesar Rp${(biaya + biayaBeban).toLocaleString('id-ID')} untuk periode ${Periode}. Total pemakaian: ${pemakaian} m³. Jatuh tempo: ${tenggatWaktu.toLocaleDateString('id-ID')}.`,
          'PEMBAYARAN',
          '/tagihan',
        );
      }

      return await Billing.findById(billing._id).populate(TAGIHAN_POPULATE);
    },

    generateTagihanBulanan: async (_, { Periode, IdMeteranList }, { token }) => {
      verifyAdminToken(token);
      let berhasil = 0;
      let gagal = 0;
      const detailGagal: any[] = [];

      const [year, month] = Periode.split('-').map(Number);
      const tenggatWaktu = new Date(year, month, 25);

      const [meteranList, existingBillings] = await Promise.all([
        Meteran.find({ _id: { $in: IdMeteranList } })
          .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan', select: 'namaLengkap' } })
          .lean(),
        Billing.find({ IdMeteran: { $in: IdMeteranList }, Periode }).select('IdMeteran').lean(),
      ]);

      const meteranMap = new Map(meteranList.map(m => [m._id.toString(), m]));
      const existingSet = new Set(existingBillings.map(b => b.IdMeteran.toString()));
      const kelompokIds = [...new Set(meteranList.map(m => (m as any).IdKelompokPelanggan?.toString()).filter(Boolean))];
      const kelompokList = await KelompokPelanggan.find({ _id: { $in: kelompokIds } }).lean();
      const kelompokMap = new Map(kelompokList.map(k => [(k._id as any).toString(), k]));

      for (const idMeteran of IdMeteranList) {
        try {
          const meteran = meteranMap.get(idMeteran.toString()) as any;
          if (!meteran) {
            gagal++;
            detailGagal.push({ IdMeteran: idMeteran.toString(), alasan: 'Meteran tidak ditemukan' });
            continue;
          }
          if (existingSet.has(idMeteran.toString())) {
            gagal++;
            detailGagal.push({
              IdMeteran: idMeteran.toString(),
              NomorMeteran: meteran.NomorMeteran,
              NomorAkun: meteran.NomorAkun,
              namaLengkap: meteran.IdKoneksiData?.IdPelanggan?.namaLengkap || '-',
              alasan: `Tagihan periode ${Periode} sudah ada`,
            });
            continue;
          }

          const kelompok = kelompokMap.get(meteran.IdKelompokPelanggan?.toString()) as any;
          const pemakaian = meteran.pemakaianBelumTerbayar || 0;
          const penggunaanSebelum = Math.max(0, (meteran.totalPemakaian || 0) - pemakaian);
          const batasRendah = kelompok?.BatasRendah ?? 10;
          const biaya = pemakaian <= batasRendah
            ? pemakaian * (kelompok?.TarifRendah ?? 1500)
            : batasRendah * (kelompok?.TarifRendah ?? 1500) + (pemakaian - batasRendah) * (kelompok?.TarifTinggi ?? 2000);
          const biayaBeban = kelompok?.BiayaBeban ?? 5000;

          await new Billing({
            userId: meteran.IdKoneksiData?.IdPelanggan?._id || meteran.IdKoneksiData?.IdPelanggan || null,
            IdMeteran: meteran._id,
            Periode,
            PenggunaanSebelum: penggunaanSebelum,
            PenggunaanSekarang: meteran.totalPemakaian || 0,
            TotalPemakaian: pemakaian,
            Biaya: biaya,
            BiayaBeban: biayaBeban,
            TotalBiaya: biaya + biayaBeban,
            StatusPembayaran: 'pending',
            TenggatWaktu: tenggatWaktu,
            Menunggak: false,
            Denda: 0,
          }).save();
          berhasil++;
        } catch (err: any) {
          const meteran = meteranMap.get(idMeteran.toString()) as any;
          gagal++;
          detailGagal.push({
            IdMeteran: idMeteran.toString(),
            NomorMeteran: meteran?.NomorMeteran,
            NomorAkun: meteran?.NomorAkun,
            namaLengkap: meteran?.IdKoneksiData?.IdPelanggan?.namaLengkap || '-',
            alasan: err?.message || 'Gagal menyimpan tagihan',
          });
        }
      }
      return { berhasil, gagal, pesan: `Generate selesai: ${berhasil} berhasil, ${gagal} gagal`, detailGagal };
    },

    updateStatusPembayaran: async (_, { id, status }, { token }) => {
      verifyAdminToken(token);
      const tagihan = await Billing.findById(id);
      if (!tagihan) throw new Error('Tagihan tidak ditemukan');
      const updateData: Record<string, any> = { StatusPembayaran: status };
      if (status === 'settlement') updateData.TanggalPembayaran = new Date();
      return await Billing.findByIdAndUpdate(id, updateData, { new: true }).populate(TAGIHAN_POPULATE);
    },
  },
};
