import KoneksiData from '../../../models/ConnectionData.js';
import User from '../../../models/User.js';
import SurveyData from '../../../models/SurveyData.js';
import RabConnection from '../../../models/RabConnection.js';
import Meteran from '../../../models/Meteran.js';
import Pemasangan from '../../../models/Pemasangan.js';
import PengawasanPemasangan from '../../../models/PengawasanPemasangan.js';
import PengawasanSetelahPemasangan from '../../../models/PengawasanSetelahPemasangan.js';
import { teknisiGraphQL } from '../../../utils/teknisiClient.js';
import PekerjaanTeknisi from '../../../models/PekerjaanTeknisi.js';
import { verifyAdminToken, /* catatAuditLog, catatAksesLog, */ notifikasiUntukPelanggan, notifikasiSemuaAdmin } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const koneksiDataResolvers = {
  Query: {
    getKoneksiData: async (_, { id }, { token, req }: GraphQLContext) => {
      verifyAdminToken(token);
      const data = await KoneksiData.findById(id).populate('IdPelanggan');
      if (data) {
        // [akseslog nonaktif â€” uncomment untuk mengaktifkan kembali]
        // catatAksesLog({ token, req, jenisDokumen: 'NIK,KK,IMB', idPemilik: id, namaOperasi: 'getKoneksiData' });
      }
      return data;
    },

    getKoneksiDataByPelanggan: async (_, { idPelanggan }, { token, req }: GraphQLContext) => {
      verifyAdminToken(token);
      const data = await KoneksiData.findOne({ IdPelanggan: idPelanggan })
        .sort({ createdAt: -1 })
        .populate('IdPelanggan');
      if (data) {
        // catatAksesLog({ token, req, jenisDokumen: 'NIK,KK,IMB', idPemilik: String(data._id), namaOperasi: 'getKoneksiDataByPelanggan' });
      }
      return data;
    },

    getAllKoneksiData: async (_, { limit = 50, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 500))
        .populate('IdPelanggan');
    },

    getPendingKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      // Mendukung format baru (PascalCase) dan lama (camelCase Ahmad)
      return await KoneksiData.find({
        $or: [
          { StatusPengajuan: 'PENDING' },
          { statusPengajuan: 'pending' },
          { statusVerifikasi: 'menunggu' },
        ],
      }).sort({ createdAt: -1 }).populate('IdPelanggan');
    },

    getApprovedKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.find({
        $or: [
          { StatusPengajuan: 'APPROVED' },
          { statusPengajuan: 'approved' },
          { statusVerifikasi: 'disetujui' },
        ],
      }).sort({ createdAt: -1 }).populate('IdPelanggan');
    },

    getRejectedKoneksiData: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await KoneksiData.find({
        $or: [
          { StatusPengajuan: 'REJECTED' },
          { statusPengajuan: 'rejected' },
          { statusVerifikasi: 'ditolak' },
        ],
      }).sort({ createdAt: -1 }).populate('IdPelanggan');
    },

    getDetailSambungan: async (_, { id }, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);

      // First fetch koneksiData â€” needed to determine if APPROVED before fetching children
      const koneksiData = await KoneksiData.findById(id).populate('IdPelanggan');
      if (!koneksiData) throw new Error('Data sambungan tidak ditemukan');

      const isApproved = koneksiData.StatusPengajuan === 'APPROVED'
        || (koneksiData as any).statusPengajuan === 'approved'
        || (koneksiData as any).statusVerifikasi === 'disetujui';

      if (!isApproved) {
        return { koneksiData, survei: null, rab: null, meteran: null, pemasangan: null, pengawasan: null, pengawasanSetelah: null, workOrders: [] };
      }

      // Fetch all sub-documents in parallel â€” single server-side round
      const [survei, rab, meteran, pemasangan, workOrders] = await Promise.all([
        SurveyData.findOne({ idKoneksiData: id, isDraft: { $ne: true } })
          .populate({ path: 'idKoneksiData', populate: { path: 'IdPelanggan' } }),
        RabConnection.findOne({ idKoneksiData: id })
          .populate({ path: 'idKoneksiData', populate: { path: 'IdPelanggan' } }),
        Meteran.findOne({ $or: [{ IdKoneksiData: id }, { idKoneksiData: id }] })
          .populate('IdKelompokPelanggan')
          .populate({ path: 'IdKoneksiData', populate: { path: 'IdPelanggan', select: 'namaLengkap email noHP' } }),
        Pemasangan.findOne({ idKoneksiData: id })
          .populate({ path: 'idKoneksiData', model: 'KoneksiData', populate: { path: 'IdPelanggan', model: 'Pengguna' } }),
        (async () => {
          try {
            const data = await teknisiGraphQL(
              `query WorkOrdersByKoneksiData($idKoneksiData: ID!) {
                workOrdersByKoneksiData(idKoneksiData: $idKoneksiData) {
                  id idKoneksiData jenisPekerjaan status statusRespon statusTim createdAt updatedAt
                  teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive }
                  tim { id namaLengkap email nip divisi noHp isActive }
                }
              }`,
              { idKoneksiData: id },
              ctx.token
            );
            return (data as any).workOrdersByKoneksiData ?? [];
          } catch {
            try {
              const docs = await PekerjaanTeknisi.find({ idKoneksiData: id })
                .populate({ path: 'teknisiPenanggungJawab', model: 'TeknisiPerumdam' })
                .populate({ path: 'tim', model: 'TeknisiPerumdam' })
                .lean();
              return docs.map((d: any) => ({ ...d, id: d._id?.toString() }));
            } catch { return []; }
          }
        })(),
      ]);

      // Pengawasan requires pemasangan._id â€” fetch after pemasangan resolves
      let pengawasan = null;
      let pengawasanSetelah = null;
      if (pemasangan?._id) {
        const [pw, ps] = await Promise.all([
          PengawasanPemasangan.findOne({ idPemasangan: pemasangan._id })
            .populate({ path: 'idPemasangan', model: 'Pemasangan', populate: { path: 'idKoneksiData', model: 'KoneksiData', populate: { path: 'IdPelanggan', model: 'Pengguna' } } }),
          PengawasanSetelahPemasangan.findOne({ idPemasangan: pemasangan._id })
            .populate({ path: 'idPemasangan', model: 'Pemasangan', populate: { path: 'idKoneksiData', model: 'KoneksiData', populate: { path: 'IdPelanggan', model: 'Pengguna' } } }),
        ]);
        pengawasan = pw;
        pengawasanSetelah = ps;
      }

      return { koneksiData, survei, rab, meteran, pemasangan, pengawasan, pengawasanSetelah, workOrders };
    },
  },

  Mutation: {
    createKoneksiData: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const koneksi = new KoneksiData({
        IdPelanggan: input.IdPelanggan,
        NIK: input.NIK,
        NIKUrl: input.NIKUrl,
        NoKK: input.NoKK,
        KKUrl: input.KKUrl,
        IMB: input.IMB,
        IMBUrl: input.IMBUrl,
        Alamat: input.Alamat,
        Kelurahan: input.Kelurahan,
        Kecamatan: input.Kecamatan,
        LuasBangunan: input.LuasBangunan,
        StatusPengajuan: 'PENDING',
        catatan: input.catatan || null,
      });
      await koneksi.save();

      // Sync NIK dan Alamat ke User agar langsung tampil di list pelanggan
      if (input.IdPelanggan) {
        User.findByIdAndUpdate(input.IdPelanggan, {
          ...(input.NIK && { nik: input.NIK }),
          ...(input.Alamat && { address: input.Alamat }),
        }).catch(() => {});
      }

      // Notify semua admin bahwa ada pengajuan sambungan baru
      await notifikasiSemuaAdmin(
        'Pengajuan Sambungan Baru',
        'Ada pengajuan sambungan air baru yang menunggu verifikasi.',
        'INFORMASI',
        `/operations/connection-data/${koneksi._id}`,
      );

      return await KoneksiData.findById(koneksi._id).populate('IdPelanggan');
    },

    verifyKoneksiData: async (_, { id, status, alasanPenolakan, catatan }, { token }) => {
      verifyAdminToken(token);
      if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
        throw new Error('Status tidak valid. Gunakan: PENDING, APPROVED, atau REJECTED');
      }
      if (status === 'REJECTED' && !alasanPenolakan) {
        throw new Error('Alasan penolakan wajib diisi saat menolak pengajuan');
      }
      const before = await KoneksiData.findById(id, 'StatusPengajuan');
      const updateData: any = {
        StatusPengajuan: status,
        TanggalVerifikasi: status !== 'PENDING' ? new Date() : null,
        AlasanPenolakan: status === 'REJECTED' ? alasanPenolakan : null,
      };
      if (catatan !== undefined) updateData.catatan = catatan;

      const result = await KoneksiData.findByIdAndUpdate(id, updateData, { new: true })
        .populate('IdPelanggan');
      /* [auditlog nonaktif â€” uncomment untuk mengaktifkan kembali]
      await catatAuditLog({
        token,
        aksi: 'KONEKSI_VERIFY',
        resource: 'KoneksiData',
        resourceId: id,
        nilaiBefore: { StatusPengajuan: before?.StatusPengajuan },
        nilaiAfter: { StatusPengajuan: status, AlasanPenolakan: alasanPenolakan },
      }); */

      // Kirim notifikasi ke pelanggan â€” dibaca oleh Ahmad's user app
      const pelangganId = (result?.IdPelanggan as any)?._id?.toString()
        ?? (result?.IdPelanggan as any)?.toString();
      if (pelangganId) {
        if (status === 'APPROVED') {
          await notifikasiUntukPelanggan(
            pelangganId,
            'Pengajuan Sambungan Disetujui',
            'Selamat! Pengajuan sambungan air Anda telah disetujui. Tim teknisi akan segera menghubungi Anda untuk survei.',
            'INFORMASI',
            '/connection-data',
          );
        } else if (status === 'REJECTED') {
          await notifikasiUntukPelanggan(
            pelangganId,
            'Pengajuan Sambungan Ditolak',
            `Pengajuan sambungan air Anda ditolak. Alasan: ${alasanPenolakan || 'Tidak ada keterangan'}. Anda dapat mengajukan ulang setelah memperbaiki dokumen.`,
            'INFORMASI',
            '/connection-data',
          );
        }
      }

      return result;
    },

    updateKoneksiData: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      return await KoneksiData.findByIdAndUpdate(id, input, { new: true }).populate('IdPelanggan');
    },

    deleteKoneksiData: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      await KoneksiData.findByIdAndDelete(id);
      return { success: true, message: 'KoneksiData berhasil dihapus' };
    },
  },
};
