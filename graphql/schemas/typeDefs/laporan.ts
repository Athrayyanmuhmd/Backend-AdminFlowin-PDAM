import { gql } from 'graphql-tag';

export const laporanTypeDefs = gql`
  type Laporan {
    _id: ID!
    idPengguna: Pengguna
    namaLaporan: String
    masalah: String
    alamat: String
    imageUrl: [String!]
    jenisLaporan: EnumJenisLaporan
    catatan: String
    koordinat: Geolocation
    status: EnumWorkStatusPelanggan!
    createdAt: String
    updatedAt: String
  }

  type PenyelesaianMetadata {
    durasiPengerjaan: Float
    materialDigunakan: [String!]
    biaya: Float
  }

  type PenyelesaianLaporan {
    _id: ID!
    idLaporan: Laporan!
    urlGambar: [String!]!
    catatan: String!
    teknisiId: Teknisi
    tanggalSelesai: String
    metadata: PenyelesaianMetadata
    createdAt: String
    updatedAt: String
  }

  input PenyelesaianMetadataInput {
    durasiPengerjaan: Float
    materialDigunakan: [String!]
    biaya: Float
  }

  input CreatePenyelesaianLaporanInput {
    idLaporan: ID!
    urlGambar: [String!]!
    catatan: String!
    teknisiId: ID
    tanggalSelesai: String
    metadata: PenyelesaianMetadataInput
  }

  input UpdatePenyelesaianLaporanInput {
    urlGambar: [String!]
    catatan: String
    teknisiId: ID
    tanggalSelesai: String
    metadata: PenyelesaianMetadataInput
  }

  extend type Query {
    getLaporan(id: ID!): Laporan
    getAllLaporan(limit: Int, offset: Int): [Laporan!]!
    getLaporanByStatus(status: EnumWorkStatusPelanggan!): [Laporan!]!
    getLaporanByPelanggan(idPelanggan: ID!): [Laporan!]!
    getPenyelesaianLaporan(id: ID!): PenyelesaianLaporan
    getPenyelesaianLaporanByLaporan(idLaporan: ID!): [PenyelesaianLaporan!]!
    getPenyelesaianLaporanByTeknisi(teknisiId: ID!): [PenyelesaianLaporan!]!
    getAllPenyelesaianLaporan: [PenyelesaianLaporan!]!
  }

  extend type Mutation {
    updateLaporanStatus(id: ID!, status: EnumWorkStatusPelanggan!): Laporan!
    createWorkOrderFromLaporan(idLaporan: ID!, teknisiIds: [ID!]!, catatan: String): PekerjaanTeknisi!
    createPenyelesaianLaporan(input: CreatePenyelesaianLaporanInput!): PenyelesaianLaporan!
    updatePenyelesaianLaporan(id: ID!, input: UpdatePenyelesaianLaporanInput!): PenyelesaianLaporan!
    deletePenyelesaianLaporan(id: ID!): Boolean!
  }
`;
