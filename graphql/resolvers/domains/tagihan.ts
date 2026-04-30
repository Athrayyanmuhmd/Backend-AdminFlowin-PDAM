// @ts-nocheck
import Billing from '../../../models/Billing.js';
import Meteran from '../../../models/Meteran.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import User from '../../../models/User.js';
import midtransClient from '../../../middleware/midtrans.js';
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

      // Deteksi user dengan ≥3 tagihan pending — layak pemutusan
      const pendingCounts = await Billing.aggregate([
        { $match: { StatusPembayaran: 'pending', jenisBilling: { $ne: 'denda' }, userId: { $ne: null } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } },
      ]);
      const tunggakanIds = new Set(pendingCounts.map((r: any) => r._id.toString()));

      const allUserIds = [...new Set([...inactiveIds, ...tunggakanIds])];
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

      // Tolak jika periode ini sudah tercatat (double-generate)
      const periodeExist = await Billing.findOne({ IdMeteran, Periode, jenisBilling: { $ne: 'denda' } });
      if (periodeExist) throw new Error(`Tagihan periode ${Periode} untuk meteran ini sudah tercatat`);

      const kelompok = await KelompokPelanggan.findById(meteran.IdKelompokPelanggan);
      const pemakaian = meteran.pemakaianBelumTerbayar || 0;
      const batasRendah = kelompok?.BatasRendah ?? 10;
      const biaya = pemakaian <= batasRendah
        ? pemakaian * (kelompok?.TarifRendah ?? 1500)
        : batasRendah * (kelompok?.TarifRendah ?? 1500) + (pemakaian - batasRendah) * (kelompok?.TarifTinggi ?? 2000);
      const biayaBeban = kelompok?.BiayaBeban ?? 5000;
      const totalBiaya = biaya + biayaBeban;

      const [year, month] = Periode.split('-').map(Number);
      const tenggatWaktu = new Date(year, month, 25);
      const userId = (meteran.IdKoneksiData as any)?.IdPelanggan || null;

      // Helper: buat Snap untuk billing id tertentu
      const buatSnap = async (billingId: any, totalBiayaSnap: number, periodeLabel: string, penggunaId: any) => {
        try {
          const orderId = `BILLING-${billingId}`;
          const pengguna = penggunaId ? await User.findById(penggunaId).select('namaLengkap email noHP').lean() : null;
          const snap = await midtransClient.createTransaction({
            transaction_details: { order_id: orderId, gross_amount: Math.round(totalBiayaSnap) },
            item_details: [{ id: billingId.toString(), price: Math.round(totalBiayaSnap), quantity: 1, name: `Tagihan Air ${periodeLabel}` }],
            customer_details: {
              first_name: (pengguna as any)?.namaLengkap || 'Pelanggan',
              email: (pengguna as any)?.email || '',
              phone: (pengguna as any)?.noHP || '',
            },
          });
          await Billing.findByIdAndUpdate(billingId, { orderId, SnapToken: snap.token, SnapRedirectUrl: snap.redirect_url });
          return snap.redirect_url as string;
        } catch (e: any) {
          console.warn('[generateTagihan] Gagal buat Snap:', e?.message);
          return null;
        }
      };

      // Cek apakah sudah ada billing pending untuk meteran ini
      const pendingBilling = await Billing.findOne({
        IdMeteran,
        StatusPembayaran: 'pending',
        jenisBilling: { $ne: 'denda' },
      });

      if (pendingBilling) {
        // Akumulasi ke billing pending yang ada
        const totalBiayaBaru = (pendingBilling.TotalBiaya ?? 0) + totalBiaya;
        const bulanBaru = (pendingBilling.bulanCakupan ?? 1) + 1;
        await Billing.findByIdAndUpdate(pendingBilling._id, {
          $inc: { TotalPemakaian: pemakaian, Biaya: biaya, BiayaBeban: biayaBeban, TotalBiaya: totalBiaya, bulanCakupan: 1 },
          $set: {
            PenggunaanSekarang: meteran.totalPemakaian || 0,
            TenggatWaktu: tenggatWaktu,
            Menunggak: true,
          },
        });

        // Buat Snap baru dengan nominal akumulasi terbaru
        const periodeLabel = `${pendingBilling.Periode} (${bulanBaru} bulan)`;
        const snapUrl = await buatSnap(pendingBilling._id, totalBiayaBaru, periodeLabel, userId);

        if (userId) {
          await notifikasiUntukPelanggan(
            userId.toString(),
            'Tagihan Air Diperbarui',
            `Tagihan bulan ${Periode} ditambahkan. Total yang harus dibayar: Rp${totalBiayaBaru.toLocaleString('id-ID')}.${snapUrl ? ` Bayar sekarang: ${snapUrl}` : ''}`,
            'PEMBAYARAN',
            '/tagihan',
          );
        }
        return await Billing.findById(pendingBilling._id).populate(TAGIHAN_POPULATE);
      }

      // Tidak ada pending — buat billing baru
      const penggunaanSebelum = Math.max(0, (meteran.totalPemakaian || 0) - pemakaian);
      const billing = new Billing({
        userId,
        IdMeteran: meteran._id,
        Periode,
        PenggunaanSebelum: penggunaanSebelum,
        PenggunaanSekarang: meteran.totalPemakaian || 0,
        TotalPemakaian: pemakaian,
        Biaya: biaya,
        BiayaBeban: biayaBeban,
        TotalBiaya: totalBiaya,
        StatusPembayaran: 'pending',
        TenggatWaktu: tenggatWaktu,
        Menunggak: false,
        Denda: 0,
        bulanCakupan: 1,
      });
      await billing.save();

      // Buat Snap langsung setelah billing tersimpan
      const snapUrl = await buatSnap(billing._id, totalBiaya, Periode, userId);

      if (userId) {
        await notifikasiUntukPelanggan(
          userId.toString(),
          'Tagihan Air Baru',
          `Tagihan air sebesar Rp${totalBiaya.toLocaleString('id-ID')} untuk periode ${Periode}. Total pemakaian: ${pemakaian} m³. Jatuh tempo: ${tenggatWaktu.toLocaleDateString('id-ID')}.${snapUrl ? ` Bayar sekarang: ${snapUrl}` : ''}`,
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

      const meteranList = await Meteran.find({ _id: { $in: IdMeteranList } })
        .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan', select: 'namaLengkap' } })
        .lean();

      const meteranMap = new Map(meteranList.map(m => [m._id.toString(), m]));
      const kelompokIds = [...new Set(meteranList.map(m => (m as any).IdKelompokPelanggan?.toString()).filter(Boolean))];
      const kelompokList = await KelompokPelanggan.find({ _id: { $in: kelompokIds } }).lean();
      const kelompokMap = new Map(kelompokList.map(k => [(k._id as any).toString(), k]));

      // Cek periode sudah ada (double-generate guard)
      const periodeExisting = await Billing.find({ IdMeteran: { $in: IdMeteranList }, Periode, jenisBilling: { $ne: 'denda' } }).select('IdMeteran').lean();
      const periodeExistSet = new Set(periodeExisting.map(b => b.IdMeteran.toString()));

      // Ambil semua pending billing yang ada untuk meteran-meteran ini sekaligus
      const pendingBillings = await Billing.find({
        IdMeteran: { $in: IdMeteranList },
        StatusPembayaran: 'pending',
        jenisBilling: { $ne: 'denda' },
      }).select('_id IdMeteran TotalBiaya bulanCakupan').lean();
      const pendingMap = new Map(pendingBillings.map(b => [b.IdMeteran.toString(), b]));

      for (const idMeteran of IdMeteranList) {
        try {
          const meteran = meteranMap.get(idMeteran.toString()) as any;
          if (!meteran) {
            gagal++;
            detailGagal.push({ IdMeteran: idMeteran.toString(), alasan: 'Meteran tidak ditemukan' });
            continue;
          }
          if (periodeExistSet.has(idMeteran.toString())) {
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
          const batasRendah = kelompok?.BatasRendah ?? 10;
          const biaya = pemakaian <= batasRendah
            ? pemakaian * (kelompok?.TarifRendah ?? 1500)
            : batasRendah * (kelompok?.TarifRendah ?? 1500) + (pemakaian - batasRendah) * (kelompok?.TarifTinggi ?? 2000);
          const biayaBeban = kelompok?.BiayaBeban ?? 5000;
          const totalBiaya = biaya + biayaBeban;
          const userId = meteran.IdKoneksiData?.IdPelanggan?._id || meteran.IdKoneksiData?.IdPelanggan || null;

          const pendingBilling = pendingMap.get(idMeteran.toString()) as any;

          if (pendingBilling) {
            // Akumulasi ke billing pending yang ada
            await Billing.findByIdAndUpdate(pendingBilling._id, {
              $inc: { TotalPemakaian: pemakaian, Biaya: biaya, BiayaBeban: biayaBeban, TotalBiaya: totalBiaya, bulanCakupan: 1 },
              $set: {
                PenggunaanSekarang: meteran.totalPemakaian || 0,
                TenggatWaktu: tenggatWaktu,
                Menunggak: true,
                SnapToken: null,
                SnapRedirectUrl: null,
              },
            });
          } else {
            // Buat billing baru
            const penggunaanSebelum = Math.max(0, (meteran.totalPemakaian || 0) - pemakaian);
            await new Billing({
              userId,
              IdMeteran: meteran._id,
              Periode,
              PenggunaanSebelum: penggunaanSebelum,
              PenggunaanSekarang: meteran.totalPemakaian || 0,
              TotalPemakaian: pemakaian,
              Biaya: biaya,
              BiayaBeban: biayaBeban,
              TotalBiaya: totalBiaya,
              StatusPembayaran: 'pending',
              TenggatWaktu: tenggatWaktu,
              Menunggak: false,
              Denda: 0,
              bulanCakupan: 1,
            }).save();
          }
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

      // Jika admin manual set settlement dan sebelumnya BUKAN settlement,
      // decrement pemakaianBelumTerbayar pada meteran.
      // Guard "bukan settlement sebelumnya" mencegah double-decrement kalau webhook
      // Midtrans sudah jalan lebih dulu (misal: admin update terlambat).
      if (status === 'settlement' && tagihan.StatusPembayaran !== 'settlement') {
        updateData.TanggalPembayaran = new Date();
        updateData.MetodePembayaran = 'manual_admin';
        // Tandai sebagai sudah diproses agar billingCron tidak double-decrement
        updateData.Catatan = '[pemakaian_applied]';
        const pemakaian = tagihan.TotalPemakaian ?? 0;
        if (pemakaian > 0) {
          const meteran = await Meteran.findById(tagihan.IdMeteran);
          if (meteran) {
            const current = meteran.pemakaianBelumTerbayar ?? 0;
            await Meteran.findByIdAndUpdate(tagihan.IdMeteran, {
              pemakaianBelumTerbayar: Math.max(0, current - pemakaian),
            });
          }
        }
      }

      return await Billing.findByIdAndUpdate(id, updateData, { new: true }).populate(TAGIHAN_POPULATE);
    },

    buatSnapTagihan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const tagihan = await Billing.findById(id).populate(TAGIHAN_POPULATE);
      if (!tagihan) throw new Error('Tagihan tidak ditemukan');
      if (tagihan.StatusPembayaran === 'settlement') throw new Error('Tagihan sudah lunas');

      const orderId = tagihan.orderId || `BILLING-${tagihan._id}`;
      const userId = tagihan.userId;
      const pengguna = userId ? await User.findById(userId).select('namaLengkap email noHP').lean() : null;
      const bulanLabel = tagihan.bulanCakupan && tagihan.bulanCakupan > 1
        ? `${tagihan.Periode} (${tagihan.bulanCakupan} bulan)`
        : tagihan.Periode;

      const snapParam = {
        transaction_details: {
          order_id: orderId,
          gross_amount: Math.round(tagihan.TotalBiaya ?? 0),
        },
        item_details: [{
          id: tagihan._id.toString(),
          price: Math.round(tagihan.TotalBiaya ?? 0),
          quantity: 1,
          name: `Tagihan Air ${bulanLabel}`,
        }],
        customer_details: {
          first_name: (pengguna as any)?.namaLengkap || 'Pelanggan',
          email: (pengguna as any)?.email || '',
          phone: (pengguna as any)?.noHP || '',
        },
      };

      const snapTransaction = await midtransClient.createTransaction(snapParam);

      return await Billing.findByIdAndUpdate(
        id,
        {
          orderId,
          SnapToken: snapTransaction.token,
          SnapRedirectUrl: snapTransaction.redirect_url,
        },
        { new: true }
      ).populate(TAGIHAN_POPULATE);
    },
  },
};
