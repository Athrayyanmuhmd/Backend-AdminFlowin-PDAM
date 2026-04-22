// @ts-nocheck
import Report from '../../../models/Report.js';
import PenyelesaianLaporan from '../../../models/PenyelesaianLaporan.js';
import Technician from '../../../models/Technician.js';
import { verifyAdminToken, notifikasiSemuaAdmin, notifikasiUntukPelanggan } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

// Disesuaikan dengan Ahmad — Report model fields PascalCase (IdPengguna, Status, etc.)
// DB status values: Diajukan, Ditunda, Ditugaskan, DitinjauAdmin, SedangDikerjakan, Selesai, Dibatalkan
// GQL enum maps these via fieldResolvers (DITUNDA, DITUGASKAN, etc.)

// Map GQL SCREAMING_SNAKE status → DB PascalCase
const statusGqlToDb: Record<string, string> = {
  DIAJUKAN: 'Diajukan',
  DITUNDA: 'Ditunda',
  DITUGASKAN: 'Ditugaskan',
  DITINJAU_ADMIN: 'DitinjauAdmin',
  SEDANG_DIKERJAKAN: 'SedangDikerjakan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

export const laporanResolvers = {
  Query: {
    getLaporan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.findById(id).populate('IdPengguna').populate('IdTeknisi');
    },

    getAllLaporan: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, 500))
        .populate('IdPengguna')
        .populate('IdTeknisi');
    },

    getLaporanByStatus: async (_, { status }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const dbStatus = statusGqlToDb[status] || status;
      return await Report.find({ Status: dbStatus })
        .populate('IdPengguna')
        .populate('IdTeknisi');
    },

    getLaporanByPelanggan: async (_, { idPelanggan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await Report.find({ IdPengguna: idPelanggan })
        .populate('IdPengguna')
        .populate('IdTeknisi');
    },

    getPenyelesaianLaporan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.findById(id).populate('idLaporan');
    },

    getPenyelesaianLaporanByLaporan: async (_, { idLaporan }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find({ idLaporan }).sort({ createdAt: -1 });
    },

    getAllPenyelesaianLaporan: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await PenyelesaianLaporan.find()
        .limit(500)
        .populate('idLaporan')
        .sort({ createdAt: -1 });
    },
  },

  Mutation: {
    updateLaporanStatus: async (_, { id, status, idTeknisi, catatanAdmin }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const dbStatus = statusGqlToDb[status] || status;

      // Build update payload
      const updatePayload: Record<string, any> = { Status: dbStatus };
      if (idTeknisi) updatePayload.IdTeknisi = idTeknisi;
      if (catatanAdmin !== undefined) updatePayload.CatatanAdmin = catatanAdmin;

      const updated = await Report.findByIdAndUpdate(id, updatePayload, { new: true })
        .populate('IdPengguna')
        .populate('IdTeknisi');

      if (updated) {
        const idPelanggan = (updated.IdPengguna as any)?._id?.toString() ?? updated.IdPengguna?.toString();
        const namaTeknisi = (updated.IdTeknisi as any)?.namaLengkap ?? 'teknisi';

        if (dbStatus === 'Ditugaskan') {
          // Notifikasi ke pelanggan — sertakan nama teknisi jika ada
          if (idPelanggan) {
            await notifikasiUntukPelanggan(
              idPelanggan,
              'Laporan Sedang Ditangani',
              `Laporan "${updated.NamaLaporan}" Anda telah ditugaskan kepada ${namaTeknisi}. Tim kami akan segera menindaklanjuti.`,
              'INFORMASI',
              '/laporan',
            );
          }
        } else if (dbStatus === 'Selesai') {
          if (idPelanggan) {
            await notifikasiUntukPelanggan(
              idPelanggan,
              'Laporan Selesai',
              `Laporan "${updated.NamaLaporan}" Anda telah diselesaikan. Terima kasih telah menghubungi kami.`,
              'INFORMASI',
              '/laporan',
            );
          }
        } else if (dbStatus === 'Dibatalkan') {
          if (idPelanggan) {
            await notifikasiUntukPelanggan(
              idPelanggan,
              'Laporan Dibatalkan',
              `Laporan "${updated.NamaLaporan}" Anda telah dibatalkan oleh admin.`,
              'INFORMASI',
              '/laporan',
            );
          }
        }
      }
      return updated;
    },

    createPenyelesaianLaporan: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      const penyelesaian = new PenyelesaianLaporan(input);
      const saved = await penyelesaian.save();
      if (input.idLaporan) {
        const laporan = await Report.findByIdAndUpdate(
          input.idLaporan,
          { Status: 'Selesai' },
          { new: true },
        ).populate('IdPengguna');

        // Kirim notifikasi ke pelanggan yang melapor
        const idPelanggan = (laporan?.IdPengguna as any)?._id?.toString()
          ?? laporan?.IdPengguna?.toString();
        if (idPelanggan) {
          await notifikasiUntukPelanggan(
            idPelanggan,
            'Laporan Anda Telah Diselesaikan',
            `Laporan "${laporan?.NamaLaporan || 'Anda'}" telah diselesaikan oleh tim teknisi kami. Terima kasih telah menghubungi kami.`,
            'INFORMASI',
            '/laporan',
          );
        }
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
      return { success: true, message: 'Penyelesaian laporan berhasil dihapus' };
    },
  },
};
