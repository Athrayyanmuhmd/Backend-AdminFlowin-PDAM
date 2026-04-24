import { gql } from 'graphql-tag';

// Disesuaikan dengan Ahmad (flowin-backend/KoneksiData.ts)
// Field names PascalCase — sesuai Ahmad & Rafli

export const koneksiDataTypeDefs = gql`
  type KoneksiData {
    _id: ID!
    IdPelanggan: Pengguna
    StatusPengajuan: StatusPengajuanEnum!
    AlasanPenolakan: String
    TanggalVerifikasi: String
    NIK: String
    NIKUrl: String
    NoKK: String
    KKUrl: String
    IMB: String
    IMBUrl: String
    Alamat: String
    Kelurahan: String
    Kecamatan: String
    LuasBangunan: Float
    catatan: String
    createdAt: String
    updatedAt: String
  }

  input CreateKoneksiDataInput {
    IdPelanggan: ID!
    NIK: String!
    NIKUrl: String!
    NoKK: String!
    KKUrl: String!
    IMB: String!
    IMBUrl: String!
    Alamat: String!
    Kelurahan: String!
    Kecamatan: String!
    LuasBangunan: Float!
    catatan: String
  }

  input UpdateKoneksiDataInput {
    Alamat: String
    Kelurahan: String
    Kecamatan: String
    LuasBangunan: Float
    catatan: String
  }

  # Combined type for detail page — single round trip
  type DetailSambungan {
    koneksiData: KoneksiData!
    survei: Survei
    rab: RABConnection
    meteran: Meteran
    pemasangan: Pemasangan
    pengawasan: PengawasanPemasangan
    pengawasanSetelah: PengawasanSetelahPemasangan
    workOrders: [WorkOrder!]!
  }

  extend type Query {
    getKoneksiData(id: ID!): KoneksiData
    getKoneksiDataByPelanggan(idPelanggan: ID!): KoneksiData
    getAllKoneksiData(limit: Int, offset: Int): [KoneksiData!]!
    getPendingKoneksiData: [KoneksiData!]!
    getApprovedKoneksiData: [KoneksiData!]!
    getRejectedKoneksiData: [KoneksiData!]!
    getDetailSambungan(id: ID!): DetailSambungan
  }

  extend type Mutation {
    createKoneksiData(input: CreateKoneksiDataInput!): KoneksiData!
    # Admin: setujui (APPROVED) atau tolak (REJECTED) pengajuan sambungan
    verifyKoneksiData(id: ID!, status: StatusPengajuanEnum!, alasanPenolakan: String, catatan: String): KoneksiData!
    updateKoneksiData(id: ID!, input: UpdateKoneksiDataInput!): KoneksiData!
    deleteKoneksiData(id: ID!): DeleteResponse!
  }
`;
