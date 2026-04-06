import { gql } from 'graphql-tag';

export const dashboardTypeDefs = gql`
  type DashboardStats {
    totalPelanggan: Int!
    totalTeknisi: Int!
    totalMeteran: Int!
    pendingKoneksi: Int!
    activeWorkOrders: Int!
    totalTagihanBulanIni: Float!
    tunggakanAktif: Int!
    laporanTerbuka: Int!
    koneksiMenunggu: Int!
    koneksiDisetujui: Int!
    koneksiDitolak: Int!
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

  extend type Query {
    getDashboardStats: DashboardStats!
    getChartKonsumsiPerBulan: [BulanKonsumsiData!]!
    getDistribusiKelompokPelanggan: [KelompokDistribusiData!]!
    getLaporanKeuanganBulanan: [LaporanKeuanganBulanan!]!
    getTunggakanPerKelompok: [TunggakanPerKelompok!]!
    getTagihanTertinggi(limit: Int): [TagihanTertinggi!]!
    getRingkasanStatusTagihan: RingkasanStatusTagihan!
    getKpiOperasional: KpiOperasional!
    getRingkasanWorkOrder: [RingkasanWorkOrder!]!
    getRingkasanLaporan: [RingkasanLaporan!]!
  }
`;
