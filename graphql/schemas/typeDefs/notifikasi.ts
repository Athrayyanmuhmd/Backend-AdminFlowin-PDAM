import { gql } from 'graphql-tag';

export const notifikasiTypeDefs = gql`
  type Notifikasi {
    _id: ID!
    idPelanggan: Pengguna
    idAdmin: Admin
    idTeknisi: Teknisi
    judul: String!
    pesan: String!
    kategori: EnumKategori!
    link: String
    isRead: Boolean!
    createdAt: String
    updatedAt: String
  }

  input CreateNotifikasiInput {
    idPelanggan: ID
    idAdmin: ID
    idTeknisi: ID
    judul: String!
    pesan: String!
    kategori: EnumKategori!
    link: String
  }

  extend type Query {
    getNotifikasi(id: ID!): Notifikasi
    getNotifikasiByAdmin(idAdmin: ID!): [Notifikasi!]!
    getUnreadNotifikasi(idAdmin: ID!): [Notifikasi!]!
    getAllNotifikasiAdmin: [Notifikasi!]!
  }

  extend type Mutation {
    createNotifikasi(input: CreateNotifikasiInput!): Notifikasi!
    broadcastNotifikasi(input: CreateNotifikasiInput!): [Notifikasi!]!
    markNotifikasiAsRead(id: ID!): Notifikasi!
  }
`;
