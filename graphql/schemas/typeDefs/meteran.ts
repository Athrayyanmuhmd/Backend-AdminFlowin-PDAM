import { gql } from 'graphql-tag';

// Disesuaikan dengan Ahmad (flowin-backend/Meter.ts)
// Field names PascalCase untuk FK — sesuai Ahmad

export const meteranTypeDefs = gql`
  type Meteran {
    _id: ID!
    IdKelompokPelanggan: KelompokPelanggan
    IdKoneksiData: KoneksiData
    NomorMeteran: String!
    NomorAkun: String!
    totalPemakaian: Float
    pemakaianBelumTerbayar: Float
    statusAktif: Boolean
    createdAt: String
    updatedAt: String
  }

  type RiwayatPenggunaan {
    _id: ID!
    meteranId: Meteran
    penggunaanAir: Float!
    createdAt: String
    updatedAt: String
  }

  type RiwayatBulananData {
    bulan: String!
    totalPemakaian: Float!
    jumlahRecord: Int!
  }

  # Ahmad's monthly aggregated usage (collection: riwayatpenggunaas)
  type RiwayatBulananAhmad {
    _id: ID
    periode: String!          # Format YYYY-MM
    totalPenggunaan: Float!   # Total liter in the month
    createdAt: String
  }

  type EstimasiBiaya {
    pemakaianBelumTerbayar: Float!
    estimasiBiaya: Float!
    biayaBeban: Float!
    totalEstimasi: Float!
    namaKelompok: String
  }

  extend type Query {
    getMeteran(id: ID!): Meteran
    getAllMeteran(limit: Int, offset: Int): [Meteran!]!
    getMeteranByPelanggan(idPelanggan: ID!): [Meteran!]!
    getMeteranByKoneksiData(IdKoneksiData: ID!): Meteran
    getRiwayatPenggunaan(meteranId: ID!, limit: Int): [RiwayatPenggunaan!]!
    getRiwayatPenggunaanBulanan(meteranId: ID!): [RiwayatBulananData!]!
    # Ahmad's monthly usage data (riwayatpenggunaas collection)
    getRiwayatBulananAhmad(meteranId: ID!): [RiwayatBulananAhmad!]!
    getEstimasiBiaya(meteranId: ID!): EstimasiBiaya
  }

  extend type Mutation {
    createMeteran(
      IdKelompokPelanggan: ID!
      NomorMeteran: String!
      NomorAkun: String!
      IdKoneksiData: ID
    ): Meteran!
    updateMeteran(
      id: ID!
      IdKelompokPelanggan: ID
      NomorMeteran: String
      NomorAkun: String
      IdKoneksiData: ID
      statusAktif: Boolean
    ): Meteran!
    deleteMeteran(id: ID!): DeleteResponse!
  }
`;
