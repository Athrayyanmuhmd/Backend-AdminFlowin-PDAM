import { gql } from 'graphql-tag';

export const baseTypeDefs = gql`
  # ============================================
  # ENUMS
  # ============================================

  enum EnumJenisLaporan {
    AirTidakMengalir
    AirKeruh
    KebocoranPipa
    MeteranBermasalah
    KendalaLainnya
  }

  enum EnumWorkStatusPelanggan {
    Diajukan
    ProsesPerbaikan
    Selesai
  }

  enum EnumWorkStatus {
    Ditunda
    Ditugaskan
    DitinjauAdmin
    SedangDikerjakan
    Selesai
    Dibatalkan
  }

  enum EnumDivisiTeknisi {
    perencanaan_teknik
    teknik_cabang
    pengawasan_teknik
  }

  enum EnumPaymentStatus {
    Pending
    Settlement
    Cancel
    Expire
    Refund
    Chargeback
    Fraud
    Merged
  }

  enum EnumJenisBilling {
    normal
    denda
  }

  enum EnumKategori {
    Pembayaran
    Informasi
    Peringatan
  }

  # ============================================
  # SHARED TYPES
  # ============================================

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
