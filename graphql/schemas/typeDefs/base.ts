import { gql } from 'graphql-tag';

export const baseTypeDefs = gql`
  # ============================================
  # ENUMS — disesuaikan dengan Ahmad & Rafli
  # ============================================

  # Ahmad (flowin-backend/Laporan.ts)
  enum JenisLaporan {
    AIR_TIDAK_MENGALIR
    AIR_KERUH
    KEBOCORAN_PIPA
    METERAN_BERMASALAH
    KENDALA_LAINNYA
  }

  # Ahmad (flowin-backend/Laporan.ts) — status laporan pelanggan
  enum WorkStatusPelanggan {
    DIAJUKAN
    DITUNDA
    DITUGASKAN
    DITINJAU_ADMIN
    SEDANG_DIKERJAKAN
    SELESAI
    DIBATALKAN
  }

  # Ahmad (flowin-backend/Tagihan.ts) — status pembayaran tagihan
  enum PaymentStatus {
    PENDING
    SETTLEMENT
    CANCEL
    EXPIRE
    REFUND
    CHARGEBACK
    FRAUD
    MERGED
  }

  # Ahmad (flowin-backend/KoneksiData.ts) — status pengajuan sambungan
  enum StatusPengajuanEnum {
    PENDING
    APPROVED
    REJECTED
  }

  # Rafli (flowin-teknisi-graphql/auth.ts)
  enum DivisiTeknisi {
    perencanaan_teknik
    teknik_cabang
    pengawasan_teknik
  }

  # Admin-only enums (billing)
  enum EnumJenisBilling {
    normal
    denda
  }

  # Admin-only enums (notifikasi) — PEMBAYARAN sesuai Ahmad
  enum EnumKategori {
    PEMBAYARAN
    INFORMASI
    PERINGATAN
  }

  # ============================================
  # SHARED TYPES
  # ============================================

  # Pagination — digunakan oleh WorkOrder (Rafli) & laporan
  type PageInfo {
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  type Geolocation {
    _id: ID
    longitude: Float
    latitude: Float
  }

  input GeolocationInput {
    longitude: Float!
    latitude: Float!
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
  }

  type AuditLog {
    _id: ID!
    idAdmin: Admin
    namaAdmin: String!
    aksi: String!
    resource: String!
    resourceId: String
    nilaiBefore: String
    nilaiAfter: String
    catatan: String
    createdAt: String!
    updatedAt: String
  }

  # Root types — extended by domain files
  type Query {
    getAuditLogs(limit: Int, offset: Int, aksi: String, resource: String, startDate: String, endDate: String): [AuditLog!]!
  }

  type Mutation {
    _empty: Boolean
  }
`;
