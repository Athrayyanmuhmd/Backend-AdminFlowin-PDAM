import { gql } from 'graphql-tag';

// Disesuaikan dengan Rafli (flowin-teknisi-graphql)
// Semua model hanya punya field minimal — teknisi mengisi via app mereka

export const pemasanganTypeDefs = gql`
  # ─── Pemasangan (Rafli: idKoneksiData + 5 optional fields) ─────────────────
  type Pemasangan {
    _id: ID!
    idKoneksiData: KoneksiData
    seriMeteran: String
    fotoRumah: String
    fotoMeteran: String
    fotoMeteranDanRumah: String
    catatan: String
    createdAt: String
    updatedAt: String
  }

  # ─── PengawasanPemasangan (Rafli: idPemasangan + urlGambar + catatan) ──────
  type PengawasanPemasangan {
    _id: ID!
    idPemasangan: Pemasangan
    urlGambar: [String]
    catatan: String
    createdAt: String
    updatedAt: String
  }

  # ─── PengawasanSetelahPemasangan (Rafli: idPemasangan + urlGambar + catatan)
  type PengawasanSetelahPemasangan {
    _id: ID!
    idPemasangan: Pemasangan
    urlGambar: [String]
    catatan: String
    createdAt: String
    updatedAt: String
  }

  # ─── Inputs ────────────────────────────────────────────────────────────────
  input CreatePemasanganInput {
    idKoneksiData: ID!
    seriMeteran: String
    fotoRumah: String
    fotoMeteran: String
    fotoMeteranDanRumah: String
    catatan: String
  }

  input UpdatePemasanganInput {
    seriMeteran: String
    fotoRumah: String
    fotoMeteran: String
    fotoMeteranDanRumah: String
    catatan: String
  }

  input CreatePengawasanPemasanganInput {
    idPemasangan: ID!
    urlGambar: [String]
    catatan: String
  }

  input UpdatePengawasanPemasanganInput {
    urlGambar: [String]
    catatan: String
  }

  input CreatePengawasanSetelahPemasanganInput {
    idPemasangan: ID!
    urlGambar: [String]
    catatan: String
  }

  input UpdatePengawasanSetelahPemasanganInput {
    urlGambar: [String]
    catatan: String
  }

  # ─── Queries ───────────────────────────────────────────────────────────────
  extend type Query {
    getPemasangan(id: ID!): Pemasangan
    getPemasanganByKoneksiData(idKoneksiData: ID!): Pemasangan
    getAllPemasangan: [Pemasangan!]!
    getPengawasanPemasangan(id: ID!): PengawasanPemasangan
    getPengawasanPemasanganByPemasangan(idPemasangan: ID!): [PengawasanPemasangan!]!
    getAllPengawasanPemasangan: [PengawasanPemasangan!]!
    getPengawasanSetelahPemasangan(id: ID!): PengawasanSetelahPemasangan
    getPengawasanSetelahPemasanganByPemasangan(idPemasangan: ID!): [PengawasanSetelahPemasangan!]!
    getAllPengawasanSetelahPemasangan: [PengawasanSetelahPemasangan!]!
  }

  # ─── Mutations ─────────────────────────────────────────────────────────────
  extend type Mutation {
    createPemasangan(input: CreatePemasanganInput!): Pemasangan!
    updatePemasangan(id: ID!, input: UpdatePemasanganInput!): Pemasangan!
    deletePemasangan(id: ID!): Boolean!
    createPengawasanPemasangan(input: CreatePengawasanPemasanganInput!): PengawasanPemasangan!
    updatePengawasanPemasangan(id: ID!, input: UpdatePengawasanPemasanganInput!): PengawasanPemasangan!
    deletePengawasanPemasangan(id: ID!): Boolean!
    createPengawasanSetelahPemasangan(input: CreatePengawasanSetelahPemasanganInput!): PengawasanSetelahPemasangan!
    updatePengawasanSetelahPemasangan(id: ID!, input: UpdatePengawasanSetelahPemasanganInput!): PengawasanSetelahPemasangan!
    deletePengawasanSetelahPemasangan(id: ID!): Boolean!
  }
`;
