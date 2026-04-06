import { gql } from 'graphql-tag';

export const pemasanganTypeDefs = gql`
  type DetailPemasangan {
    diameterPipa: Float
    lokasiPemasangan: String
    koordinat: Geolocation
    materialDigunakan: [String!]
  }

  type Pemasangan {
    _id: ID!
    idKoneksiData: KoneksiData!
    seriMeteran: String!
    fotoRumah: String!
    fotoMeteran: String!
    fotoMeteranDanRumah: String!
    catatan: String
    teknisiId: Teknisi!
    tanggalPemasangan: String
    statusVerifikasi: String!
    diverifikasiOleh: Admin
    tanggalVerifikasi: String
    detailPemasangan: DetailPemasangan
    createdAt: String
    updatedAt: String
  }

  type ChecklistPengawasan {
    kualitasSambunganPipa: String
    posisiMeteran: String
    kebersihanPemasangan: String
    kepatuhanK3: String
  }

  type PengawasanPemasangan {
    _id: ID!
    idPemasangan: Pemasangan!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: Teknisi!
    tanggalPengawasan: String
    hasilPengawasan: String!
    temuan: [String!]
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistPengawasan
    createdAt: String
    updatedAt: String
  }

  type ChecklistSetelahPemasangan {
    meteranBacaCorrect: Boolean
    tidakAdaKebocoran: Boolean
    sambunganAman: Boolean
    mudahDibaca: Boolean
    pelangganPuas: Boolean
    dokumentasiLengkap: Boolean
  }

  type FeedbackPelanggan {
    rating: Int
    komentar: String
  }

  type PengawasanSetelahPemasangan {
    _id: ID!
    idPemasangan: Pemasangan!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: Teknisi!
    tanggalPengawasan: String
    hariSetelahPemasangan: Int
    hasilPengawasan: String!
    statusMeteran: String!
    bacaanAwal: Float
    masalahDitemukan: [String!]
    tindakan: String
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistSetelahPemasangan
    feedbackPelanggan: FeedbackPelanggan
    createdAt: String
    updatedAt: String
  }

  type AverageRatingResult {
    avgRating: Float!
    count: Int!
  }

  input DetailPemasanganInput {
    diameterPipa: Float
    lokasiPemasangan: String
    koordinat: GeolocationInput
    materialDigunakan: [String!]
  }

  input CreatePemasanganInput {
    idKoneksiData: ID!
    seriMeteran: String!
    fotoRumah: String!
    fotoMeteran: String!
    fotoMeteranDanRumah: String!
    catatan: String
    teknisiId: ID!
    tanggalPemasangan: String
    detailPemasangan: DetailPemasanganInput
  }

  input UpdatePemasanganInput {
    seriMeteran: String
    fotoRumah: String
    fotoMeteran: String
    fotoMeteranDanRumah: String
    catatan: String
    teknisiId: ID
    statusVerifikasi: String
    detailPemasangan: DetailPemasanganInput
  }

  input ChecklistPengawasanInput {
    kualitasSambunganPipa: String
    posisiMeteran: String
    kebersihanPemasangan: String
    kepatuhanK3: String
  }

  input CreatePengawasanPemasanganInput {
    idPemasangan: ID!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: ID!
    tanggalPengawasan: String
    hasilPengawasan: String!
    temuan: [String!]
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistPengawasanInput
  }

  input UpdatePengawasanPemasanganInput {
    urlGambar: [String!]
    catatan: String
    supervisorId: ID
    tanggalPengawasan: String
    hasilPengawasan: String
    temuan: [String!]
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistPengawasanInput
  }

  input ChecklistSetelahPemasanganInput {
    meteranBacaCorrect: Boolean
    tidakAdaKebocoran: Boolean
    sambunganAman: Boolean
    mudahDibaca: Boolean
    pelangganPuas: Boolean
    dokumentasiLengkap: Boolean
  }

  input FeedbackPelangganInput {
    rating: Int
    komentar: String
  }

  input CreatePengawasanSetelahPemasanganInput {
    idPemasangan: ID!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: ID!
    tanggalPengawasan: String
    hasilPengawasan: String!
    statusMeteran: String!
    bacaanAwal: Float
    masalahDitemukan: [String!]
    tindakan: String
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistSetelahPemasanganInput
    feedbackPelanggan: FeedbackPelangganInput
  }

  input UpdatePengawasanSetelahPemasanganInput {
    urlGambar: [String!]
    catatan: String
    supervisorId: ID
    tanggalPengawasan: String
    hasilPengawasan: String
    statusMeteran: String
    bacaanAwal: Float
    masalahDitemukan: [String!]
    tindakan: String
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistSetelahPemasanganInput
    feedbackPelanggan: FeedbackPelangganInput
  }

  extend type Query {
    getPemasangan(id: ID!): Pemasangan
    getPemasanganByKoneksiData(idKoneksiData: ID!): Pemasangan
    getPemasanganByTeknisi(teknisiId: ID!): [Pemasangan!]!
    getPemasanganByStatus(statusVerifikasi: String!): [Pemasangan!]!
    getAllPemasangan: [Pemasangan!]!
    getPengawasanPemasangan(id: ID!): PengawasanPemasangan
    getPengawasanPemasanganByPemasangan(idPemasangan: ID!): [PengawasanPemasangan!]!
    getPengawasanPemasanganBySupervisor(supervisorId: ID!): [PengawasanPemasangan!]!
    getPengawasanPemasanganProblematic: [PengawasanPemasangan!]!
    getAllPengawasanPemasangan: [PengawasanPemasangan!]!
    getPengawasanSetelahPemasangan(id: ID!): PengawasanSetelahPemasangan
    getPengawasanSetelahPemasanganByPemasangan(idPemasangan: ID!): [PengawasanSetelahPemasangan!]!
    getPengawasanSetelahPemasanganBySupervisor(supervisorId: ID!): [PengawasanSetelahPemasangan!]!
    getPengawasanSetelahPemasanganProblematic: [PengawasanSetelahPemasangan!]!
    getAllPengawasanSetelahPemasangan: [PengawasanSetelahPemasangan!]!
    getAverageCustomerRating: AverageRatingResult!
  }

  extend type Mutation {
    createPemasangan(input: CreatePemasanganInput!): Pemasangan!
    updatePemasangan(id: ID!, input: UpdatePemasanganInput!): Pemasangan!
    deletePemasangan(id: ID!): Boolean!
    verifyPemasangan(id: ID!, statusVerifikasi: String!, catatan: String): Pemasangan!
    createPengawasanPemasangan(input: CreatePengawasanPemasanganInput!): PengawasanPemasangan!
    updatePengawasanPemasangan(id: ID!, input: UpdatePengawasanPemasanganInput!): PengawasanPemasangan!
    deletePengawasanPemasangan(id: ID!): Boolean!
    createPengawasanSetelahPemasangan(input: CreatePengawasanSetelahPemasanganInput!): PengawasanSetelahPemasangan!
    updatePengawasanSetelahPemasangan(id: ID!, input: UpdatePengawasanSetelahPemasanganInput!): PengawasanSetelahPemasangan!
    deletePengawasanSetelahPemasangan(id: ID!): Boolean!
  }
`;
