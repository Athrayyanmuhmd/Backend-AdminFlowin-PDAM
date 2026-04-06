// @ts-nocheck
// Field resolvers for schema/model field name mismatches and computed fields
import AdminAccount from '../../../models/AdminAccount.js';
import Technician from '../../../models/Technician.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import ConnectionData from '../../../models/ConnectionData.js';
import Report from '../../../models/Report.js';
import User from '../../../models/User.js';
import { getCache, setCache } from '../../../utils/redis.js';

export const fieldResolvers = {
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
    // Supports both new (idKelompokPelanggan) and old (kelompokPelangganId) field names
    idKelompokPelanggan: async (parent) => {
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
    // Supports both new (idKoneksiData) and old (connectionDataId) field names
    idKoneksiData: async (parent) => {
      const ref = parent.idKoneksiData || parent.connectionDataId;
      if (!ref) return null;
      const id = (typeof ref === 'object' && ref._id) ? ref._id : ref;
      return await ConnectionData.findById(id).populate('idPelanggan');
    },
  },

  Laporan: {
    status: (parent) => parent.status ?? 'Diajukan',
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k || (k.latitude == null && k.longitude == null)) return null;
      return { _id: parent._id, latitude: k.latitude ?? null, longitude: k.longitude ?? null };
    },
  },

  PekerjaanTeknisi: {
    idLaporan: async (parent) => {
      if (!parent.idLaporan) return null;
      if (typeof parent.idLaporan === 'object' && parent.idLaporan._id) return parent.idLaporan;
      return await Report.findById(parent.idLaporan).populate('idPengguna');
    },
  },

  Survei: {
    // Supports both new (latitude/longitude) and old (lat/long) field names
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k) return null;
      return { _id: parent._id, latitude: k.latitude ?? k.lat ?? null, longitude: k.longitude ?? k.long ?? null };
    },
    createdAt: (parent) => parent.createdAt ? new Date(parent.createdAt).toISOString() : null,
    updatedAt: (parent) => parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null,
  },

  RABConnection: {
    // Normalize Midtrans raw lowercase status → PascalCase enum (e.g. "settlement" → "Settlement")
    statusPembayaran: (parent) => {
      const v = parent.statusPembayaran;
      if (!v) return 'Pending';
      return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    },
    createdAt: (parent) => parent.createdAt ? new Date(parent.createdAt).toISOString() : null,
    updatedAt: (parent) => parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null,
  },

  PekerjaanTeknisi: {
    // Normalize old lowercase status values → PascalCase enum
    status: (parent) => {
      const map: Record<string, string> = {
        ditunda: 'Ditunda',
        ditugaskan: 'Ditugaskan',
        ditinjauadmin: 'DitinjauAdmin',
        sedangdikerjakan: 'SedangDikerjakan',
        selesai: 'Selesai',
        dibatalkan: 'Dibatalkan',
      };
      const v = parent.status;
      if (!v) return 'Ditugaskan';
      // If already PascalCase (from new data), return as-is
      const lower = v.toLowerCase().replace(/\s/g, '');
      return map[lower] ?? v;
    },
  },

  AuditLog: {
    nilaiBefore: (parent) => parent.nilaiBefore ? JSON.stringify(parent.nilaiBefore) : null,
    nilaiAfter: (parent) => parent.nilaiAfter ? JSON.stringify(parent.nilaiAfter) : null,
  },

  KoneksiData: {
    // Supports both new (idPelanggan) and old (userId) field names
    idPelanggan: async (parent) => {
      const ref = parent.idPelanggan || parent.userId;
      if (!ref) return null;
      let user;
      if (typeof ref === 'object' && ref._id) {
        user = ref;
      } else {
        user = await User.findById(ref);
      }
      if (!user) return null;
      return { _id: user._id, email: user.email, noHP: user.noHP, namaLengkap: user.namaLengkap, isVerified: user.isVerified, createdAt: user.createdAt, updatedAt: user.updatedAt };
    },
    // Serialize dates as ISO string agar frontend bisa parse dengan benar
    assignedAt: (parent) => parent.assignedAt ? new Date(parent.assignedAt).toISOString() : null,
    tanggalVerifikasi: (parent) => parent.tanggalVerifikasi ? new Date(parent.tanggalVerifikasi).toISOString() : null,
    tanggalVerifikasiTeknisi: (parent) => parent.tanggalVerifikasiTeknisi ? new Date(parent.tanggalVerifikasiTeknisi).toISOString() : null,
    createdAt: (parent) => parent.createdAt ? new Date(parent.createdAt).toISOString() : null,
    updatedAt: (parent) => parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null,
  },
};
