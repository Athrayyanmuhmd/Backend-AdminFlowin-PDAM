import { gql } from 'graphql-tag';

export const workOrderTypeDefs = gql`
  type PekerjaanTeknisi {
    _id: ID!
    idSurvei: Survei
    rabId: RABConnection
    idLaporan: Laporan
    idPenyelesaianLaporan: PenyelesaianLaporan
    idPemasangan: Pemasangan
    idPengawasanPemasangan: PengawasanPemasangan
    idPengawasanSetelahPemasangan: PengawasanSetelahPemasangan
    tim: [Teknisi!]
    status: EnumWorkStatus!
    disetujui: Boolean
    catatan: String
    createdAt: String
    updatedAt: String
  }

  input CreateWorkOrderInput {
    idSurvei: ID
    rabId: ID
    idLaporan: ID
    idPenyelesaianLaporan: ID
    idPemasangan: ID
    tim: [ID!]!
    catatan: String
  }

  input CreatePekerjaanTeknisiInput {
    idSurvei: ID
    rabId: ID
    idLaporan: ID
    idPenyelesaianLaporan: ID
    idPemasangan: ID
    idPengawasanPemasangan: ID
    idPengawasanSetelahPemasangan: ID
    tim: [ID!]!
    status: EnumWorkStatus
    catatan: String
  }

  input UpdatePekerjaanTeknisiInput {
    idSurvei: ID
    rabId: ID
    idLaporan: ID
    idPenyelesaianLaporan: ID
    idPemasangan: ID
    idPengawasanPemasangan: ID
    idPengawasanSetelahPemasangan: ID
    tim: [ID!]
    status: EnumWorkStatus
    disetujui: Boolean
    catatan: String
  }

  extend type Query {
    getWorkOrder(id: ID!): PekerjaanTeknisi
    getAllWorkOrders: [PekerjaanTeknisi!]!
    getWorkOrdersByStatus(status: EnumWorkStatus!): [PekerjaanTeknisi!]!
    getWorkOrdersByTeknisi(idTeknisi: ID!): [PekerjaanTeknisi!]!
    getPekerjaanTeknisi(id: ID!): PekerjaanTeknisi
    getAllPekerjaanTeknisi: [PekerjaanTeknisi!]!
    getPekerjaanTeknisiByStatus(status: EnumWorkStatus!): [PekerjaanTeknisi!]!
    getPekerjaanTeknisiByTeknisi(teknisiId: ID!): [PekerjaanTeknisi!]!
    getPekerjaanTeknisiPendingApproval: [PekerjaanTeknisi!]!
  }

  extend type Mutation {
    createWorkOrder(input: CreateWorkOrderInput!): PekerjaanTeknisi!
    assignWorkOrder(id: ID!, teknisiIds: [ID!]!): PekerjaanTeknisi!
    updateWorkOrderStatus(id: ID!, status: EnumWorkStatus!, catatan: String): PekerjaanTeknisi!
    approveWorkOrder(id: ID!, disetujui: Boolean!, catatan: String): PekerjaanTeknisi!
  }
`;
