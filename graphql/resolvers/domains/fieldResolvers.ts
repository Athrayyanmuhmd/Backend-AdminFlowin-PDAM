// @ts-nocheck
// Field resolvers for schema/model field name mismatches, date serialization, and enum normalization.
//
// RULE: Every GraphQL type with a `createdAt`/`updatedAt` (or any Date) field MUST have a
// field resolver here that calls `.toISOString()` — otherwise Mongoose Date objects are
// serialized via `.toString()` which produces locale-dependent strings that fail `new Date()`
// in some JS engines.
import AdminAccount from '../../../models/AdminAccount.js';
import Technician from '../../../models/Technician.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import ConnectionData from '../../../models/ConnectionData.js';
import Report from '../../../models/Report.js';
import User from '../../../models/User.js';
import { getCache, setCache } from '../../../utils/redis.js';

// Helper: normalize any Midtrans/legacy lowercase payment status → PascalCase enum
const normalizePaymentStatus = (v: string | undefined | null): string => {
  if (!v) return 'Pending';
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

// Helper: serialize a date field safely to ISO string
const iso = (v: any): string | null => (v ? new Date(v).toISOString() : null);

export const fieldResolvers = {
  // ─── Notifikasi ─────────────────────────────────────────────────────────────
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
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Meteran ────────────────────────────────────────────────────────────────
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
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Laporan ────────────────────────────────────────────────────────────────
  Laporan: {
    status: (parent) => parent.status ?? 'Diajukan',
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k || (k.latitude == null && k.longitude == null)) return null;
      return { _id: parent._id, latitude: k.latitude ?? null, longitude: k.longitude ?? null };
    },
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── PenyelesaianLaporan ─────────────────────────────────────────────────
  PenyelesaianLaporan: {
    tanggalSelesai: (parent) => iso(parent.tanggalSelesai),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Survei ─────────────────────────────────────────────────────────────────
  Survei: {
    // Supports both new (latitude/longitude) and old (lat/long) field names
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k) return null;
      return { _id: parent._id, latitude: k.latitude ?? k.lat ?? null, longitude: k.longitude ?? k.long ?? null };
    },
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── RABConnection ──────────────────────────────────────────────────────────
  RABConnection: {
    // Normalize Midtrans raw lowercase status → PascalCase enum (e.g. "settlement" → "Settlement")
    statusPembayaran: (parent) => normalizePaymentStatus(parent.statusPembayaran),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Tagihan ────────────────────────────────────────────────────────────────
  Tagihan: {
    statusPembayaran: (parent) => normalizePaymentStatus(parent.statusPembayaran),
    tanggalPembayaran: (parent) => iso(parent.tanggalPembayaran),
    tenggatWaktu: (parent) => iso(parent.tenggatWaktu),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── PekerjaanTeknisi ───────────────────────────────────────────────────────
  PekerjaanTeknisi: {
    idLaporan: async (parent) => {
      if (!parent.idLaporan) return null;
      if (typeof parent.idLaporan === 'object' && parent.idLaporan._id) return parent.idLaporan;
      return await Report.findById(parent.idLaporan).populate('idPengguna');
    },
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
      const lower = v.toLowerCase().replace(/\s/g, '');
      return map[lower] ?? v;
    },
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Pemasangan & pengawasan ─────────────────────────────────────────────────
  Pemasangan: {
    tanggalPemasangan: (parent) => iso(parent.tanggalPemasangan),
    tanggalVerifikasi: (parent) => iso(parent.tanggalVerifikasi),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  PengawasanPemasangan: {
    tanggalPengawasan: (parent) => iso(parent.tanggalPengawasan),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  PengawasanSetelahPemasangan: {
    tanggalPengawasan: (parent) => iso(parent.tanggalPengawasan),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Pengguna ───────────────────────────────────────────────────────────────
  Pengguna: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Admin & Teknisi ────────────────────────────────────────────────────────
  Admin: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  Teknisi: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── KelompokPelanggan ──────────────────────────────────────────────────────
  KelompokPelanggan: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── AuditLog ───────────────────────────────────────────────────────────────
  AuditLog: {
    nilaiBefore: (parent) => parent.nilaiBefore ? JSON.stringify(parent.nilaiBefore) : null,
    nilaiAfter: (parent) => parent.nilaiAfter ? JSON.stringify(parent.nilaiAfter) : null,
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── KoneksiData ────────────────────────────────────────────────────────────
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
      return { _id: user._id, email: user.email, noHP: user.noHP, namaLengkap: user.namaLengkap, isVerified: user.isVerified, createdAt: user.createdAt?.toISOString() ?? null, updatedAt: user.updatedAt?.toISOString() ?? null };
    },
    assignedAt: (parent) => iso(parent.assignedAt),
    tanggalVerifikasi: (parent) => iso(parent.tanggalVerifikasi),
    tanggalVerifikasiTeknisi: (parent) => iso(parent.tanggalVerifikasiTeknisi),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },
};
