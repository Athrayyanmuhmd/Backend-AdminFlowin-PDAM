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

  extend type Query {
    getKoneksiData(id: ID!): KoneksiData
    getAllKoneksiData(limit: Int, offset: Int): [KoneksiData!]!
    getPendingKoneksiData: [KoneksiData!]!
    getApprovedKoneksiData: [KoneksiData!]!
    getRejectedKoneksiData: [KoneksiData!]!
  }

  extend type Mutation {
    createKoneksiData(input: CreateKoneksiDataInput!): KoneksiData!
    # Admin: setujui (APPROVED) atau tolak (REJECTED) pengajuan sambungan
    verifyKoneksiData(id: ID!, status: StatusPengajuanEnum!, alasanPenolakan: String, catatan: String): KoneksiData!
    updateKoneksiData(id: ID!, input: UpdateKoneksiDataInput!): KoneksiData!
    deleteKoneksiData(id: ID!): DeleteResponse!
  }
`;
