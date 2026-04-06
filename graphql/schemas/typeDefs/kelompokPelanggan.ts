import { gql } from 'graphql-tag';

export const kelompokPelangganTypeDefs = gql`
  type KelompokPelanggan {
    _id: ID!
    namaKelompok: String
    hargaDiBawah10mKubik: Float
    hargaDiAtas10mKubik: Float
    biayaBeban: Float
    createdAt: String
    updatedAt: String
  }

  input CreateKelompokPelangganInput {
    namaKelompok: String!
    hargaDiBawah10mKubik: Float!
    hargaDiAtas10mKubik: Float!
    biayaBeban: Float
  }

  input UpdateKelompokPelangganInput {
    namaKelompok: String
    hargaDiBawah10mKubik: Float
    hargaDiAtas10mKubik: Float
    biayaBeban: Float
  }

  extend type Query {
    getKelompokPelanggan(id: ID!): KelompokPelanggan
    getAllKelompokPelanggan: [KelompokPelanggan!]!
  }

  extend type Mutation {
    createKelompokPelanggan(input: CreateKelompokPelangganInput!): KelompokPelanggan!
    updateKelompokPelanggan(id: ID!, input: UpdateKelompokPelangganInput!): KelompokPelanggan!
    deleteKelompokPelanggan(id: ID!): DeleteResponse!
  }
`;
