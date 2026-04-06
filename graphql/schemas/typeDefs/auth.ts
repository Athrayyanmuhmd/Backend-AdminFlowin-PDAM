import { gql } from 'graphql-tag';

export const authTypeDefs = gql`
  type Admin {
    _id: ID!
    NIP: String
    namaLengkap: String
    email: String
    noHP: String
    password: String
    token: String
    createdAt: String
    updatedAt: String
  }

  type Teknisi {
    _id: ID!
    namaLengkap: String
    NIP: String
    email: String
    noHP: String
    divisi: EnumDivisiTeknisi
    password: String
    token: String
    createdAt: String
    updatedAt: String
  }

  type AuthPayload {
    token: String!
    admin: Admin!
  }

  type TechnicianAuthPayload {
    token: String!
    technician: Teknisi!
  }

  input CreateAdminInput {
    NIP: String!
    namaLengkap: String!
    email: String!
    noHP: String!
    password: String!
  }

  input UpdateAdminInput {
    NIP: String
    namaLengkap: String
    email: String
    noHP: String
    password: String
  }

  input CreateTeknisiInput {
    namaLengkap: String!
    NIP: String!
    email: String!
    noHP: String!
    divisi: EnumDivisiTeknisi!
    password: String!
  }

  input UpdateTeknisiInput {
    namaLengkap: String
    NIP: String
    email: String
    noHP: String
    divisi: EnumDivisiTeknisi
  }

  extend type Query {
    loginAdmin(email: String!, password: String!): AuthPayload!
    loginTechnician(email: String!, password: String!): TechnicianAuthPayload!
    getAdmin(id: ID!): Admin
    getAllAdmins: [Admin!]!
    getTeknisi(id: ID!): Teknisi
    getAllTeknisi(limit: Int, offset: Int): [Teknisi!]!
    getTeknisiByDivisi(divisi: EnumDivisiTeknisi!): [Teknisi!]!
  }

  extend type Mutation {
    createAdmin(input: CreateAdminInput!): Admin!
    updateAdmin(id: ID!, input: UpdateAdminInput!): Admin!
    deleteAdmin(id: ID!): DeleteResponse!
    createTeknisi(input: CreateTeknisiInput!): Teknisi!
    updateTeknisi(id: ID!, input: UpdateTeknisiInput!): Teknisi!
    deleteTeknisi(id: ID!): DeleteResponse!
    logoutAdmin: Boolean!
    logoutTechnician: Boolean!
  }
`;
