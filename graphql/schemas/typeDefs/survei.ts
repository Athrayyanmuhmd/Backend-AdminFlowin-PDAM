import { gql } from 'graphql-tag';

export const surveiTypeDefs = gql`
  type Survei {
    _id: ID!
    idKoneksiData: KoneksiData
    koordinat: Geolocation
    urlJaringan: String
    diameterPipa: Float
    urlPosisiBak: String
    posisiMeteran: String
    jumlahPenghuni: String
    standar: Boolean!
    catatan: String
    createdAt: String
    updatedAt: String
  }

  type RABConnection {
    _id: ID!
    idKoneksiData: KoneksiData
    totalBiaya: Float!
    statusPembayaran: EnumPaymentStatus!
    urlRab: String!
    catatan: String
    createdAt: String
    updatedAt: String
  }

  extend type Query {
    getSurvei(id: ID!): Survei
    getAllSurvei: [Survei!]!
    getRABConnection(id: ID!): RABConnection
    getAllRABConnections: [RABConnection!]!
    getPendingRAB: [RABConnection!]!
    getWOBySurvei(surveiId: ID!): PekerjaanTeknisi
    getWOByRAB(rabId: ID!): PekerjaanTeknisi
    getSurveiByKoneksiData(idKoneksiData: ID!): Survei
    getRABByKoneksiData(idKoneksiData: ID!): RABConnection
  }

  extend type Mutation {
    createSurvei(
      idKoneksiData: ID!
      urlJaringan: String!
      diameterPipa: Float!
      urlPosisiBak: String!
      posisiMeteran: String!
      jumlahPenghuni: String!
      standar: Boolean!
      catatan: String
      koordinat: GeolocationInput
    ): Survei!
    updateSurvei(
      id: ID!
      urlJaringan: String
      diameterPipa: Float
      urlPosisiBak: String
      posisiMeteran: String
      jumlahPenghuni: String
      standar: Boolean
      catatan: String
      koordinat: GeolocationInput
    ): Survei!
    deleteSurvei(id: ID!): Boolean!
    assignTeknisiSurvei(surveiId: ID!, teknisiIds: [ID!]!): PekerjaanTeknisi!
    assignTeknisiRAB(rabId: ID!, teknisiIds: [ID!]!): PekerjaanTeknisi!
    createRABConnection(idKoneksiData: ID!, totalBiaya: Float!, urlRab: String!, catatan: String): RABConnection!
    updateRABConnection(id: ID!, totalBiaya: Float, urlRab: String, catatan: String, statusPembayaran: EnumPaymentStatus): RABConnection!
    deleteRABConnection(id: ID!): Boolean!
  }
`;
