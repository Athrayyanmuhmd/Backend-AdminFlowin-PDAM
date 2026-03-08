import { Request } from 'express';

// ─── GraphQL Context ───────────────────────────────────────────────────────────

export interface GraphQLContext {
  token: string;
  req: Request;
}

// ─── User Roles ────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'technician' | 'user';

// ─── ERD Enums ────────────────────────────────────────────────────────────────

export type StatusVerifikasi = 'Menunggu' | 'Disetujui' | 'Ditolak';
export type StatusPembayaran = 'Belum Bayar' | 'Lunas' | 'Terlambat';
export type KategoriNotifikasi = 'TRANSAKSI' | 'INFORMASI' | 'PERINGATAN';
export type StatusPekerjaan =
  | 'Menunggu'
  | 'Ditugaskan'
  | 'Sedang Dikerjakan'
  | 'Selesai'
  | 'Dibatalkan';

// ─── Auth Payloads ─────────────────────────────────────────────────────────────

export interface AdminJwtPayload {
  id: string;
  email: string;
  role: 'administrator' | 'supervisor' | 'operator';
}

export interface TechnicianJwtPayload {
  id: string;
  email: string;
  role: 'technician';
}

export interface UserJwtPayload {
  id: string;
  email: string;
  role: 'user';
}

export type JwtPayload = AdminJwtPayload | TechnicianJwtPayload | UserJwtPayload;
