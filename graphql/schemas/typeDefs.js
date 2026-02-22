import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # ============================================
  # ENUMS - Sesuai ERD
  # ============================================

  enum EnumJenisLaporan {
    AirTidakMengalir
    AirKeruh
    KebocoranPipa
    MeteranBermasalah
    KendalaLainnya
  }

  enum EnumWorkStatusPelanggan {
    Diajukan
    ProsesPerbaikan
    Selesai
  }

  enum EnumWorkStatus {
    Ditunda
    Ditugaskan
    DitinjauAdmin
    SedangDikerjakan
    Selesai
    Dibatalkan
  }

  enum EnumDivisiTeknisi {
    PerencanaanTeknik
    TeknikCabang
    PengawasanTeknik
  }

  enum EnumPaymentStatus {
    Pending
    Settlement
    Cancel
    Expire
    Refund
    Chargeback
    Fraud
  }

  enum EnumKategori {
    Transaksi
    Informasi
    Peringatan
  }

  # ============================================
  # TYPES - Sesuai ERD Collection
  # ============================================

  type Admin {
    _id: ID!
    NIP: String!
    namaLengkap: String!
    email: String!
    noHP: String!
    password: String
    token: String
    createdAt: String
    updatedAt: String
  }

  type Pengguna {
    _id: ID!
    email: String!
    noHP: String!
    namaLengkap: String!
    nik: String
    address: String
    gender: String
    birthDate: String
    occupation: String
    customerType: String
    accountStatus: String
    password: String
    token: String
    isVerified: Boolean!
    createdAt: String
    updatedAt: String
  }

  type Teknisi {
    _id: ID!
    namaLengkap: String!
    NIP: String
    email: String!
    noHP: String!
    divisi: EnumDivisiTeknisi
    password: String
    token: String
    createdAt: String
    updatedAt: String
  }

  type KelompokPelanggan {
    _id: ID!
    namaKelompok: String!
    hargaDiBawah10mKubik: Float!
    hargaDiAtas10mKubik: Float!
    biayaBeban: Float
    createdAt: String
    updatedAt: String
  }

  type Meteran {
    _id: ID!
    idKelompokPelanggan: KelompokPelanggan
    idKoneksiData: KoneksiData
    nomorMeteran: String!
    nomorAkun: String!
    createdAt: String
    updatedAt: String
  }

  type KoneksiData {
    _id: ID!
    idPelanggan: Pengguna!
    statusVerifikasi: Boolean!
    NIK: String!
    NIKUrl: String!
    noKK: String!
    KKUrl: String!
    IMB: String!
    IMBUrl: String!
    alamat: String!
    kelurahan: String!
    kecamatan: String!
    luasBangunan: Float!
    createdAt: String
    updatedAt: String
  }

  type RiwayatPenggunaan {
    _id: ID!
    meterId: Meteran!
    penggunaanAir: Float!
    timestamp: String!
    createdAt: String
    updatedAt: String
  }

  type Tagihan {
    _id: ID!
    idMeteran: Meteran!
    periode: String!
    penggunaanSebelum: Float!
    penggunaanSekarang: Float!
    totalPemakaian: Float!
    biaya: Float!
    biayaBeban: Float!
    totalBiaya: Float!
    statusPembayaran: EnumPaymentStatus!
    tanggalPembayaran: String
    metodePembayaran: String
    tenggatWaktu: String!
    menunggak: Boolean!
    denda: Float
    catatan: String
    createdAt: String
    updatedAt: String
  }

  type Geolocation {
    _id: ID!
    longitude: Float!
    latitude: Float!
  }

  input GeolocationInput {
    longitude: Float!
    latitude: Float!
  }

  type Laporan {
    _id: ID!
    idPengguna: Pengguna!
    namaLaporan: String!
    masalah: String!
    alamat: String!
    imageUrl: [String!]!
    jenisLaporan: EnumJenisLaporan!
    catatan: String
    koordinat: Geolocation
    status: EnumWorkStatusPelanggan!
    createdAt: String
    updatedAt: String
  }

  type RABConnection {
    _id: ID!
    idKoneksiData: KoneksiData!
    totalBiaya: Float!
    statusPembayaran: EnumPaymentStatus!
    urlRab: String!
    catatan: String
    createdAt: String
    updatedAt: String
  }

  type Survei {
    _id: ID!
    idKoneksiData: KoneksiData!
    idTeknisi: Teknisi
    koordinat: Geolocation
    urlJaringan: String
    diameterPipa: Float
    urlPosisiBak: String
    posisiMeteran: String
    jumlahPenghuni: String
    standar: Boolean!
    catatan: String
    createdAt: String
    updatedAt: String
  }

  type PekerjaanTeknisi {
    _id: ID!
    idSurvei: Survei
    rabId: RABConnection
    idPenyelesaianLaporan: PenyelesaianLaporan
    idPemasangan: Pemasangan
    idPengawasanPemasangan: PengawasanPemasangan
    idPengawasanSetelahPemasangan: PengawasanSetelahPemasangan
    tim: [Teknisi!]
    status: EnumWorkStatus!
    disetujui: Boolean
    catatan: String
    createdAt: String
    updatedAt: String
  }

  type PenyelesaianLaporan {
    _id: ID!
    idLaporan: Laporan!
    urlGambar: [String!]!
    catatan: String!
    teknisiId: Teknisi
    tanggalSelesai: String
    metadata: PenyelesaianMetadata
    createdAt: String
    updatedAt: String
  }

  type PenyelesaianMetadata {
    durasiPengerjaan: Float
    materialDigunakan: [String!]
    biaya: Float
  }

  type Pemasangan {
    _id: ID!
    idKoneksiData: KoneksiData!
    seriMeteran: String!
    fotoRumah: String!
    fotoMeteran: String!
    fotoMeteranDanRumah: String!
    catatan: String
    teknisiId: Teknisi!
    tanggalPemasangan: String
    statusVerifikasi: String!
    diverifikasiOleh: Admin
    tanggalVerifikasi: String
    detailPemasangan: DetailPemasangan
    createdAt: String
    updatedAt: String
  }

  type DetailPemasangan {
    diameterPipa: Float
    lokasiPemasangan: String
    koordinat: Geolocation
    materialDigunakan: [String!]
  }

  type PengawasanPemasangan {
    _id: ID!
    idPemasangan: Pemasangan!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: Teknisi!
    tanggalPengawasan: String
    hasilPengawasan: String!
    temuan: [String!]
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistPengawasan
    createdAt: String
    updatedAt: String
  }

  type ChecklistPengawasan {
    kualitasSambunganPipa: String
    posisiMeteran: String
    kebersihanPemasangan: String
    kepatuhanK3: String
  }

  type PengawasanSetelahPemasangan {
    _id: ID!
    idPemasangan: Pemasangan!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: Teknisi!
    tanggalPengawasan: String
    hariSetelahPemasangan: Int
    hasilPengawasan: String!
    statusMeteran: String!
    bacaanAwal: Float
    masalahDitemukan: [String!]
    tindakan: String
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistSetelahPemasangan
    feedbackPelanggan: FeedbackPelanggan
    createdAt: String
    updatedAt: String
  }

  type ChecklistSetelahPemasangan {
    meteranBacaCorrect: Boolean
    tidakAdaKebocoran: Boolean
    sambunganAman: Boolean
    mudahDibaca: Boolean
    pelangganPuas: Boolean
    dokumentasiLengkap: Boolean
  }

  type FeedbackPelanggan {
    rating: Int
    komentar: String
  }

  type Notifikasi {
    _id: ID!
    idPelanggan: Pengguna
    idAdmin: Admin
    idTeknisi: Teknisi
    judul: String!
    pesan: String!
    kategori: EnumKategori!
    link: String
    isRead: Boolean!
    createdAt: String
    updatedAt: String
  }

  # ============================================
  # QUERIES - Admin Panel Operations
  # ============================================

  type Query {
    # Admin queries
    getAdmin(id: ID!): Admin
    getAllAdmins: [Admin!]!
    loginAdmin(email: String!, password: String!): AuthPayload!

    # Pelanggan queries
    getPengguna(id: ID!): Pengguna
    getAllPengguna: [Pengguna!]!
    searchPengguna(search: String!): [Pengguna!]!

    # Teknisi queries
    getTeknisi(id: ID!): Teknisi
    getAllTeknisi: [Teknisi!]!
    getTeknisiByDivisi(divisi: EnumDivisiTeknisi!): [Teknisi!]!

    # Kelompok Pelanggan queries
    getKelompokPelanggan(id: ID!): KelompokPelanggan
    getAllKelompokPelanggan: [KelompokPelanggan!]!

    # Meteran queries
    getMeteran(id: ID!): Meteran
    getAllMeteran: [Meteran!]!
    getMeteranByPelanggan(idPelanggan: ID!): [Meteran!]!

    # Connection Data queries
    getKoneksiData(id: ID!): KoneksiData
    getAllKoneksiData: [KoneksiData!]!
    getPendingKoneksiData: [KoneksiData!]!
    getVerifiedKoneksiData: [KoneksiData!]!

    # Tagihan queries
    getTagihan(id: ID!): Tagihan
    getAllTagihan: [Tagihan!]!
    getTagihanByMeteran(idMeteran: ID!): [Tagihan!]!
    getTagihanByStatus(status: EnumPaymentStatus!): [Tagihan!]!
    getTunggakan: [Tagihan!]!

    # Laporan queries
    getLaporan(id: ID!): Laporan
    getAllLaporan: [Laporan!]!
    getLaporanByStatus(status: EnumWorkStatusPelanggan!): [Laporan!]!
    getLaporanByPelanggan(idPelanggan: ID!): [Laporan!]!

    # Work Order (Pekerjaan Teknisi) queries
    getWorkOrder(id: ID!): PekerjaanTeknisi
    getAllWorkOrders: [PekerjaanTeknisi!]!
    getWorkOrdersByStatus(status: EnumWorkStatus!): [PekerjaanTeknisi!]!
    getWorkOrdersByTeknisi(idTeknisi: ID!): [PekerjaanTeknisi!]!

    # RAB Connection queries
    getRABConnection(id: ID!): RABConnection
    getAllRABConnections: [RABConnection!]!
    getPendingRAB: [RABConnection!]!

    # Survei queries
    getSurvei(id: ID!): Survei
    getAllSurvei: [Survei!]!

    # Notifikasi queries
    getNotifikasi(id: ID!): Notifikasi
    getNotifikasiByAdmin(idAdmin: ID!): [Notifikasi!]!
    getUnreadNotifikasi(idAdmin: ID!): [Notifikasi!]!
    getAllNotifikasiAdmin: [Notifikasi!]!

    # Dashboard Stats
    getDashboardStats: DashboardStats!
    getChartKonsumsiPerBulan: [BulanKonsumsiData!]!
    getDistribusiKelompokPelanggan: [KelompokDistribusiData!]!

    # Laporan Keuangan
    getLaporanKeuanganBulanan: [LaporanKeuanganBulanan!]!
    getTunggakanPerKelompok: [TunggakanPerKelompok!]!
    getTagihanTertinggi(limit: Int): [TagihanTertinggi!]!
    getRingkasanStatusTagihan: RingkasanStatusTagihan!

    # Laporan Operasional
    getKpiOperasional: KpiOperasional!
    getRingkasanWorkOrder: [RingkasanWorkOrder!]!
    getRingkasanLaporan: [RingkasanLaporan!]!

    # Pekerjaan Teknisi queries (ERD Compliant)
    getPekerjaanTeknisi(id: ID!): PekerjaanTeknisi
    getAllPekerjaanTeknisi: [PekerjaanTeknisi!]!
    getPekerjaanTeknisiByStatus(status: EnumWorkStatus!): [PekerjaanTeknisi!]!
    getPekerjaanTeknisiByTeknisi(teknisiId: ID!): [PekerjaanTeknisi!]!
    getPekerjaanTeknisiPendingApproval: [PekerjaanTeknisi!]!

    # Penyelesaian Laporan queries
    getPenyelesaianLaporan(id: ID!): PenyelesaianLaporan
    getPenyelesaianLaporanByLaporan(idLaporan: ID!): [PenyelesaianLaporan!]!
    getPenyelesaianLaporanByTeknisi(teknisiId: ID!): [PenyelesaianLaporan!]!
    getAllPenyelesaianLaporan: [PenyelesaianLaporan!]!

    # Pemasangan queries
    getPemasangan(id: ID!): Pemasangan
    getPemasanganByKoneksiData(idKoneksiData: ID!): Pemasangan
    getPemasanganByTeknisi(teknisiId: ID!): [Pemasangan!]!
    getPemasanganByStatus(statusVerifikasi: String!): [Pemasangan!]!
    getAllPemasangan: [Pemasangan!]!

    # Pengawasan Pemasangan queries
    getPengawasanPemasangan(id: ID!): PengawasanPemasangan
    getPengawasanPemasanganByPemasangan(idPemasangan: ID!): [PengawasanPemasangan!]!
    getPengawasanPemasanganBySupervisor(supervisorId: ID!): [PengawasanPemasangan!]!
    getPengawasanPemasanganProblematic: [PengawasanPemasangan!]!
    getAllPengawasanPemasangan: [PengawasanPemasangan!]!

    # Pengawasan Setelah Pemasangan queries
    getPengawasanSetelahPemasangan(id: ID!): PengawasanSetelahPemasangan
    getPengawasanSetelahPemasanganByPemasangan(idPemasangan: ID!): [PengawasanSetelahPemasangan!]!
    getPengawasanSetelahPemasanganBySupervisor(supervisorId: ID!): [PengawasanSetelahPemasangan!]!
    getPengawasanSetelahPemasanganProblematic: [PengawasanSetelahPemasangan!]!
    getAllPengawasanSetelahPemasangan: [PengawasanSetelahPemasangan!]!
    getAverageCustomerRating: AverageRatingResult!
  }

  # ============================================
  # MUTATIONS - Admin Panel Operations
  # ============================================

  type Mutation {
    # Admin mutations
    createAdmin(input: CreateAdminInput!): Admin!
    updateAdmin(id: ID!, input: UpdateAdminInput!): Admin!
    deleteAdmin(id: ID!): DeleteResponse!

    # Pelanggan mutations
    createPelanggan(input: CreatePelangganInput!): Pengguna!
    updatePelanggan(id: ID!, input: UpdatePelangganInput!): Pengguna!
    deletePelanggan(id: ID!): DeleteResponse!

    # Teknisi mutations
    createTeknisi(input: CreateTeknisiInput!): Teknisi!
    updateTeknisi(id: ID!, input: UpdateTeknisiInput!): Teknisi!
    deleteTeknisi(id: ID!): DeleteResponse!

    # Kelompok Pelanggan mutations
    createKelompokPelanggan(input: CreateKelompokPelangganInput!): KelompokPelanggan!
    updateKelompokPelanggan(id: ID!, input: UpdateKelompokPelangganInput!): KelompokPelanggan!
    deleteKelompokPelanggan(id: ID!): DeleteResponse!

    # Connection Data mutations
    verifyKoneksiData(id: ID!, verified: Boolean!, catatan: String): KoneksiData!
    updateKoneksiData(id: ID!, input: UpdateKoneksiDataInput!): KoneksiData!

    # Tagihan mutations
    generateTagihan(idMeteran: ID!, periode: String!): Tagihan!
    generateTagihanBulanan(periode: String!, idMeteranList: [ID!]!): HasilGenerateTagihan!
    updateStatusPembayaran(id: ID!, status: EnumPaymentStatus!): Tagihan!

    # Work Order mutations
    createWorkOrder(input: CreateWorkOrderInput!): PekerjaanTeknisi!
    assignWorkOrder(id: ID!, teknisiIds: [ID!]!): PekerjaanTeknisi!
    updateWorkOrderStatus(id: ID!, status: EnumWorkStatus!, catatan: String): PekerjaanTeknisi!
    approveWorkOrder(id: ID!, disetujui: Boolean!, catatan: String): PekerjaanTeknisi!

    # Laporan mutations
    updateLaporanStatus(id: ID!, status: EnumWorkStatusPelanggan!): Laporan!

    # Notifikasi mutations
    createNotifikasi(input: CreateNotifikasiInput!): Notifikasi!
    markNotifikasiAsRead(id: ID!): Notifikasi!
  }

  # ============================================
  # INPUT TYPES
  # ============================================

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

  input CreatePelangganInput {
    email: String!
    noHP: String!
    namaLengkap: String!
    password: String!
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

  input UpdateKoneksiDataInput {
    statusVerifikasi: Boolean
    alamat: String
    kelurahan: String
    kecamatan: String
    luasBangunan: Float
  }

  input CreateWorkOrderInput {
    idSurvei: ID
    rabId: ID
    idPenyelesaianLaporan: ID
    idPemasangan: ID
    tim: [ID!]!
    catatan: String
  }

  input CreateNotifikasiInput {
    idPelanggan: ID
    idAdmin: ID
    idTeknisi: ID
    judul: String!
    pesan: String!
    kategori: EnumKategori!
    link: String
  }

  # ============================================
  # INPUT TYPES - ERD COMPLIANT MODELS
  # ============================================

  input CreatePekerjaanTeknisiInput {
    idSurvei: ID
    rabId: ID
    idPenyelesaianLaporan: ID
    idPemasangan: ID
    idPengawasanPemasangan: ID
    idPengawasanSetelahPemasangan: ID
    tim: [ID!]!
    status: EnumWorkStatus
    catatan: String
  }

  input UpdatePekerjaanTeknisiInput {
    idSurvei: ID
    rabId: ID
    idPenyelesaianLaporan: ID
    idPemasangan: ID
    idPengawasanPemasangan: ID
    idPengawasanSetelahPemasangan: ID
    tim: [ID!]
    status: EnumWorkStatus
    disetujui: Boolean
    catatan: String
  }

  input CreatePenyelesaianLaporanInput {
    idLaporan: ID!
    urlGambar: [String!]!
    catatan: String!
    teknisiId: ID
    tanggalSelesai: String
    metadata: PenyelesaianMetadataInput
  }

  input UpdatePenyelesaianLaporanInput {
    urlGambar: [String!]
    catatan: String
    teknisiId: ID
    tanggalSelesai: String
    metadata: PenyelesaianMetadataInput
  }

  input PenyelesaianMetadataInput {
    durasiPengerjaan: Float
    materialDigunakan: [String!]
    biaya: Float
  }

  input CreatePemasanganInput {
    idKoneksiData: ID!
    seriMeteran: String!
    fotoRumah: String!
    fotoMeteran: String!
    fotoMeteranDanRumah: String!
    catatan: String
    teknisiId: ID!
    tanggalPemasangan: String
    detailPemasangan: DetailPemasanganInput
  }

  input UpdatePemasanganInput {
    seriMeteran: String
    fotoRumah: String
    fotoMeteran: String
    fotoMeteranDanRumah: String
    catatan: String
    teknisiId: ID
    statusVerifikasi: String
    detailPemasangan: DetailPemasanganInput
  }

  input DetailPemasanganInput {
    diameterPipa: Float
    lokasiPemasangan: String
    koordinat: GeolocationInput
    materialDigunakan: [String!]
  }

  input CreatePengawasanPemasanganInput {
    idPemasangan: ID!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: ID!
    tanggalPengawasan: String
    hasilPengawasan: String!
    temuan: [String!]
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistPengawasanInput
  }

  input UpdatePengawasanPemasanganInput {
    urlGambar: [String!]
    catatan: String
    supervisorId: ID
    tanggalPengawasan: String
    hasilPengawasan: String
    temuan: [String!]
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistPengawasanInput
  }

  input ChecklistPengawasanInput {
    kualitasSambunganPipa: String
    posisiMeteran: String
    kebersihanPemasangan: String
    kepatuhanK3: String
  }

  input CreatePengawasanSetelahPemasanganInput {
    idPemasangan: ID!
    urlGambar: [String!]!
    catatan: String!
    supervisorId: ID!
    tanggalPengawasan: String
    hasilPengawasan: String!
    statusMeteran: String!
    bacaanAwal: Float
    masalahDitemukan: [String!]
    tindakan: String
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistSetelahPemasanganInput
    feedbackPelanggan: FeedbackPelangganInput
  }

  input UpdatePengawasanSetelahPemasanganInput {
    urlGambar: [String!]
    catatan: String
    supervisorId: ID
    tanggalPengawasan: String
    hasilPengawasan: String
    statusMeteran: String
    bacaanAwal: Float
    masalahDitemukan: [String!]
    tindakan: String
    rekomendasi: String
    perluTindakLanjut: Boolean
    checklist: ChecklistSetelahPemasanganInput
    feedbackPelanggan: FeedbackPelangganInput
  }

  input ChecklistSetelahPemasanganInput {
    meteranBacaCorrect: Boolean
    tidakAdaKebocoran: Boolean
    sambunganAman: Boolean
    mudahDibaca: Boolean
    pelangganPuas: Boolean
    dokumentasiLengkap: Boolean
  }

  input FeedbackPelangganInput {
    rating: Int
    komentar: String
  }

  # ============================================
  # RESPONSE TYPES
  # ============================================

  type AuthPayload {
    token: String!
    admin: Admin!
  }

  type DeleteResponse {
    success: Boolean!
    message: String!
  }

  type DashboardStats {
    totalPelanggan: Int!
    totalTeknisi: Int!
    totalMeteran: Int!
    pendingKoneksi: Int!
    activeWorkOrders: Int!
    totalTagihanBulanIni: Float!
    tunggakanAktif: Int!
    laporanTerbuka: Int!
  }

  type BulanKonsumsiData {
    bulan: String!
    totalTagihan: Float!
    jumlahTagihan: Int!
  }

  type KelompokDistribusiData {
    namaKelompok: String!
    jumlahMeteran: Int!
  }

  type LaporanKeuanganBulanan {
    bulan: String!
    totalTagihan: Float!
    totalLunas: Float!
    jumlahTagihan: Int!
    jumlahLunas: Int!
  }

  type TunggakanPerKelompok {
    namaKelompok: String!
    totalTunggakan: Float!
    jumlahTunggakan: Int!
  }

  type TagihanTertinggi {
    nomorMeteran: String!
    nomorAkun: String!
    namaKelompok: String!
    totalBiaya: Float!
    periode: String!
    statusPembayaran: String!
  }

  type RingkasanStatusTagihan {
    totalTagihan: Int!
    totalLunas: Int!
    totalTunggakan: Int!
    totalPending: Int!
    nilaiTotal: Float!
    nilaiLunas: Float!
    nilaiTunggakan: Float!
  }

  type AverageRatingResult {
    avgRating: Float!
    count: Int!
  }

  type HasilGenerateTagihan {
    berhasil: Int!
    gagal: Int!
    pesan: String
  }

  type KpiOperasional {
    totalMeteranTerpasang: Int!
    totalPelanggan: Int!
    totalLaporanMasuk: Int!
    totalLaporanSelesai: Int!
    totalWorkOrderAktif: Int!
    totalWorkOrderSelesai: Int!
    totalTeknisi: Int!
    tingkatPenyelesaianLaporan: Float!
  }

  type RingkasanWorkOrder {
    status: String!
    jumlah: Int!
  }

  type RingkasanLaporan {
    status: String!
    jumlah: Int!
  }
`;
