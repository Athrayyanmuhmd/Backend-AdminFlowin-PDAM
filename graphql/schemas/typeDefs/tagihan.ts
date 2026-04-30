import { gql } from 'graphql-tag';

// Disesuaikan dengan Ahmad (flowin-backend/Tagihan.ts)
// Field names PascalCase — sesuai Ahmad

export const tagihanTypeDefs = gql`
  type Tagihan {
    _id: ID!
    userId: ID
    IdMeteran: Meteran
    Periode: String!
    PenggunaanSebelum: Float
    PenggunaanSekarang: Float
    TotalPemakaian: Float
    Biaya: Float
    BiayaBeban: Float
    TotalBiaya: Float
    StatusPembayaran: PaymentStatus
    TanggalPembayaran: String
    MetodePembayaran: String
    TenggatWaktu: String
    Menunggak: Boolean
    Denda: Float
    Catatan: String
    jenisBilling: EnumJenisBilling
    bulanCakupan: Int
    isMergedBilling: Boolean
    MidtransOrderId: String
    SnapToken: String
    SnapRedirectUrl: String
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
    IdMeteran: ID!
    NomorMeteran: String
    NomorAkun: String
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
    getTagihanByMeteran(IdMeteran: ID!): [Tagihan!]!
    getTagihanByStatus(status: PaymentStatus!): [Tagihan!]!
    getTunggakan: [Tagihan!]!
    getDaftarPemutusan: [DaftarPemutusan!]!
  }

  extend type Mutation {
    generateTagihan(IdMeteran: ID!, Periode: String!): Tagihan!
    generateTagihanBulanan(Periode: String!, IdMeteranList: [ID!]!): HasilGenerateTagihan!
    updateStatusPembayaran(id: ID!, status: PaymentStatus!): Tagihan!
    buatSnapTagihan(id: ID!): Tagihan!
  }
`;
