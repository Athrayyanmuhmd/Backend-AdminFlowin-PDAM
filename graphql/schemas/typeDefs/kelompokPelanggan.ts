import { gql } from 'graphql-tag';

// Disesuaikan dengan Ahmad (flowin-backend/KelompokPelanggan.ts)
// Fields PascalCase sesuai Ahmad

export const kelompokPelangganTypeDefs = gql`
  type KelompokPelanggan {
    _id: ID!
    KodeKelompok: String
    NamaKelompok: String
    Kategori: String
    Deskripsi: String
    TarifRendah: Float
    TarifTinggi: Float
    BatasRendah: Float
    BiayaBeban: Float
    IsKesepakatan: Boolean
    createdAt: String
    updatedAt: String
  }

  input CreateKelompokPelangganInput {
    KodeKelompok: String!
    NamaKelompok: String!
    Kategori: String!
    Deskripsi: String
    TarifRendah: Float!
    TarifTinggi: Float!
    BatasRendah: Float
    BiayaBeban: Float!
    IsKesepakatan: Boolean
  }

  input UpdateKelompokPelangganInput {
    KodeKelompok: String
    NamaKelompok: String
    Kategori: String
    Deskripsi: String
    TarifRendah: Float
    TarifTinggi: Float
    BatasRendah: Float
    BiayaBeban: Float
    IsKesepakatan: Boolean
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
