/**
 * Canonical field mappers untuk data yang masuk dari Ahmad (pelanggan) dan Rafli (teknisi).
 *
 * Setiap mapper menerima raw payload dari sistem eksternal dan mengembalikan
 * bentuk canonical yang dipakai admin. Validasi dan transform sesuai
 * docs/INTEGRATION_FIELD_MAPPING.md.
 *
 * Penggunaan:
 *   import { mapPelanggan, mapKoneksiData, mapWorkOrder } from '../utils/integrationMappers.js';
 *   const canonical = mapPelanggan(rawFromAhmad);
 */

import { parseFlexDate } from './dateParser.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function trim(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v).trim() || null;
}

function normalizePhone(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s/g, '');
  if (!s) return null;
  // Normalisasi prefix: 08xx, 628xx, +628xx → +628xx
  if (s.startsWith('+62')) return s;
  if (s.startsWith('62')) return '+' + s;
  if (s.startsWith('0')) return '+62' + s.slice(1);
  return s;
}

function toLowerTrim(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v).toLowerCase().trim() || null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

// ─── Domain: Pengguna (Ahmad → Admin) ─────────────────────────────────────────

export interface CanonicalPengguna {
  namaLengkap: string | null;
  email: string | null;
  noHP: string | null;
  googleId?: string | null;
  isVerified: boolean;
  profilePicture?: string | null;
  authProvider?: string | null;
}

export function mapPelanggan(raw: Record<string, any>): CanonicalPengguna {
  return {
    namaLengkap: trim(raw.namaLengkap),
    email: toLowerTrim(raw.email),
    // Ahmad pakai noHP, Rafli pakai noHp — canonical: noHP
    noHP: normalizePhone(raw.noHP ?? raw.noHp ?? null),
    googleId: raw.googleId ?? null,
    isVerified: Boolean(raw.isVerified),
    profilePicture: raw.profilePicture ?? null,
    authProvider: raw.authProvider ?? null,
  };
}

// ─── Domain: KoneksiData (Ahmad → Admin) ──────────────────────────────────────

export interface CanonicalKoneksiData {
  IdPelanggan: string | null;
  StatusPengajuan: 'PENDING' | 'APPROVED' | 'REJECTED';
  AlasanPenolakan: string | null;
  TanggalVerifikasi: Date | null;
  NIK: string | null;
  NIKUrl: string | null;
  NoKK: string | null;
  KKUrl: string | null;
  IMB: string | null;
  IMBUrl: string | null;
  Alamat: string | null;
  Kelurahan: string | null;
  Kecamatan: string | null;
  LuasBangunan: number | null;
}

const STATUS_PENGAJUAN_MAP: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
  PENDING: 'PENDING', pending: 'PENDING', menunggu: 'PENDING',
  APPROVED: 'APPROVED', approved: 'APPROVED', disetujui: 'APPROVED',
  REJECTED: 'REJECTED', rejected: 'REJECTED', ditolak: 'REJECTED',
};

export function mapKoneksiData(raw: Record<string, any>): CanonicalKoneksiData {
  const statusRaw = raw.StatusPengajuan ?? raw.statusPengajuan ?? raw.statusVerifikasi ?? 'PENDING';
  return {
    IdPelanggan: raw.IdPelanggan?.toString() ?? raw.idPelanggan?.toString() ?? null,
    StatusPengajuan: STATUS_PENGAJUAN_MAP[statusRaw] ?? 'PENDING',
    AlasanPenolakan: trim(raw.AlasanPenolakan ?? raw.alasanPenolakan),
    TanggalVerifikasi: parseFlexDate(raw.TanggalVerifikasi ?? raw.tanggalVerifikasi),
    NIK: trim(raw.NIK ?? raw.nik),
    NIKUrl: raw.NIKUrl ?? raw.nikUrl ?? null,
    NoKK: trim(raw.NoKK ?? raw.noKK),
    KKUrl: raw.KKUrl ?? raw.kkUrl ?? null,
    IMB: trim(raw.IMB ?? raw.imb),
    IMBUrl: raw.IMBUrl ?? raw.imbUrl ?? null,
    Alamat: trim(raw.Alamat ?? raw.alamat),
    Kelurahan: trim(raw.Kelurahan ?? raw.kelurahan),
    Kecamatan: trim(raw.Kecamatan ?? raw.kecamatan),
    LuasBangunan: toNumber(raw.LuasBangunan ?? raw.luasBangunan),
  };
}

// ─── Domain: Survei (Rafli → Admin) ───────────────────────────────────────────

export interface CanonicalSurvei {
  idKoneksiData: string | null;
  idTeknisi: string | null;
  urlJaringan: string | null;
  diameterPipa: string | null;
  urlPosisiBak: string | null;
  posisiMeteran: string | null;
  jumlahPenghuni: number | null;  // Number — BUKAN String
  catatan: string | null;
}

