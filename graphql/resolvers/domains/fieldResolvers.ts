// @ts-nocheck
// Field resolvers — field names HARUS cocok persis dengan nama di GraphQL schema.
// Schema sudah PascalCase sesuai Ahmad/Rafli, jadi semua FK field resolver ikut PascalCase.
import AdminAccount from '../../../models/AdminAccount.js';
import Technician from '../../../models/Technician.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import ConnectionData from '../../../models/ConnectionData.js';
import Report from '../../../models/Report.js';
import User from '../../../models/User.js';
import GeoLokasi from '../../../models/GeoLokasi.js';
import { getCache, setCache } from '../../../utils/redis.js';

// Helper: serialize date → ISO string (null-safe)
const iso = (v: any): string | null => (v ? new Date(v).toISOString() : null);

// Helper: safe _id → string conversion
// Handles ObjectId (.toHexString), Buffer (UUID binary from MongoDB), and plain strings
const toId = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val.toHexString === 'function') return val.toHexString(); // ObjectId
  if (Buffer.isBuffer(val)) return val.toString('hex');               // Binary/Buffer
  // BSON Binary serialized as {type:'Buffer',data:[...]} (e.g. lean() on some drivers)
  if (val && val.type === 'Buffer' && Array.isArray(val.data)) return Buffer.from(val.data).toString('hex');
  return String(val);
};

