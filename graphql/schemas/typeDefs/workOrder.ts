import { gql } from 'graphql-tag';

// Disesuaikan PENUH dengan Rafli (flowin-teknisi-graphql/workOrder.ts)
// Admin hanya proxy ke Rafli's GraphQL API untuk semua operasi WorkOrder

export const workOrderTypeDefs = gql`
  # ─── Enums (mirror Rafli) ───────────────────────────────────────────────────

  enum JenisPekerjaan {
    survei
    rab
    pemasangan
    pengawasan_pemasangan
    pengawasan_setelah_pemasangan
    penyelesaian_laporan
  }

  enum StatusPekerjaan {
    menunggu_respon
    menunggu_tim
    tim_diajukan
    ditugaskan
    sedang_dikerjakan
    dikirim
    revisi
    selesai
    dibatalkan
  }

  enum StatusTim {
    belum_diajukan
    diajukan
    disetujui
    ditolak
  }

  enum StatusRespon {
    belum_direspon
    diterima
    penolakan_diajukan
    penolakan_diterima
    penolakan_ditolak
  }

  # ─── Types (mirror Rafli) ──────────────────────────────────────────────────

  type Pelanggan {
    id: ID!
    namaLengkap: String
    email: String
    noHp: String
    alamat: String
  }

  type KoneksiDataWO {
    id: ID!
    pelanggan: Pelanggan
    statusPengajuan: StatusPengajuanEnum
    nik: String
    noKK: String
    imb: String
    alamat: String
    kelurahan: String
    kecamatan: String
    luasBangunan: Float
    tanggalVerifikasi: String
    alasanPenolakan: String
    nikUrl: String
    kkUrl: String
    imbUrl: String
    createdAt: String
    updatedAt: String
  }

  # Subset Teknisi untuk konteks riwayat (hanya id & nama yang selalu tersedia)
  type TeknisiOleh {
    id: ID
    namaLengkap: String
  }

  type RiwayatReviewWO {
    status: String
    catatan: String
    oleh: TeknisiOleh
    tanggal: String
  }

  type RiwayatResponWO {
    aksi: String
    alasan: String
    oleh: TeknisiOleh
    tanggal: String
  }

  type WorkOrder {
    id: ID!
    idKoneksiData: ID
    koneksiData: KoneksiDataWO
    jenisPekerjaan: JenisPekerjaan
    teknisiPenanggungJawab: Teknisi
    tim: [Teknisi]
    statusTim: StatusTim
    catatanTim: String
    status: StatusPekerjaan
    workOrderSebelumnya: WorkOrder
    statusRespon: StatusRespon
    alasanPenolakan: String
    catatanReviewPenolakan: String
    riwayatRespon: [RiwayatResponWO]
    idSurvei: ID
    idRAB: ID
    idPemasangan: ID
    idPengawasanPemasangan: ID
    idPengawasanSetelahPemasangan: ID
    idPenyelesaianLaporan: ID
    pelangganLaporan: Pelanggan
    catatanReview: String
    riwayatReview: [RiwayatReviewWO]
    createdAt: String
    updatedAt: String
  }

  type WorkflowChainItem {
    jenisPekerjaan: JenisPekerjaan
    workOrder: WorkOrder
    chainStatus: String
    urutan: Int
    bisaDibuat: Boolean
  }

  type WorkOrderListResponse {
    data: [WorkOrder!]!
    pagination: PageInfo!
  }

  type WorkOrderMutationResponse {
    success: Boolean!
    message: String
    workOrder: WorkOrder
  }

  type BatalkanWorkOrderResponse {
    success: Boolean!
    message: String!
  }

  # ─── Inputs (mirror Rafli) ────────────────────────────────────────────────

  input WorkOrderFilterInput {
    status: StatusPekerjaan
    jenisPekerjaan: JenisPekerjaan
    statusTim: StatusTim
    statusRespon: StatusRespon
    teknisiPenanggungJawab: ID
    idKoneksiData: ID
  }

  input BuatWorkOrderInput {
    idKoneksiData: ID!
    jenisPekerjaan: JenisPekerjaan!
    teknisiPenanggungJawab: ID!
  }

  input AjukanTimInput {
    workOrderId: ID!
    anggotaTim: [ID!]!
  }

  input ReviewTimInput {
    workOrderId: ID!
    disetujui: Boolean!
    catatan: String
  }

  input ReviewHasilInput {
    workOrderId: ID!
    disetujui: Boolean!
    catatan: String
  }

  input ReviewPenolakanInput {
    workOrderId: ID!
    disetujui: Boolean!
    catatan: String
  }

  # ─── Queries ──────────────────────────────────────────────────────────────

  extend type Query {
    # List semua work order (admin) — proxy ke Rafli
    workOrders(filter: WorkOrderFilterInput, pagination: PaginationInput): WorkOrderListResponse!

    # Detail satu work order — proxy ke Rafli
    workOrder(id: ID!): WorkOrder

    # Work order by koneksi data — proxy ke Rafli
    workOrdersByKoneksiData(idKoneksiData: ID!): [WorkOrder!]!

    # Rantai workflow untuk satu koneksi data — proxy ke Rafli
    workflowChain(idKoneksiData: ID!): [WorkflowChainItem!]!

    # Cek prerequisite — proxy ke Rafli
    cekPrerequisitePekerjaan(idKoneksiData: ID!, jenisPekerjaan: JenisPekerjaan!): Boolean!
  }

  # ─── Mutations ────────────────────────────────────────────────────────────

  extend type Mutation {
    # Admin: Buat work order — proxy ke Rafli
    buatWorkOrder(input: BuatWorkOrderInput!): WorkOrderMutationResponse!

    # Admin: Review penolakan teknisi — proxy ke Rafli
    reviewPenolakan(input: ReviewPenolakanInput!): WorkOrderMutationResponse!

    # Admin: Setujui/tolak tim — proxy ke Rafli
    reviewTim(input: ReviewTimInput!): WorkOrderMutationResponse!

    # Admin: Review hasil pekerjaan — proxy ke Rafli
    reviewHasil(input: ReviewHasilInput!): WorkOrderMutationResponse!

    # Admin: Batalkan work order — proxy ke Rafli
    batalkanWorkOrder(id: ID!, catatan: String): BatalkanWorkOrderResponse!
  }
`;
