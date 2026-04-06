import { gql } from 'graphql-tag';

export const tagihanTypeDefs = gql`
  type Tagihan {
    _id: ID!
    idMeteran: Meteran
    periode: String
    penggunaanSebelum: Float
    penggunaanSekarang: Float
    totalPemakaian: Float
    biaya: Float
    biayaBeban: Float
    totalBiaya: Float
    statusPembayaran: EnumPaymentStatus
    tanggalPembayaran: String
    metodePembayaran: String
    tenggatWaktu: String
    menunggak: Boolean
    denda: Float
    catatan: String
    jenisBilling: EnumJenisBilling
    bulanCakupan: Int
    isMergedBilling: Boolean
    mergedFromIds: [ID]
    mergedIntoBillingId: ID
    createdAt: String
    updatedAt: String
  }

  type DaftarPemutusan {
    user: Pengguna!
    tagihanTunggakan: [Tagihan!]!
    jumlahBulanTunggak: Int!
    totalTunggakan: Float!
    denda: Float!
    sudahDiputus: Boolean!
  }

  type DetailGagalTagihan {
    idMeteran: ID!
    nomorMeteran: String
    nomorAkun: String
    namaLengkap: String
    alasan: String!
  }

  type HasilGenerateTagihan {
    berhasil: Int!
    gagal: Int!
    pesan: String
    detailGagal: [DetailGagalTagihan!]!
  }

  extend type Query {
    getTagihan(id: ID!): Tagihan
    getAllTagihan(limit: Int, offset: Int): [Tagihan!]!
    getTagihanByMeteran(idMeteran: ID!): [Tagihan!]!
    getTagihanByStatus(status: EnumPaymentStatus!): [Tagihan!]!
    getTunggakan: [Tagihan!]!
    getDaftarPemutusan: [DaftarPemutusan!]!
  }

  extend type Mutation {
    generateTagihan(idMeteran: ID!, periode: String!): Tagihan!
    generateTagihanBulanan(periode: String!, idMeteranList: [ID!]!): HasilGenerateTagihan!
    updateStatusPembayaran(id: ID!, status: EnumPaymentStatus!): Tagihan!
  }
`;
