// Semua operasi WorkOrder di-proxy ke backend Teknisi (flowin-teknisi-graphql)
// Admin menggunakan x-api-key (INTERNAL_API_SECRET) + x-signature — otomatis ditambahkan oleh teknisiGraphQL

import { teknisiGraphQL } from '../../../utils/teknisiClient.js';
import { verifyAdminToken, /* catatAksesLog, */ notifikasiUntukPelanggan } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';
import RabConnection from '../../../models/RabConnection.js';
import ConnectionData from '../../../models/ConnectionData.js';
import User from '../../../models/User.js';
import PekerjaanTeknisi from '../../../models/PekerjaanTeknisi.js';
import PenyelesaianLaporan from '../../../models/PenyelesaianLaporan.js';
import Report from '../../../models/Report.js';
import midtransClient from '../../../middleware/midtrans.js';
import mongoose from 'mongoose';

// Epoch-ms string atau Date object → ISO string (aman)
function safeIso(val: any): string | null {
  if (!val) return null;
  try {
    if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
      const d = new Date(Number(val));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
}

// Normalize PekerjaanTeknisi MongoDB document → shape yang sesuai GraphQL WorkOrder type
function normalizeWorkOrder(wo: any): any {
  return {
    id: wo._id?.toString() ?? wo.id,
    idKoneksiData: wo.idKoneksiData?.toString() ?? null,
    jenisPekerjaan: wo.jenisPekerjaan,
    statusTim: wo.statusTim ?? 'belum_diajukan',
    catatanTim: wo.catatanTim ?? null,
    status: wo.status ?? 'menunggu_respon',
    statusRespon: wo.statusRespon ?? 'belum_direspon',
    alasanPenolakan: wo.alasanPenolakan ?? null,
    catatanReviewPenolakan: wo.catatanReviewPenolakan ?? null,
    catatanReview: wo.catatanReview ?? null,
    riwayatRespon: (wo.riwayatRespon ?? []).map((r: any) => ({
      aksi: r.aksi,
      alasan: r.alasan ?? null,
      tanggal: safeIso(r.tanggal),
      oleh: r.oleh ? { id: r.oleh._id?.toString() ?? r.oleh.toString(), namaLengkap: r.oleh.namaLengkap ?? null } : null,
    })),
    riwayatReview: (wo.riwayatReview ?? []).map((r: any) => ({
      status: r.status,
      catatan: r.catatan ?? null,
      tanggal: safeIso(r.tanggal),
      oleh: r.oleh ? { id: r.oleh._id?.toString() ?? r.oleh.toString(), namaLengkap: r.oleh.namaLengkap ?? null } : null,
    })),
    idSurvei: wo.idSurvei?.toString() ?? null,
    idRAB: wo.idRAB?.toString() ?? null,
    idPemasangan: wo.idPemasangan?.toString() ?? null,
    idPengawasanPemasangan: wo.idPengawasanPemasangan?.toString() ?? null,
    idPengawasanSetelahPemasangan: wo.idPengawasanSetelahPemasangan?.toString() ?? null,
    idPenyelesaianLaporan: wo.idPenyelesaianLaporan?.toString() ?? null,
    idLaporan: wo.idLaporan?.toString() ?? null,
    pelangganLaporan: (() => {
      // idLaporan populated directly (fallback path, stored via upsert on creation)
      const penggunaViaDirect = (wo.idLaporan as any)?.IdPengguna;
      // idPenyelesaianLaporan → idLaporan → IdPengguna (if work already submitted)
      const penggunaViaPenyelesaian = wo.idPenyelesaianLaporan?.idLaporan?.IdPengguna;
      const pengguna = penggunaViaDirect?._id ? penggunaViaDirect : penggunaViaPenyelesaian;
      if (!pengguna?._id) return null;
      return {
        id: pengguna._id.toString(),
        namaLengkap: pengguna.namaLengkap ?? null,
        email: pengguna.email ?? null,
        noHp: pengguna.noHP ?? null,
        alamat: pengguna.address ?? null,
      };
    })(),
    workOrderSebelumnya: wo.workOrderSebelumnya ? { id: wo.workOrderSebelumnya._id?.toString() ?? wo.workOrderSebelumnya.toString() } : null,
    teknisiPenanggungJawab: wo.teknisiPenanggungJawab ? {
      id: wo.teknisiPenanggungJawab._id?.toString() ?? wo.teknisiPenanggungJawab.toString(),
      namaLengkap: wo.teknisiPenanggungJawab.namaLengkap ?? null,
      nip: wo.teknisiPenanggungJawab.nip ?? null,
      email: wo.teknisiPenanggungJawab.email ?? null,
      noHp: wo.teknisiPenanggungJawab.noHp ?? null,
      divisi: wo.teknisiPenanggungJawab.divisi ?? null,
      isActive: wo.teknisiPenanggungJawab.isActive ?? true,
      createdAt: safeIso(wo.teknisiPenanggungJawab.createdAt),
      updatedAt: safeIso(wo.teknisiPenanggungJawab.updatedAt),
    } : null,
    tim: (wo.tim ?? []).map((t: any) => ({
      id: t._id?.toString() ?? t.toString(),
      namaLengkap: t.namaLengkap ?? null,
      nip: t.nip ?? null,
      email: t.email ?? null,
      noHp: t.noHp ?? null,
      divisi: t.divisi ?? null,
      isActive: t.isActive ?? true,
    })),
    koneksiData: wo.idKoneksiData && wo.idKoneksiData._id ? {
      id: wo.idKoneksiData._id?.toString(),
      statusPengajuan: wo.idKoneksiData.StatusPengajuan ?? wo.idKoneksiData.statusPengajuan ?? null,
      nik: wo.idKoneksiData.NIK ?? wo.idKoneksiData.nik ?? null,
      noKK: wo.idKoneksiData.noKK ?? null,
      imb: wo.idKoneksiData.IMB ?? wo.idKoneksiData.imb ?? null,
      alamat: wo.idKoneksiData.alamat ?? null,
      kelurahan: wo.idKoneksiData.Kelurahan ?? wo.idKoneksiData.kelurahan ?? null,
      kecamatan: wo.idKoneksiData.Kecamatan ?? wo.idKoneksiData.kecamatan ?? null,
      luasBangunan: wo.idKoneksiData.luasBangunan ?? null,
      nikUrl: wo.idKoneksiData.NIKUrl ?? wo.idKoneksiData.nikUrl ?? null,
      kkUrl: wo.idKoneksiData.KKUrl ?? wo.idKoneksiData.kkUrl ?? null,
      imbUrl: wo.idKoneksiData.IMBUrl ?? wo.idKoneksiData.imbUrl ?? null,
      tanggalVerifikasi: safeIso(wo.idKoneksiData.tanggalVerifikasi),
      alasanPenolakan: wo.idKoneksiData.alasanPenolakan ?? null,
      createdAt: safeIso(wo.idKoneksiData.createdAt),
      updatedAt: safeIso(wo.idKoneksiData.updatedAt),
      pelanggan: wo.idKoneksiData.IdPelanggan ? {
        id: wo.idKoneksiData.IdPelanggan._id?.toString() ?? wo.idKoneksiData.IdPelanggan.toString(),
        namaLengkap: wo.idKoneksiData.IdPelanggan.namaLengkap ?? null,
        email: wo.idKoneksiData.IdPelanggan.email ?? null,
        noHp: wo.idKoneksiData.IdPelanggan.noHP ?? null,
        alamat: wo.idKoneksiData.IdPelanggan.address ?? null,
      } : null,
    } : null,
    createdAt: safeIso(wo.createdAt),
    updatedAt: safeIso(wo.updatedAt),
  };
}

// Fallback: baca work orders langsung dari MongoDB pekerjaanteknisis
async function fallbackWorkOrdersFromMongo(filter?: any, pagination?: any): Promise<any> {
  const page = pagination?.page ?? 1;
  const limit = Math.min(pagination?.limit ?? 10, 100);
  const skip = (page - 1) * limit;

  const mongoFilter: Record<string, any> = {};
  if (filter?.status) mongoFilter.status = filter.status;
  if (filter?.jenisPekerjaan) mongoFilter.jenisPekerjaan = filter.jenisPekerjaan;
  if (filter?.statusTim) mongoFilter.statusTim = filter.statusTim;
  if (filter?.statusRespon) mongoFilter.statusRespon = filter.statusRespon;
  if (filter?.teknisiPenanggungJawab) mongoFilter.teknisiPenanggungJawab = filter.teknisiPenanggungJawab;
  if (filter?.idKoneksiData) mongoFilter.idKoneksiData = filter.idKoneksiData;

  const [docs, total] = await Promise.all([
    PekerjaanTeknisi.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'teknisiPenanggungJawab', model: 'TeknisiPerumdam' })
      .populate({ path: 'tim', model: 'TeknisiPerumdam' })
      .populate({
        path: 'idKoneksiData',
        model: 'KoneksiData',
        populate: { path: 'IdPelanggan', model: 'Pengguna' },
      })
      .populate({
        path: 'idLaporan',
        model: 'Laporan',
        populate: { path: 'IdPengguna', model: 'Pengguna', select: 'namaLengkap email noHP' },
      })
      .populate({
        path: 'idPenyelesaianLaporan',
        model: 'PenyelesaianLaporan',
        populate: {
          path: 'idLaporan',
          model: 'Laporan',
          populate: { path: 'IdPengguna', model: 'Pengguna' },
        },
      })
      .lean(),
    PekerjaanTeknisi.countDocuments(mongoFilter),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    data: docs.map(normalizeWorkOrder),
    pagination: { total, page, limit, totalPages, hasNextPage: page < totalPages },
  };
}

