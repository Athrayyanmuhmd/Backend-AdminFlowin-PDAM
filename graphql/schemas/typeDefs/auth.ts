import { gql } from 'graphql-tag';

export const authTypeDefs = gql`
  type Admin {
    _id: ID!
    NIP: String
    namaLengkap: String
    email: String
    noHP: String
    createdAt: String
    updatedAt: String
  }

  type AuthPayload {
    token: String!
    admin: Admin!
  }

  # Teknisi login ke admin panel — Teknisi type didefinisikan di teknisi.ts
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

  extend type Query {
    loginAdmin(email: String!, password: String!): AuthPayload!
    loginTechnician(email: String!, password: String!): TechnicianAuthPayload!
    getAdmin(id: ID!): Admin
    getAllAdmins: [Admin!]!
  }

  extend type Mutation {
    createAdmin(input: CreateAdminInput!): Admin!
    updateAdmin(id: ID!, input: UpdateAdminInput!): Admin!
    deleteAdmin(id: ID!): DeleteResponse!
    logoutAdmin: Boolean!
    logoutTechnician: Boolean!
  }
`;
