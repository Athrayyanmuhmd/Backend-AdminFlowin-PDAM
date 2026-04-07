import { gql } from 'graphql-tag';

export const koneksiDataTypeDefs = gql`
  type KoneksiData {
    _id: ID!
    idPelanggan: Pengguna
    statusVerifikasi: String
    catatan: String
    alasanPenolakan: String
    tanggalVerifikasi: String
    NIK: String
    NIKUrl: String
    noKK: String
    KKUrl: String
    IMB: String
    IMBUrl: String
    alamat: String
    kelurahan: String
    kecamatan: String
    luasBangunan: Float
    idTeknisi: Teknisi
    assignedAt: String
    assignedBy: Admin
    createdAt: String
    updatedAt: String
  }

  input UpdateKoneksiDataInput {
    statusVerifikasi: Boolean
    alamat: String
    kelurahan: String
    kecamatan: String
    luasBangunan: Float
  }

  extend type Query {
    getKoneksiData(id: ID!): KoneksiData
    getAllKoneksiData(limit: Int, offset: Int): [KoneksiData!]!
    getPendingKoneksiData: [KoneksiData!]!
    getVerifiedKoneksiData: [KoneksiData!]!
    getDitolakKoneksiData: [KoneksiData!]!
  }

  extend type Mutation {
    createKoneksiData(
      idPelanggan: ID
      NIK: String
      NIKUrl: String
      noKK: String
      KKUrl: String
      IMB: String
      IMBUrl: String
      alamat: String
      kelurahan: String
      kecamatan: String
      luasBangunan: Float
    ): KoneksiData!
    verifyKoneksiData(id: ID!, status: String!, catatan: String, alasanPenolakan: String): KoneksiData!
    updateKoneksiData(id: ID!, input: UpdateKoneksiDataInput!): KoneksiData!
    deleteKoneksiData(id: ID!): Boolean!
    assignTeknisiToKoneksi(id: ID!, technicianId: ID!): KoneksiData!
    unassignTeknisiFromKoneksi(id: ID!): KoneksiData!
  }
`;