// Helper: safe ISO — handles epoch-ms strings (e.g. "1718000000000") from Rafli backend
// new Date("1718000000000") → Invalid Date in Node.js; must convert to Number first
const safeIso = (v: any): string | null => {
  if (!v) return null;
  try {
    if (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) {
      const d = new Date(Number(v));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

// Helper: normalize status pembayaran ke UPPERCASE enum (DB stores lowercase, GQL expects UPPERCASE)
const normalizePaymentStatus = (v: string | undefined | null): string => {
  if (!v) return 'PENDING';
  return v.toUpperCase();
};

export const fieldResolvers = {
  // ─── Notifikasi — DB PascalCase → GQL camelCase ──────────────────────────────
  Notifikasi: {
    idAdmin: async (parent) => {
      const ref = parent.IdAdmin || parent.idAdmin;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      return await AdminAccount.findById(ref);
    },
    idTeknisi: async (parent) => {
      const ref = parent.IdTeknisi || parent.idTeknisi;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      return await Technician.findById(ref);
    },
    idPelanggan: async (parent) => {
      const ref = parent.IdPelanggan || parent.idPelanggan;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      return await User.findById(ref);
    },
    judul: (parent) => parent.Judul || parent.judul,
    pesan: (parent) => parent.Pesan || parent.pesan,
    kategori: (parent) => parent.Kategori || parent.kategori,
    link: (parent) => parent.Link || parent.link || null,
    // isRead: dokumen dari Ahmad tidak punya field ini → default false
    isRead: (parent) => parent.isRead ?? false,
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Meteran — FK fields PascalCase sesuai schema ────────────────────────────
  Meteran: {
    IdKelompokPelanggan: async (parent) => {
      // Mendukung field baru (IdKelompokPelanggan) dan lama (idKelompokPelanggan)
      const ref = parent.IdKelompokPelanggan || parent.idKelompokPelanggan || parent.kelompokPelangganId;
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
    IdKoneksiData: async (parent) => {
      // Mendukung field baru (IdKoneksiData) dan lama (idKoneksiData)
      const ref = parent.IdKoneksiData || parent.idKoneksiData || parent.connectionDataId;
      if (!ref) return null;
      const id = (typeof ref === 'object' && ref._id) ? ref._id : ref;
      return await ConnectionData.findById(id).populate('IdPelanggan');
    },
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Laporan — DB PascalCase → GQL mapping ──────────────────────────────────
  Laporan: {
    // Explicit _id converter: some Ahmad docs use UUID Binary _id → would throw "ID cannot represent Buffer"
    _id: (parent) => toId(parent._id),
    idPengguna: async (parent) => {
      const ref = parent.IdPengguna || parent.idPengguna;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      return await User.findById(ref);
    },
    namaLaporan: (parent) => parent.NamaLaporan || parent.namaLaporan,
    masalah: (parent) => parent.Masalah || parent.masalah,
    alamat: (parent) => parent.Alamat || parent.alamat,
    imageURL: (parent) => parent.ImageURL || parent.imageURL || [],
    jenisLaporan: (parent) => {
      const v = parent.JenisLaporan || parent.jenisLaporan;
      if (!v) return null;
      // Map Ahmad DB PascalCase → GQL SCREAMING_SNAKE_CASE
      const map: Record<string, string> = {
        AirTidakMengalir: 'AIR_TIDAK_MENGALIR',
        AirKeruh: 'AIR_KERUH',
        KebocoranPipa: 'KEBOCORAN_PIPA',
        MeteranBermasalah: 'METERAN_BERMASALAH',
        KendalaLainnya: 'KENDALA_LAINNYA',
        // Already GQL format (idempotent)
        AIR_TIDAK_MENGALIR: 'AIR_TIDAK_MENGALIR',
        AIR_KERUH: 'AIR_KERUH',
        KEBOCORAN_PIPA: 'KEBOCORAN_PIPA',
        METERAN_BERMASALAH: 'METERAN_BERMASALAH',
        KENDALA_LAINNYA: 'KENDALA_LAINNYA',
      };
      return map[v] ?? 'KENDALA_LAINNYA'; // unknown → fallback to safe enum value
    },
    catatan: (parent) => parent.Catatan || parent.catatan || null,
    status: (parent) => {
      const v = parent.Status || parent.status;
      if (!v) return 'DIAJUKAN';
      // Map Ahmad DB PascalCase → GQL SCREAMING_SNAKE_CASE
      // Includes legacy Ahmad values (Diajukan, ProsesPerbaikan) from older data
      const map: Record<string, string> = {
        Diajukan: 'DIAJUKAN',
        Ditunda: 'DIAJUKAN',   // legacy — Ditunda diperlakukan sama dengan Diajukan
        Ditugaskan: 'DITUGASKAN',
        DitinjauAdmin: 'DITINJAU_ADMIN',
        SedangDikerjakan: 'SEDANG_DIKERJAKAN',
        ProsesPerbaikan: 'SEDANG_DIKERJAKAN', // legacy Ahmad — in-progress
        Selesai: 'SELESAI',
        Dibatalkan: 'DIBATALKAN',
        // Also handle if already in GQL format (idempotent)
        DIAJUKAN: 'DIAJUKAN',
        DITUGASKAN: 'DITUGASKAN',
        DITINJAU_ADMIN: 'DITINJAU_ADMIN',
        SEDANG_DIKERJAKAN: 'SEDANG_DIKERJAKAN',
        SELESAI: 'SELESAI',
        DIBATALKAN: 'DIBATALKAN',
      };
      return map[v] ?? 'DIAJUKAN'; // unknown status → default DIAJUKAN
    },
    koordinat: async (parent) => {
      // Koordinat is ObjectId ref to GeoLokasi model
      const ref = parent.Koordinat || parent.koordinat;
      if (!ref) return null;
      if (typeof ref === 'object' && ref.Latitude != null) {
        // Convert _id to string — Buffer/Binary from MongoDB would cause "ID cannot represent Buffer" error
        return { _id: ref._id?.toString() ?? null, latitude: ref.Latitude, longitude: ref.Longitude };
      }
      const geo = await GeoLokasi.findById(ref);
      if (!geo) return null;
      return { _id: geo._id?.toString() ?? null, latitude: geo.Latitude, longitude: geo.Longitude };
    },
    idTeknisi: async (parent) => {
      const ref = parent.IdTeknisi || parent.idTeknisi;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      return await Technician.findById(ref);
    },
    catatanAdmin: (parent) => parent.CatatanAdmin || parent.catatanAdmin || null,
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── PenyelesaianLaporan ──────────────────────────────────────────────────────
  PenyelesaianLaporan: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Survei ───────────────────────────────────────────────────────────────────
  Survei: {
    idKoneksiData: async (parent) => {
      const ref = parent.idKoneksiData;
      if (!ref) return null;
      if (typeof ref === 'object' && ref._id) return ref;
      return await ConnectionData.findById(ref).populate('IdPelanggan').lean();
    },
    koordinat: (parent) => {
      const k = parent.koordinat;
      if (!k) return null;
      return {
        longitude: k.longitude ?? k.long ?? null,
        latitude: k.latitude ?? k.lat ?? null,
      };
    },
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── RABConnection ────────────────────────────────────────────────────────────
  RABConnection: {
    idKoneksiData: async (parent) => {
      const ref = parent.idKoneksiData;
      if (!ref) return null;
      // Already populated as Mongoose document — return as-is
      if (typeof ref === 'object' && ref._id) return ref;
      // Fallback: fetch from DB, populate IdPelanggan so KoneksiData.IdPelanggan resolver has a User object
      return await ConnectionData.findById(ref).populate('IdPelanggan').lean();
    },
    statusPembayaran: (parent) => normalizePaymentStatus(parent.statusPembayaran),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Tagihan — FK & date fields PascalCase sesuai schema ────────────────────
  // Field resolver juga normalize field lama (camelCase) dari dokumen Ahmad yg lebih lama
  Tagihan: {
    Periode: (parent) => parent.Periode || parent.periode || null,
    PenggunaanSebelum: (parent) => parent.PenggunaanSebelum ?? parent.penggunaanSebelum ?? 0,
    PenggunaanSekarang: (parent) => parent.PenggunaanSekarang ?? parent.penggunaanSekarang ?? 0,
    TotalPemakaian: (parent) => parent.TotalPemakaian ?? parent.totalPemakaian ?? 0,
    Biaya: (parent) => parent.Biaya ?? parent.biaya ?? 0,
    BiayaBeban: (parent) => parent.BiayaBeban ?? parent.biayaBeban ?? 0,
    TotalBiaya: (parent) => parent.TotalBiaya ?? parent.totalBiaya ?? 0,
    Menunggak: (parent) => parent.Menunggak ?? parent.menunggak ?? false,
    Denda: (parent) => parent.Denda ?? parent.denda ?? 0,
    MetodePembayaran: (parent) => parent.MetodePembayaran || parent.metodePembayaran || null,
    StatusPembayaran: (parent) =>
      normalizePaymentStatus(parent.StatusPembayaran || parent.statusPembayaran),
    TanggalPembayaran: (parent) =>
      iso(parent.TanggalPembayaran || parent.tanggalPembayaran),
    TenggatWaktu: (parent) =>
      iso(parent.TenggatWaktu || parent.tenggatWaktu),
    Catatan: (parent) => parent.Catatan || parent.catatan || null,
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Pengguna ──────────────────────────────────────────────────────────────────
  Pengguna: {
    _id: (parent) => toId(parent._id),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Admin & Teknisi ───────────────────────────────────────────────────────────
  Admin: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  Teknisi: {
    // `id` field: bson v6 ObjectId.id returns a raw Buffer (12 bytes). If the default
    // resolver reads parent.id from a plain ObjectId object, Buffer.toJSON() returns
    // { type: "Buffer", data: [...] } which the ID scalar rejects. Use toId() to normalize.
    id: (parent) => toId(parent.id) ?? toId(parent._id) ?? null,
    // namaLengkap: String! — non-nullable; fallback to '—' to prevent null propagation crash.
    // Some Teknisi documents from Rafli backend may use different casing or missing values.
    namaLengkap: (parent) => parent.namaLengkap ?? parent.NamaLengkap ?? parent.nama ?? '—',
    nip: (parent) => parent.nip ?? parent.NIP ?? parent.Nip ?? null,
    email: (parent) => parent.email ?? parent.Email ?? null,
    noHp: (parent) => parent.noHp ?? parent.noHP ?? parent.NoHp ?? parent.no_hp ?? null,
    divisi: (parent) => parent.divisi ?? parent.Divisi ?? null,
    isActive: (parent) => parent.isActive ?? null,
    // safeIso: Rafli serializes Date via String(epochMs) → "1718000000000"
    createdAt: (parent) => safeIso(parent.createdAt),
    updatedAt: (parent) => safeIso(parent.updatedAt),
  },

  // ─── KelompokPelanggan ────────────────────────────────────────────────────────
  KelompokPelanggan: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── AuditLog ─────────────────────────────────────────────────────────────────
  AuditLog: {
    nilaiBefore: (parent) => (parent.nilaiBefore ? JSON.stringify(parent.nilaiBefore) : null),
    nilaiAfter: (parent) => (parent.nilaiAfter ? JSON.stringify(parent.nilaiAfter) : null),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── KoneksiData — FK fields PascalCase sesuai Ahmad ─────────────────────────
  // Collection koneksidatas memiliki DUA format: lama (camelCase) dan baru (PascalCase)
  // Setiap field resolver menormalisasi keduanya agar frontend tidak mendapat null/undefined.
  KoneksiData: {
    IdPelanggan: async (parent) => {
      // Mendukung field baru (IdPelanggan) dan lama (idPelanggan / userId)
      const ref = parent.IdPelanggan || parent.idPelanggan || parent.userId;
      if (!ref) return null;
      let user;
      if (typeof ref === 'object' && ref._id) {
        user = ref;
      } else {
        user = await User.findById(ref);
      }
      if (!user) return null;
      return {
        _id: user._id,
        email: user.email,
        noHP: user.noHP,
        namaLengkap: user.namaLengkap,
        isVerified: user.isVerified,
        createdAt: user.createdAt?.toISOString() ?? null,
        updatedAt: user.updatedAt?.toISOString() ?? null,
      };
    },
    // Normalize: new format PascalCase takes priority, fallback to old camelCase
    StatusPengajuan: (parent) => {
      const v = parent.StatusPengajuan || parent.statusVerifikasi || parent.statusPengajuan;
      if (!v) return 'PENDING';
      // Old format uses: 'menunggu' → PENDING, 'disetujui' → APPROVED, 'ditolak' → REJECTED
      const map: Record<string, string> = {
        menunggu: 'PENDING',
        disetujui: 'APPROVED',
        ditolak: 'REJECTED',
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
      };
      return map[v] ?? v.toUpperCase();
    },
    AlasanPenolakan: (parent) =>
      parent.AlasanPenolakan ?? parent.alasanPenolakan ?? null,
    NIK: (parent) => parent.NIK || parent.nik || null,
    NIKUrl: (parent) => parent.NIKUrl || parent.nikUrl || null,
    NoKK: (parent) => parent.NoKK || parent.noKK || null,
    KKUrl: (parent) => parent.KKUrl || parent.kkUrl || null,
    IMB: (parent) => parent.IMB || parent.imb || null,
    IMBUrl: (parent) => parent.IMBUrl || parent.imbUrl || null,
    Alamat: (parent) => parent.Alamat || parent.alamat || null,
    Kelurahan: (parent) => parent.Kelurahan || parent.kelurahan || null,
    Kecamatan: (parent) => parent.Kecamatan || parent.kecamatan || null,
    LuasBangunan: (parent) =>
      parent.LuasBangunan ?? parent.luasBangunan ?? null,
    catatan: (parent) => parent.catatan ?? null,
    TanggalVerifikasi: (parent) =>
      iso(parent.TanggalVerifikasi || parent.tanggalVerifikasi),
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  // ─── Pemasangan & pengawasan ──────────────────────────────────────────────────
  Pemasangan: {
    idKoneksiData: async (parent) => {
      const ref = parent.idKoneksiData;
      if (!ref) return null;
      // Already populated (deep populate from resolver) — return as-is
      if (typeof ref === 'object' && ref._id) return ref;
      // Fallback: fetch and deep-populate IdPelanggan
      return await ConnectionData.findById(ref).populate('IdPelanggan').lean();
    },
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  PengawasanPemasangan: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },

  PengawasanSetelahPemasangan: {
    createdAt: (parent) => iso(parent.createdAt),
    updatedAt: (parent) => iso(parent.updatedAt),
  },
};
