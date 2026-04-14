import { gql } from 'graphql-tag';

// Disesuaikan dengan Ahmad (flowin-backend/Laporan.ts)
// Enum values SCREAMING_SNAKE_CASE — sesuai Ahmad

export const laporanTypeDefs = gql`
  type Laporan {
    _id: ID!
    idPengguna: Pengguna
    namaLaporan: String!
    masalah: String!
    alamat: String!
    imageURL: [String!]
    jenisLaporan: JenisLaporan!
    catatan: String
    koordinat: Geolocation
    status: WorkStatusPelanggan!
    createdAt: String
    updatedAt: String
  }

  type PenyelesaianLaporan {
    _id: ID!
    idLaporan: Laporan
    urlGambar: [String]
    catatan: String
    createdAt: String
    updatedAt: String
  }

  input CreatePenyelesaianLaporanInput {
    idLaporan: ID!
    urlGambar: [String]
    catatan: String
  }

  input UpdatePenyelesaianLaporanInput {
    urlGambar: [String]
    catatan: String
  }

  extend type Query {
    getLaporan(id: ID!): Laporan
    getAllLaporan(limit: Int, offset: Int): [Laporan!]!
    getLaporanByStatus(status: WorkStatusPelanggan!): [Laporan!]!
    getLaporanByPelanggan(idPelanggan: ID!): [Laporan!]!
    getPenyelesaianLaporan(id: ID!): PenyelesaianLaporan
    getPenyelesaianLaporanByLaporan(idLaporan: ID!): [PenyelesaianLaporan!]!
    getAllPenyelesaianLaporan: [PenyelesaianLaporan!]!
  }

  extend type Mutation {
    # Admin: update status laporan pelanggan
    updateLaporanStatus(id: ID!, status: WorkStatusPelanggan!): Laporan!
    createPenyelesaianLaporan(input: CreatePenyelesaianLaporanInput!): PenyelesaianLaporan!
    updatePenyelesaianLaporan(id: ID!, input: UpdatePenyelesaianLaporanInput!): PenyelesaianLaporan!
    deletePenyelesaianLaporan(id: ID!): DeleteResponse!
  }
`;