export function mapSurvei(raw: Record<string, any>): CanonicalSurvei {
  return {
    idKoneksiData: raw.idKoneksiData?.toString() ?? raw.IdKoneksiData?.toString() ?? null,
    idTeknisi: raw.idTeknisi?.toString() ?? raw.IdTeknisi?.toString() ?? null,
    urlJaringan: raw.urlJaringan ?? raw.UrlJaringan ?? null,
    diameterPipa: trim(raw.diameterPipa),
    urlPosisiBak: raw.urlPosisiBak ?? raw.UrlPosisiBak ?? null,
    posisiMeteran: trim(raw.posisiMeteran ?? raw.PosisiMeteran),
    // jumlahPenghuni harus Number — parseFloat handles "3" → 3
    jumlahPenghuni: toNumber(raw.jumlahPenghuni),
    catatan: trim(raw.catatan),
  };
}

// ─── Domain: RAB (Rafli/Ahmad → Admin) ────────────────────────────────────────

export interface CanonicalRab {
  idKoneksiData: string | null;
  totalBiaya: number | null;
  statusPembayaran: string;
  orderId: string | null;
  paymentUrl: string | null;
  urlRab: string | null;
}

export function mapRab(raw: Record<string, any>): CanonicalRab {
  return {
    idKoneksiData: raw.idKoneksiData?.toString() ?? raw.IdKoneksiData?.toString() ?? null,
    totalBiaya: toNumber(raw.totalBiaya ?? raw.TotalBiaya),
    statusPembayaran: (raw.statusPembayaran ?? raw.StatusPembayaran ?? 'pending').toLowerCase(),
    orderId: trim(raw.orderId ?? raw.OrderID),
    paymentUrl: raw.paymentUrl ?? raw.PaymentURL ?? null,
    urlRab: raw.urlRab ?? null,
  };
}

// ─── Domain: WorkOrder (Rafli → Admin) ────────────────────────────────────────

export interface CanonicalWorkOrder {
  id: string | null;
  idKoneksiData: string | null;
  jenisPekerjaan: string | null;
  status: string | null;
  statusRespon: string | null;
  statusTim: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  teknisiPenanggungJawab: { id: string; namaLengkap: string } | null;
}

export function mapWorkOrder(raw: Record<string, any>): CanonicalWorkOrder {
  return {
    id: raw.id?.toString() ?? null,
    idKoneksiData: raw.idKoneksiData?.toString() ?? null,
    jenisPekerjaan: raw.jenisPekerjaan ?? null,
    status: raw.status ?? null,
    statusRespon: raw.statusRespon ?? null,
    statusTim: raw.statusTim ?? null,
    // Rafli DateTime scalar bisa ISO string ATAU epoch-ms — wajib parseFlexDate
    createdAt: parseFlexDate(raw.createdAt),
    updatedAt: parseFlexDate(raw.updatedAt),
    teknisiPenanggungJawab: raw.teknisiPenanggungJawab
      ? {
          id: raw.teknisiPenanggungJawab.id?.toString(),
          namaLengkap: trim(raw.teknisiPenanggungJawab.namaLengkap) ?? '',
        }
      : null,
  };
}

// ─── Domain: Tagihan (Ahmad → Admin) ──────────────────────────────────────────

export interface CanonicalTagihan {
  IdMeteran: string | null;
  Periode: string | null;
  TotalBiaya: number | null;
  statusPembayaran: string;
  TenggatWaktu: Date | null;
}

export function mapTagihan(raw: Record<string, any>): CanonicalTagihan {
  return {
    IdMeteran: raw.IdMeteran?.toString() ?? raw.idMeteran?.toString() ?? null,
    Periode: trim(raw.Periode ?? raw.periode),
    TotalBiaya: toNumber(raw.TotalBiaya ?? raw.totalBiaya),
    statusPembayaran: (raw.statusPembayaran ?? raw.StatusPembayaran ?? 'pending').toLowerCase(),
    TenggatWaktu: parseFlexDate(raw.TenggatWaktu ?? raw.tenggatWaktu),
  };
}

// ─── Domain: Laporan (Ahmad → Admin) ──────────────────────────────────────────

export interface CanonicalLaporan {
  IdPengguna: string | null;
  NamaLaporan: string | null;
  Masalah: string | null;
  Alamat: string | null;
  // Status dan JenisLaporan di-map oleh fieldResolvers.ts (DB PascalCase → GQL SCREAMING_SNAKE)
}

export function mapLaporan(raw: Record<string, any>): CanonicalLaporan {
  return {
    IdPengguna: raw.IdPengguna?.toString() ?? raw.idPengguna?.toString() ?? null,
    NamaLaporan: trim(raw.NamaLaporan ?? raw.namaLaporan),
    Masalah: trim(raw.Masalah ?? raw.masalah),
    Alamat: trim(raw.Alamat ?? raw.alamat),
  };
}
