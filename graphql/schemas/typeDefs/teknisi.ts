import { gql } from 'graphql-tag';

// Disesuaikan PENUH dengan Rafli (flowin-teknisi-graphql/user.ts & auth.ts)
// Admin proxy ke Rafli's GraphQL API untuk semua operasi Teknisi

export const teknisiTypeDefs = gql`
  # Type Teknisi — mirror Rafli's User type (TeknisiPerumdam)
  type Teknisi {
    id: ID!
    namaLengkap: String!
    nip: String
    email: String
    noHp: String
    pekerjaanSekarang: ID
    divisi: DivisiTeknisi
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  input CreateTeknisiInput {
    namaLengkap: String!
    nip: String!
    email: String!
    noHp: String!
    divisi: DivisiTeknisi!
    password: String!
  }

  input UpdateTeknisiInput {
    namaLengkap: String
    nip: String
    email: String
    noHp: String
    divisi: DivisiTeknisi
  }

  type ToggleTeknisiStatusResponse {
    success: Boolean!
    message: String!
    user: Teknisi!
  }

  type DeleteTeknisiResponse {
    success: Boolean!
    message: String!
  }

  extend type Query {
    # List semua teknisi — proxy ke Rafli
    getAllTeknisi(search: String): [Teknisi!]!

    # Detail satu teknisi — proxy ke Rafli
    getTeknisi(id: ID!): Teknisi

    # List teknisi berdasarkan divisi — proxy ke Rafli + filter lokal
    getTeknisiByDivisi(divisi: DivisiTeknisi!): [Teknisi!]!
  }

  extend type Mutation {
    # Tambah teknisi baru — proxy ke Rafli register
    createTeknisi(input: CreateTeknisiInput!): Teknisi!

    # Update data teknisi — proxy ke Rafli
    updateTeknisi(id: ID!, input: UpdateTeknisiInput!): Teknisi

    # Toggle status aktif teknisi — proxy ke Rafli
    toggleTeknisiStatus(id: ID!): ToggleTeknisiStatusResponse!

    # Hapus teknisi — proxy ke Rafli
    deleteTeknisi(id: ID!): DeleteTeknisiResponse!
  }
`;
