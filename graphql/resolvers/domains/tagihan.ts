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

// Hitung PeriodeAkhir dari Periode awal + bulanCakupan
// Contoh: Periode="2026-02", bulanCakupan=3 → "2026-04"
function computePeriodeAkhir(periode: string, bulanCakupan: number): string {
  const [year, month] = periode.split('-').map(Number);
  const endIdx = year * 12 + (month - 1) + bulanCakupan - 1;
  const endYear = Math.floor(endIdx / 12);
  const endMonth = (endIdx % 12) + 1;
  return `${endYear}-${String(endMonth).padStart(2, '0')}`;
}

export const tagihanResolvers = {
  Query: {
    getTagihan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Billing.findById(id).populate(TAGIHAN_POPULATE);
    },

    getAllTagihan: async (_, { limit = 100, offset = 0, status, filterPeriode } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const filter: Record<string, any> = {};
      if (status) filter.StatusPembayaran = status;

      if (filterPeriode && filterPeriode !== 'semua') {
        const now = new Date();
        if (filterPeriode === 'bulan_ini') {
          filter.TenggatWaktu = {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt:  new Date(now.getFullYear(), now.getMonth() + 1, 1),
          };
        } else if (filterPeriode === 'bulan_lalu') {
          filter.TenggatWaktu = {
            $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            $lt:  new Date(now.getFullYear(), now.getMonth(), 1),
          };
        } else {
          // Treat as exact Periode string, e.g. "2026-04"
          filter.Periode = filterPeriode;
        }
      }

      return await Billing.find(filter)
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

      // Deteksi billing pending dengan bulanCakupan ≥3 — 1 record = beberapa bulan akumulasi
      const eligibleBillings = await Billing.find({
        StatusPembayaran: 'pending',
        jenisBilling: { $ne: 'denda' },
        userId: { $ne: null },
        bulanCakupan: { $gte: 3 },
      }).select('userId').lean();
      const tunggakanIds = new Set(eligibleBillings.map((b: any) => b.userId.toString()));

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

      // Guard 1: periode exact match (settlement/existing normal record)
      const periodeExact = await Billing.findOne({
        IdMeteran, Periode, StatusPembayaran: { $ne: 'merged' }, jenisBilling: { $ne: 'denda' },
      });
      if (periodeExact) throw new Error(`Tagihan periode ${Periode} untuk meteran ini sudah tercatat`);

      // Guard 2: periode sudah tercakup dalam range billing pending yang terakumulasi
      const pendingCheck = await Billing.findOne({
        IdMeteran, StatusPembayaran: 'pending', jenisBilling: { $ne: 'denda' },
      }).select('Periode bulanCakupan PeriodeAkhir').lean() as any;
      if (pendingCheck) {
        const periodeAkhirCheck = pendingCheck.PeriodeAkhir ?? computePeriodeAkhir(pendingCheck.Periode, pendingCheck.bulanCakupan ?? 1);
        if (Periode >= pendingCheck.Periode && Periode <= periodeAkhirCheck) {
          throw new Error(`Periode ${Periode} sudah tercakup dalam tagihan aktif (${pendingCheck.Periode} – ${periodeAkhirCheck})`);
        }
      }

      const kelompok = await KelompokPelanggan.findById(meteran.IdKelompokPelanggan);
      const pemakaian = meteran.pemakaianBelumTerbayar || 0;
      const batasRendah = kelompok?.BatasRendah ?? 10;
      const biaya = pemakaian <= batasRendah
        ? pemakaian * (kelompok?.TarifRendah ?? 1500)
        : pemakaian * (kelompok?.TarifTinggi ?? 2000);
      const biayaBeban = kelompok?.BiayaBeban ?? 5000;
      const totalBiaya = biaya + biayaBeban;

      const [year, month] = Periode.split('-').map(Number);
      const tenggatWaktu = new Date(year, month, 25);
      const userId = (meteran.IdKoneksiData as any)?.IdPelanggan || null;

      // Helper: buat Snap untuk billing id tertentu
      // Timestamp di order_id mencegah Midtrans menolak dengan "duplicate order_id"
      const buatSnap = async (billingId: any, totalBiayaSnap: number, periodeLabel: string, penggunaId: any) => {
        try {
          const MidtransOrderId = `BILLING-${billingId}-${Date.now()}`;
          const pengguna = penggunaId ? await User.findById(penggunaId).select('namaLengkap email noHP').lean() : null;
          const snap = await midtransClient.createTransaction({
            transaction_details: { order_id: MidtransOrderId, gross_amount: Math.round(totalBiayaSnap) },
            item_details: [{ id: billingId.toString(), price: Math.round(totalBiayaSnap), quantity: 1, name: `Tagihan Air ${periodeLabel}` }],
            customer_details: {
              first_name: (pengguna as any)?.namaLengkap || 'Pelanggan',
              email: (pengguna as any)?.email || '',
              phone: (pengguna as any)?.noHP || '',
            },
          });
          await Billing.findByIdAndUpdate(billingId, { MidtransOrderId, SnapToken: snap.token, SnapRedirectUrl: snap.redirect_url });
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
        const periodeAkhirBaru = computePeriodeAkhir(pendingBilling.Periode as string, bulanBaru);
        await Billing.findByIdAndUpdate(pendingBilling._id, {
          $inc: { TotalPemakaian: pemakaian, Biaya: biaya, BiayaBeban: biayaBeban, TotalBiaya: totalBiaya, bulanCakupan: 1 },
          $set: {
            PenggunaanSekarang: meteran.totalPemakaian || 0,
            TenggatWaktu: tenggatWaktu,
            Menunggak: true,
            PeriodeAkhir: periodeAkhirBaru,
            // Batalkan Snap lama — nominal berubah, order_id baru wajib dibuat
            MidtransOrderId: null,
            SnapToken: null,
            SnapRedirectUrl: null,
          },
        });

        // Buat Snap baru dengan nominal akumulasi terbaru
        const periodeLabel = `${pendingBilling.Periode} – ${periodeAkhirBaru} (${bulanBaru} bulan)`;
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
        PeriodeAkhir: Periode,
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
      }).select('_id IdMeteran TotalBiaya bulanCakupan Periode').lean();
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
            : pemakaian * (kelompok?.TarifTinggi ?? 2000);
          const biayaBeban = kelompok?.BiayaBeban ?? 5000;
          const totalBiaya = biaya + biayaBeban;
          const userId = meteran.IdKoneksiData?.IdPelanggan?._id || meteran.IdKoneksiData?.IdPelanggan || null;

          const pendingBilling = pendingMap.get(idMeteran.toString()) as any;

          if (pendingBilling) {
            // Akumulasi ke billing pending yang ada
            const bulanBaru = (pendingBilling.bulanCakupan ?? 1) + 1;
            const periodeAkhirBaru = computePeriodeAkhir(pendingBilling.Periode as string, bulanBaru);
            await Billing.findByIdAndUpdate(pendingBilling._id, {
              $inc: { TotalPemakaian: pemakaian, Biaya: biaya, BiayaBeban: biayaBeban, TotalBiaya: totalBiaya, bulanCakupan: 1 },
              $set: {
                PenggunaanSekarang: meteran.totalPemakaian || 0,
                TenggatWaktu: tenggatWaktu,
                Menunggak: true,
                PeriodeAkhir: periodeAkhirBaru,
                // Batalkan Snap lama — nominal berubah
                MidtransOrderId: null,
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
              PeriodeAkhir: Periode,
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
        // Append marker ke catatan lama — jangan overwrite info yang sudah ada
        const catatanLama = (tagihan as any).Catatan;
        updateData.Catatan = catatanLama
          ? `${catatanLama} [pemakaian_applied]`
          : '[pemakaian_applied]';
        const pemakaian = (tagihan as any).TotalPemakaian ?? 0;
        if (pemakaian > 0) {
          // Atomic: $max + $subtract mencegah race condition dengan IoT cron
          await Meteran.findByIdAndUpdate((tagihan as any).IdMeteran, [{
            $set: {
              pemakaianBelumTerbayar: {
                $max: [0, { $subtract: ['$pemakaianBelumTerbayar', pemakaian] }],
              },
            },
          }]);
        }
      }

      return await Billing.findByIdAndUpdate(id, updateData, { new: true }).populate(TAGIHAN_POPULATE);
    },

    buatSnapTagihan: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const tagihan = await Billing.findById(id).populate(TAGIHAN_POPULATE);
      if (!tagihan) throw new Error('Tagihan tidak ditemukan');
      if (tagihan.StatusPembayaran === 'settlement') throw new Error('Tagihan sudah lunas');

      // Selalu buat order_id baru dengan timestamp agar Midtrans tidak menolak duplicate
      const MidtransOrderId = `BILLING-${tagihan._id}-${Date.now()}`;
      const userId = tagihan.userId;
      const pengguna = userId ? await User.findById(userId).select('namaLengkap email noHP').lean() : null;
      const bulanLabel = tagihan.bulanCakupan && tagihan.bulanCakupan > 1
        ? `${tagihan.Periode} (${tagihan.bulanCakupan} bulan)`
        : tagihan.Periode;

      const snapParam = {
        transaction_details: {
          order_id: MidtransOrderId,
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
          MidtransOrderId,
          SnapToken: snapTransaction.token,
          SnapRedirectUrl: snapTransaction.redirect_url,
        },
        { new: true }
      ).populate(TAGIHAN_POPULATE);
    },
  },
};
