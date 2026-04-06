import { gql } from 'graphql-tag';

export const pelangganTypeDefs = gql`
  type Pengguna {
    _id: ID!
    email: String
    noHP: String
    namaLengkap: String
    nik: String
    address: String
    gender: String
    birthDate: String
    occupation: String
    customerType: String
    accountStatus: String
    password: String
    token: String
    isVerified: Boolean
    createdAt: String
    updatedAt: String
  }

  input CreatePelangganInput {
    email: String!
    noHP: String!
    namaLengkap: String!
    password: String
    nik: String
    address: String
    gender: String
    birthDate: String
    occupation: String
    customerType: String
    accountStatus: String
  }

  input UpdatePelangganInput {
    email: String
    noHP: String
    namaLengkap: String
    isVerified: Boolean
    nik: String
    address: String
    gender: String
    birthDate: String
    occupation: String
    customerType: String
    accountStatus: String
  }

  extend type Query {
    getPengguna(id: ID!): Pengguna
    getAllPengguna(limit: Int, offset: Int): [Pengguna!]!
    searchPengguna(search: String!): [Pengguna!]!
  }

  extend type Mutation {
    createPelanggan(input: CreatePelangganInput!): Pengguna!
    updatePelanggan(id: ID!, input: UpdatePelangganInput!): Pengguna!
    deletePelanggan(id: ID!): DeleteResponse!
    deactivateCustomer(userId: ID!): Pengguna!
    konfirmasiPembayaranLoket(userId: ID!): Pengguna!
    aktivasiPelanggan(koneksiDataId: ID!): Pengguna!
  }
`;
