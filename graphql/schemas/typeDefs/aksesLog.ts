import { gql } from 'graphql-tag';

export const aksesLogTypeDefs = gql`
  type AksesLog {
    id: ID!
    idAdmin: String!
    namaAdmin: String!
    jenisDokumen: String!
    idPemilik: String!
    namaOperasi: String!
    ipAddress: String!
    userAgent: String
    createdAt: String
  }

  extend type Query {
    """Riwayat akses dokumen kredensial — hanya administrator"""
    getAksesLog(
      idAdmin: String
      idPemilik: String
      limit: Int
      offset: Int
    ): [AksesLog!]!

    """Jumlah akses dokumen per admin dalam N jam terakhir (untuk dashboard keamanan)"""
    getAksesLogStats(jamTerakhir: Int): [AksesLogStat!]!
  }

  type AksesLogStat {
    idAdmin: String!
    namaAdmin: String!
    jumlahAkses: Int!
  }
`;
