import { gql } from 'graphql-tag';

export const meteranTypeDefs = gql`
  type Meteran {
    _id: ID!
    idKelompokPelanggan: KelompokPelanggan
    idKoneksiData: KoneksiData
    nomorMeteran: String
    nomorAkun: String
    totalPemakaian: Float
    pemakaianBelumTerbayar: Float
    statusAktif: Boolean
    createdAt: String
    updatedAt: String
  }

  type RiwayatPenggunaan {
    _id: ID!
    meteranId: Meteran
    userId: Pengguna
    penggunaanAir: Float!
    createdAt: String
    updatedAt: String
  }

  type RiwayatBulananData {
    bulan: String!
    totalPemakaian: Float!
    jumlahRecord: Int!
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
    getMeteranByKoneksiData(idKoneksiData: ID!): Meteran
    getRiwayatPenggunaan(meteranId: ID!, limit: Int): [RiwayatPenggunaan!]!
    getRiwayatPenggunaanBulanan(meteranId: ID!): [RiwayatBulananData!]!
    getEstimasiBiaya(meteranId: ID!): EstimasiBiaya
  }

  extend type Mutation {
    createMeteran(idKelompokPelanggan: ID!, nomorMeteran: String!, nomorAkun: String!, idKoneksiData: ID): Meteran!
    updateMeteran(id: ID!, idKelompokPelanggan: ID, nomorMeteran: String, nomorAkun: String, idKoneksiData: ID, statusAktif: Boolean): Meteran!
    deleteMeteran(id: ID!): Boolean!
  }
`;