function getToken(ctx: GraphQLContext): string | undefined {
  return ctx.token ?? undefined;
}

// ─── Auto-generate RAB payment setelah admin approve ─────────────────────────
// Dipanggil ketika reviewHasil disetujui untuk jenis pekerjaan 'rab'.
// Menggunakan koleksi rabs (shared) — tidak menambah koleksi baru.
async function generateRABPayment(idKoneksiData: string): Promise<void> {
  const rab = await RabConnection.findOne({ idKoneksiData });
  if (!rab || !rab.totalBiaya || rab.totalBiaya <= 0) {
    console.warn('[generateRABPayment] RAB tidak ditemukan atau totalBiaya kosong, idKoneksiData:', idKoneksiData);
    return;
  }

  // Sudah lunas — tidak perlu buat payment lagi
  if (rab.statusPembayaran === 'settlement') return;

  const koneksi = await ConnectionData.findById(idKoneksiData);
  if (!koneksi?.IdPelanggan) {
    console.warn('[generateRABPayment] KoneksiData atau IdPelanggan tidak ditemukan');
    return;
  }
  const idPelanggan = koneksi.IdPelanggan.toString();

  // Sudah ada payment URL pending — cukup kirim notifikasi ulang
  if (rab.orderId && rab.paymentUrl && rab.statusPembayaran === 'pending') {
    await notifikasiUntukPelanggan(
      idPelanggan,
      'Pembayaran RAB Tersedia',
      `RAB Anda telah disetujui. Silakan lakukan pembayaran biaya pemasangan sebesar Rp ${rab.totalBiaya.toLocaleString('id-ID')} melalui aplikasi Flowin.`,
      'PEMBAYARAN',
    );
    return;
  }

  // Buat order ID dan Midtrans Snap transaction
  const pengguna = await User.findById(koneksi.IdPelanggan).select('namaLengkap email noHP');
  const orderId = `RAB-${rab._id}-${Date.now()}`;

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(rab.totalBiaya),
    },
    item_details: [{
      id: rab._id.toString(),
      price: Math.round(rab.totalBiaya),
      quantity: 1,
      name: 'Biaya Pemasangan Koneksi Air PDAM',
    }],
    customer_details: {
      first_name: pengguna?.namaLengkap || 'Pelanggan',
      email: pengguna?.email || '',
      phone: (pengguna as any)?.noHP || '',
    },
  };

  const transaction = await midtransClient.createTransaction(parameter);

  rab.orderId = orderId;
  rab.paymentUrl = transaction.redirect_url;
  rab.statusPembayaran = 'pending';
  await rab.save();

  await notifikasiUntukPelanggan(
    idPelanggan,
    'Pembayaran RAB Tersedia',
    `RAB Anda telah disetujui. Silakan lakukan pembayaran biaya pemasangan sebesar Rp ${rab.totalBiaya.toLocaleString('id-ID')} melalui aplikasi Flowin.`,
    'PEMBAYARAN',
  );

  console.log(`[generateRABPayment] Berhasil membuat payment ${orderId} untuk pelanggan ${idPelanggan}`);
}

