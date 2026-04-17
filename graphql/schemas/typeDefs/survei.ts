import { gql } from 'graphql-tag';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql/Survey.ts)
// jumlahPenghuni: Int (Number) — bukan String
// idKoneksiData mereferensi KoneksiData

export const surveiTypeDefs = gql`
  type Koordinat {
    longitude: Float
    latitude: Float
  }

  type Survei {
    _id: ID!
    idKoneksiData: KoneksiData
    koordinat: Koordinat
    urlJaringan: String
    diameterPipa: Float
    urlPosisiBak: String
    posisiMeteran: String
    jumlahPenghuni: Int
    standar: Boolean
    catatan: String
    statusAdmin: String
    catatanAdmin: String
    isDraft: Boolean
    createdAt: String
    updatedAt: String
  }

  type RABConnection {
    _id: ID!
    idKoneksiData: KoneksiData
    totalBiaya: Float
    # Disimpan lowercase di DB ('pending','settlement') — pakai String agar tidak gagal serialize enum
    statusPembayaran: String!
    orderId: String
    paymentUrl: String
    urlRab: String
    catatan: String
    statusKonfirmasiPembayaran: String
    catatanKonfirmasi: String
    createdAt: String
    updatedAt: String
  }

  input KoordinatInput {
    longitude: Float!
    latitude: Float!
  }

  extend type Query {
    getSurvei(id: ID!): Survei
    getAllSurvei: [Survei!]!
    getSurveiByKoneksiData(idKoneksiData: ID!): Survei
    getRABConnection(id: ID!): RABConnection
    getAllRABConnections: [RABConnection!]!
    getRABByKoneksiData(idKoneksiData: ID!): RABConnection
    getPendingRAB: [RABConnection!]!
  }

  extend type Mutation {
    createSurvei(
      idKoneksiData: ID!
      koordinat: KoordinatInput
      urlJaringan: String
      diameterPipa: Float
      urlPosisiBak: String
      posisiMeteran: String
      jumlahPenghuni: Int
      standar: Boolean
      catatan: String
    ): Survei!

    updateSurvei(
      id: ID!
      koordinat: KoordinatInput
      urlJaringan: String
      diameterPipa: Float
      urlPosisiBak: String
      posisiMeteran: String
      jumlahPenghuni: Int
      standar: Boolean
      catatan: String
    ): Survei!

    deleteSurvei(id: ID!): DeleteResponse!

    createRABConnection(
      idKoneksiData: ID!
      totalBiaya: Float
      urlRab: String
      catatan: String
    ): RABConnection!

    updateRABConnection(
      id: ID!
      totalBiaya: Float
      urlRab: String
      catatan: String
      statusPembayaran: String
    ): RABConnection!

    deleteRABConnection(id: ID!): DeleteResponse!

    # Admin review mutations
    reviewSurvei(id: ID!, disetujui: Boolean!, catatan: String): Survei!
    konfirmasiPembayaranRAB(id: ID!, catatan: String): RABConnection!
    tandaiLunasRAB(id: ID!, catatan: String): RABConnection!
  }
`;