export const workOrderResolvers = {
  Query: {
    workOrders: async (_: any, { filter, pagination }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query WorkOrders($filter: WorkOrderFilterInput, $pagination: PaginationInput) {
            workOrders(filter: $filter, pagination: $pagination) {
              data {
                id idKoneksiData jenisPekerjaan statusTim status statusRespon
                alasanPenolakan catatanTim catatanReview createdAt updatedAt
                idPenyelesaianLaporan
                teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
                tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
                koneksiData {
                  id statusPengajuan nik noKK imb alamat kelurahan kecamatan luasBangunan
                  nikUrl kkUrl imbUrl tanggalVerifikasi alasanPenolakan createdAt updatedAt
                  pelanggan { id namaLengkap email noHp }
                }
                workOrderSebelumnya { id jenisPekerjaan status }
                riwayatRespon { aksi alasan tanggal oleh { id namaLengkap } }
                riwayatReview { status catatan tanggal oleh { id namaLengkap } }
              }
              pagination { total page limit totalPages hasNextPage }
            }
          }`,
          { filter, pagination },
          getToken(ctx)
        );
        const result = (data as any).workOrders ?? { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false } };

        // ── Pre-patch: isi idKoneksiData untuk penyelesaian_laporan dari local DB ──────────────
        // Rafli menyimpan idKoneksiData:null untuk WO lama (sebelum fix auto-populate).
        // Ambil dari local PekerjaanTeknisi (di-set saat buatWorkOrder atau via Atlas backfill).
        // Jika local juga null tapi ada idLaporan, resolve via laporan→user→KoneksiData
        // dan backfill ke local DB agar request berikutnya langsung pakai Block 1.
        const penyelesaianNullKoneksi = result.data.filter(
          (wo: any) => wo.jenisPekerjaan === 'penyelesaian_laporan' && !wo.idKoneksiData
        );
        if (penyelesaianNullKoneksi.length > 0) {
          const woIds = penyelesaianNullKoneksi.map((wo: any) => wo.id);
          const localDocs = await PekerjaanTeknisi.find(
            { _id: { $in: woIds } }, { idKoneksiData: 1, idLaporan: 1 }
          ).lean();

          const localMap = new Map(localDocs.map((d: any) => [d._id.toString(), d]));

          // WO yang local punya idLaporan tapi belum punya idKoneksiData → resolve sekarang
          const needResolve = localDocs.filter(
            (d: any) => d.idLaporan && !d.idKoneksiData
          );
          if (needResolve.length > 0) {
            const laporanIds = needResolve.map((d: any) => d.idLaporan.toString());
            const laporans = await Report.find(
              { _id: { $in: laporanIds } }, { IdPengguna: 1 }
            ).lean();
            const laporanUserMap = new Map(
              laporans.map((l: any) => [l._id.toString(), l.IdPengguna?.toString()])
            );
            const userIds = [...new Set(Array.from(laporanUserMap.values()).filter(Boolean))];
            const koneksiDocs = await ConnectionData.find(
              { IdPelanggan: { $in: userIds }, StatusPengajuan: 'APPROVED' },
              { IdPelanggan: 1 }
            ).lean();
            const userToKoneksi = new Map(
              koneksiDocs.map((k: any) => [k.IdPelanggan.toString(), k._id.toString()])
            );

            for (const d of needResolve) {
              const uid = laporanUserMap.get(d.idLaporan.toString());
              if (!uid) continue;
              const koneksiId = userToKoneksi.get(uid);
              if (!koneksiId) continue;
              // Backfill local DB (fire-and-forget)
              PekerjaanTeknisi.collection.updateOne(
                { _id: d._id },
                { $set: { idKoneksiData: new mongoose.Types.ObjectId(koneksiId) } }
              ).catch(() => {});
              // Patch in-memory untuk request ini
              localMap.set(d._id.toString(), { ...d, idKoneksiData: koneksiId });
            }
          }

          // Terapkan patch idKoneksiData ke result.data
          result.data = result.data.map((wo: any) => {
            if (wo.jenisPekerjaan !== 'penyelesaian_laporan' || wo.idKoneksiData) return wo;
            const localDoc = localMap.get(wo.id);
            const koneksiId = (localDoc as any)?.idKoneksiData?.toString();
            if (!koneksiId) return wo;
            return { ...wo, idKoneksiData: koneksiId };
          });
        }

        // ── Enrichment Block 1: isi pelanggan dari KoneksiData lokal ─────────────────────────
        // Rafli tidak punya akses Pengguna Aqualink, jadi koneksiData.pelanggan selalu null.
        // Untuk penyelesaian_laporan: hasil masuk ke pelangganLaporan (bukan koneksiData.pelanggan).
        const wosMissingPelanggan = result.data.filter((wo: any) => {
          if (wo.jenisPekerjaan === 'penyelesaian_laporan') return !wo.pelangganLaporan?.namaLengkap && wo.idKoneksiData;
          return wo.idKoneksiData && !wo.koneksiData?.pelanggan?.namaLengkap;
        });

        if (wosMissingPelanggan.length > 0) {
          const koneksiIds = [...new Set(wosMissingPelanggan.map((wo: any) => wo.idKoneksiData))];
          const koneksiDatas = await ConnectionData.find(
            { _id: { $in: koneksiIds } }, { IdPelanggan: 1 }
          ).populate({ path: 'IdPelanggan', model: 'Pengguna', select: 'namaLengkap email noHP' })
            .lean();

          const koneksiToPelanggan = new Map(
            koneksiDatas.map((k: any) => [k._id.toString(), k.IdPelanggan])
          );

          result.data = result.data.map((wo: any) => {
            if (!wo.idKoneksiData) return wo;
            const pengguna = koneksiToPelanggan.get(wo.idKoneksiData?.toString());
            if (!pengguna?._id) return wo;
            const penggunaObj = {
              id: (pengguna as any)._id.toString(),
              namaLengkap: (pengguna as any).namaLengkap ?? null,
              email: (pengguna as any).email ?? null,
              noHp: (pengguna as any).noHP ?? null,
            };
            if (wo.jenisPekerjaan === 'penyelesaian_laporan') {
              if (wo.pelangganLaporan?.namaLengkap) return wo;
              return { ...wo, pelangganLaporan: penggunaObj };
            }
            if (wo.koneksiData?.pelanggan?.namaLengkap) return wo;
            return { ...wo, koneksiData: { ...(wo.koneksiData ?? {}), pelanggan: penggunaObj } };
          });
        }

        // ── Enrichment Block 2: penyelesaian_laporan tanpa idKoneksiData sama sekali ─────────
        // Safety net untuk WO yang tidak ada di local DB (tidak pernah lewat buatWorkOrder kita).
        // Path A: idPenyelesaianLaporan dari Rafli → PenyelesaianLaporan.idLaporan → IdPengguna
        const penyelesaianStillMissing = result.data.filter(
          (wo: any) => wo.jenisPekerjaan === 'penyelesaian_laporan' && !wo.pelangganLaporan?.namaLengkap
        );
        if (penyelesaianStillMissing.length > 0) {
          const wosWithPenyelesaian = penyelesaianStillMissing.filter((wo: any) => wo.idPenyelesaianLaporan);
          if (wosWithPenyelesaian.length > 0) {
            const pls = await PenyelesaianLaporan.find(
              { _id: { $in: wosWithPenyelesaian.map((wo: any) => wo.idPenyelesaianLaporan) } },
              { idLaporan: 1 }
            ).lean();
            const plMap = new Map(pls.map((p: any) => [p._id.toString(), (p as any).idLaporan?.toString()]));
            const laporanIds = [...new Set(Array.from(plMap.values()).filter(Boolean))];
            if (laporanIds.length > 0) {
              const laporans = await Report.find({ _id: { $in: laporanIds } })
                .populate({ path: 'IdPengguna', model: 'Pengguna', select: 'namaLengkap email noHP' })
                .lean();
              const laporanMap = new Map(laporans.map((l: any) => [l._id.toString(), l]));
              result.data = result.data.map((wo: any) => {
                if (wo.jenisPekerjaan !== 'penyelesaian_laporan' || wo.pelangganLaporan?.namaLengkap) return wo;
                const laporanId = plMap.get(wo.idPenyelesaianLaporan?.toString());
                if (!laporanId) return wo;
                const pengguna = (laporanMap.get(laporanId) as any)?.IdPengguna;
                if (!pengguna?._id) return wo;
                return {
                  ...wo,
                  pelangganLaporan: {
                    id: pengguna._id.toString(),
                    namaLengkap: pengguna.namaLengkap ?? null,
                    email: pengguna.email ?? null,
                    noHp: pengguna.noHP ?? null,
                    alamat: null,
                  },
                };
              });
            }
          }
        }

        return result;
      } catch (err: any) {
        console.error('[workOrders] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        try {
          return await fallbackWorkOrdersFromMongo(filter, pagination);
        } catch (mongoErr: any) {
          console.error('[workOrders] MongoDB fallback juga gagal:', mongoErr.message);
          return { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false } };
        }
      }
    },

    workOrder: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query WorkOrder($id: ID!) {
            workOrder(id: $id) {
              id idKoneksiData jenisPekerjaan statusTim status statusRespon
              alasanPenolakan catatanTim catatanReview catatanReviewPenolakan createdAt updatedAt
              idSurvei idRAB idPemasangan idPengawasanPemasangan idPengawasanSetelahPemasangan idPenyelesaianLaporan
              teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              koneksiData {
                id statusPengajuan nik noKK imb alamat kelurahan kecamatan luasBangunan
                nikUrl kkUrl imbUrl tanggalVerifikasi alasanPenolakan createdAt updatedAt
                pelanggan { id namaLengkap email noHp }
              }
              workOrderSebelumnya { id jenisPekerjaan status createdAt }
              riwayatRespon { aksi alasan tanggal oleh { id namaLengkap } }
              riwayatReview { status catatan tanggal oleh { id namaLengkap } }
            }
          }`,
          { id },
          getToken(ctx)
        );
        return (data as any).workOrder ?? null;
      } catch (err: any) {
        console.error('[workOrder] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        try {
          if (!mongoose.Types.ObjectId.isValid(id)) return null;
          const wo = await PekerjaanTeknisi.findById(id)
            .populate({ path: 'teknisiPenanggungJawab', model: 'TeknisiPerumdam' })
            .populate({ path: 'tim', model: 'TeknisiPerumdam' })
            .populate({
              path: 'idKoneksiData',
              model: 'KoneksiData',
              populate: { path: 'IdPelanggan', model: 'Pengguna' },
            })
            .lean();
          return wo ? normalizeWorkOrder(wo) : null;
        } catch (mongoErr: any) {
          console.error('[workOrder] MongoDB fallback gagal:', mongoErr.message);
          return null;
        }
      }
    },

    workOrdersByKoneksiData: async (_: any, { idKoneksiData }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query WorkOrdersByKoneksiData($idKoneksiData: ID!) {
            workOrdersByKoneksiData(idKoneksiData: $idKoneksiData) {
              id idKoneksiData jenisPekerjaan status statusRespon statusTim createdAt updatedAt
              teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
            }
          }`,
          { idKoneksiData },
          getToken(ctx)
        );
        return (data as any).workOrdersByKoneksiData ?? [];
      } catch (err: any) {
        console.error('[workOrdersByKoneksiData] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        try {
          const docs = await PekerjaanTeknisi.find({ idKoneksiData })
            .populate({ path: 'teknisiPenanggungJawab', model: 'TeknisiPerumdam' })
            .populate({ path: 'tim', model: 'TeknisiPerumdam' })
            .lean();
          return docs.map(normalizeWorkOrder);
        } catch {
          return [];
        }
      }
    },

    workflowChain: async (_: any, { idKoneksiData }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query WorkflowChain($idKoneksiData: ID!) {
            workflowChain(idKoneksiData: $idKoneksiData) {
              jenisPekerjaan chainStatus urutan bisaDibuat
              workOrder {
                id status statusRespon statusTim createdAt updatedAt
                teknisiPenanggungJawab { id namaLengkap }
              }
            }
          }`,
          { idKoneksiData },
          getToken(ctx)
        );
        return (data as any).workflowChain ?? [];
      } catch (err: any) {
        console.error('[workflowChain] Rafli backend tidak tersedia:', err.message);
        return [];
      }
    },

    cekPrerequisitePekerjaan: async (_: any, { idKoneksiData, jenisPekerjaan }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query CekPrerequisite($idKoneksiData: ID!, $jenisPekerjaan: JenisPekerjaan!) {
            cekPrerequisitePekerjaan(idKoneksiData: $idKoneksiData, jenisPekerjaan: $jenisPekerjaan)
          }`,
          { idKoneksiData, jenisPekerjaan },
          getToken(ctx)
        );
        return (data as any).cekPrerequisitePekerjaan ?? false;
      } catch (err: any) {
        console.error('[cekPrerequisitePekerjaan] Rafli backend tidak tersedia:', err.message);
        return false;
      }
    },
  },

  Mutation: {
    buatWorkOrder: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      const isPenyelesaianLaporan = input.jenisPekerjaan === 'penyelesaian_laporan';

      if (isPenyelesaianLaporan) {
        // Auto-populate idKoneksiData dari user yang lapor (pasti punya KoneksiData APPROVED)
        if (input.idLaporan && (!input.idKoneksiData || !mongoose.Types.ObjectId.isValid(input.idKoneksiData))) {
          const laporan = await Report.findById(input.idLaporan, 'IdPengguna').lean() as any;
          if (laporan?.IdPengguna) {
            const koneksi = await ConnectionData.findOne(
              { IdPelanggan: laporan.IdPengguna, StatusPengajuan: 'APPROVED' },
              '_id'
            ).lean();
            if (koneksi) input.idKoneksiData = koneksi._id.toString();
          }
        }
      } else {
        if (!input.idKoneksiData || !mongoose.Types.ObjectId.isValid(input.idKoneksiData)) {
          return { success: false, message: 'idKoneksiData tidak valid', workOrder: null };
        }
        const koneksi = await ConnectionData.findById(input.idKoneksiData, 'StatusPengajuan').lean();
        if (!koneksi) {
          return { success: false, message: 'KoneksiData tidak ditemukan', workOrder: null };
        }
        if ((koneksi as any).StatusPengajuan !== 'APPROVED') {
          return { success: false, message: 'Work Order hanya dapat dibuat untuk KoneksiData yang berstatus APPROVED', workOrder: null };
        }
      }
      try {
        const data = await teknisiGraphQL(
          `mutation BuatWorkOrder($input: BuatWorkOrderInput!) {
            buatWorkOrder(input: $input) {
              success message
              workOrder {
                id idKoneksiData jenisPekerjaan status statusRespon statusTim createdAt updatedAt
                teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
                tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              }
            }
          }`,
          { input },
          getToken(ctx)
        );
        const result = (data as any).buatWorkOrder;

        // Simpan mapping lokal rafliWoId → idLaporan + idKoneksiData agar enrichment bisa lookup nama pelanggan
        if (result?.success && result.workOrder?.id && input.idLaporan && mongoose.Types.ObjectId.isValid(result.workOrder.id)) {
          const upsertFields: Record<string, any> = {
            idLaporan: new mongoose.Types.ObjectId(input.idLaporan),
            jenisPekerjaan: 'penyelesaian_laporan',
          };
          if (input.idKoneksiData && mongoose.Types.ObjectId.isValid(input.idKoneksiData)) {
            upsertFields.idKoneksiData = new mongoose.Types.ObjectId(input.idKoneksiData);
          }
          PekerjaanTeknisi.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(result.workOrder.id) },
            { $set: upsertFields },
            { upsert: true }
          ).catch(() => {});
        }

        // Kirim notifikasi ke pelanggan — non-blocking, tidak gagalkan mutation
        if (result?.success) {
          (async () => {
            try {
              if (input.idLaporan) {
                // penyelesaian_laporan: notifikasi ke pelapor
                const laporan = await Report.findById(input.idLaporan).lean() as any;
                const idPelanggan = laporan?.IdPengguna?.toString();
                if (idPelanggan) {
                  await notifikasiUntukPelanggan(
                    idPelanggan,
                    'Laporan Sedang Ditangani Teknisi',
                    `Laporan "${laporan?.NamaLaporan || 'Anda'}" kini sedang ditangani oleh teknisi kami. Kami akan segera menyelesaikannya.`,
                    'INFORMASI',
                    '/laporan',
                  );
                }
              } else if (input.idKoneksiData) {
                // Workflow koneksi (survei/rab/pemasangan/dll): notifikasi ke pemilik koneksi
                const koneksi = await ConnectionData.findById(input.idKoneksiData).lean() as any;
                const idPelanggan = koneksi?.IdPelanggan?.toString();
                if (idPelanggan) {
                  const jenisLabel = (input.jenisPekerjaan as string)?.replace(/_/g, ' ') ?? 'pekerjaan';
                  await notifikasiUntukPelanggan(
                    idPelanggan,
                    'Proses Sambungan Air Diperbarui',
                    `Tahap ${jenisLabel} untuk sambungan air Anda telah ditugaskan ke teknisi kami.`,
                    'INFORMASI',
                    '/',
                  );
                }
              }
            } catch (notifErr: any) {
              console.error('[buatWorkOrder] notifikasi gagal (non-fatal):', notifErr.message);
            }
          })();
        }

        return result;
      } catch (err: any) {
        console.error('[buatWorkOrder] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        try {
          const newWO = await new PekerjaanTeknisi({
            idKoneksiData: input.idKoneksiData,
            jenisPekerjaan: input.jenisPekerjaan,
            teknisiPenanggungJawab: input.teknisiPenanggungJawab,
            status: 'ditugaskan',
            statusRespon: 'belum_direspon',
            statusTim: 'belum_diajukan',
          }).save();
          const populated = await PekerjaanTeknisi.findById(newWO._id)
            .populate({ path: 'teknisiPenanggungJawab', model: 'TeknisiPerumdam' })
            .lean();
          return { success: true, message: 'Work order berhasil dibuat', workOrder: normalizeWorkOrder(populated) };
        } catch (mongoErr: any) {
          return { success: false, message: `Gagal membuat work order: ${mongoErr.message}`, workOrder: null };
        }
      }
    },

    reviewPenolakan: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation ReviewPenolakan($input: ReviewPenolakanInput!) {
            reviewPenolakan(input: $input) {
              success message
              workOrder { id status statusRespon riwayatRespon { aksi alasan tanggal oleh { id namaLengkap } } }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).reviewPenolakan;
      } catch (err: any) {
        console.error('[reviewPenolakan] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}`, workOrder: null };
      }
    },

    reviewTim: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation ReviewTim($input: ReviewTimInput!) {
            reviewTim(input: $input) {
              success message
              workOrder { id status statusTim tim { id namaLengkap } }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).reviewTim;
      } catch (err: any) {
        console.error('[reviewTim] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}`, workOrder: null };
      }
    },

    reviewHasil: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation ReviewHasil($input: ReviewHasilInput!) {
            reviewHasil(input: $input) {
              success message
              workOrder {
                id idKoneksiData jenisPekerjaan status
                riwayatReview { status catatan tanggal oleh { id namaLengkap } }
              }
            }
          }`,
          { input },
          getToken(ctx)
        );
        const result = (data as any).reviewHasil;

        // Non-blocking: notifikasi pelanggan + generate RAB payment jika disetujui
        if (result?.success) {
          (async () => {
            try {
              const wo = result.workOrder;
              const jenis = wo?.jenisPekerjaan ?? '';
              const idKoneksiData: string | null = wo?.idKoneksiData ?? null;

              if (jenis === 'rab' && input.disetujui && idKoneksiData) {
                // RAB disetujui → buat Midtrans payment + notifikasi pelanggan
                await generateRABPayment(idKoneksiData);
              } else if (idKoneksiData) {
                // Pekerjaan lain (survei, pemasangan, dll) → notifikasi pelanggan
                const koneksi = await ConnectionData.findById(idKoneksiData).lean() as any;
                const idPelanggan = koneksi?.IdPelanggan?.toString();
                if (idPelanggan) {
                  const jenisLabel = jenis.replace(/_/g, ' ');
                  if (input.disetujui) {
                    await notifikasiUntukPelanggan(
                      idPelanggan,
                      'Tahap Pekerjaan Disetujui',
                      `Tahap "${jenisLabel}" untuk sambungan air Anda telah disetujui oleh admin. Proses akan dilanjutkan ke tahap berikutnya.`,
                      'INFORMASI',
                      '/',
                    );
                  } else {
                    await notifikasiUntukPelanggan(
                      idPelanggan,
                      'Tahap Pekerjaan Perlu Perbaikan',
                      `Tahap "${jenisLabel}" untuk sambungan air Anda memerlukan perbaikan. Tim teknisi akan menghubungi Anda.${input.catatan ? ` Catatan admin: ${input.catatan}` : ''}`,
                      'INFORMASI',
                      '/',
                    );
                  }
                }
              }
            } catch (notifErr: any) {
              console.error('[reviewHasil] notifikasi gagal (non-fatal):', notifErr.message);
            }
          })();
        }

        return result;
      } catch (err: any) {
        console.error('[reviewHasil] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        try {
          const wo = await PekerjaanTeknisi.findById(input.workOrderId).lean() as any;
          if (!wo) return { success: false, message: 'Work order tidak ditemukan', workOrder: null };
          const newStatus = input.disetujui ? 'selesai' : 'ditugaskan';
          await PekerjaanTeknisi.findByIdAndUpdate(input.workOrderId, {
            status: newStatus,
            catatanReview: input.catatan ?? null,
          });
          // Auto-generate RAB payment jika disetujui dan jenis 'rab'
          if (input.disetujui && wo.jenisPekerjaan === 'rab') {
            generateRABPayment(wo.idKoneksiData?.toString()).catch((e: any) => {
              console.error('[reviewHasil fallback] Auto-payment RAB gagal:', e.message);
            });
          }
          return {
            success: true,
            message: `Work order berhasil ${input.disetujui ? 'disetujui' : 'ditolak'}`,
            workOrder: { id: wo._id?.toString(), idKoneksiData: wo.idKoneksiData?.toString(), jenisPekerjaan: wo.jenisPekerjaan, status: newStatus },
          };
        } catch (mongoErr: any) {
          return { success: false, message: `Gagal mereview work order: ${mongoErr.message}`, workOrder: null };
        }
      }
    },

    batalkanWorkOrder: async (_: any, { id, catatan }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation BatalkanWorkOrder($id: ID!, $catatan: String) {
            batalkanWorkOrder(id: $id, catatan: $catatan) {
              success message
            }
          }`,
          { id, catatan },
          getToken(ctx)
        );
        return (data as any).batalkanWorkOrder;
      } catch (err: any) {
        console.error('[batalkanWorkOrder] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}` };
      }
    },
  },
};
