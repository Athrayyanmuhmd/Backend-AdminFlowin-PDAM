import { gql } from 'graphql-tag';

export const monitoringTypeDefs = gql`
  # Data pemakaian per hari (dari Redis hash DataHarian Ahmad)
  type DataHarian {
    tanggal: String!
    liter: Float!
  }

  # Data bulanan meteran (bisa dari Redis atau MongoDB)
  type MonitoringBulanData {
    periode: String!
    totalPenggunaan: Float!
    dataHarian: [DataHarian!]!
    sumberData: String!
  }

  # Prediksi pemakaian akhir bulan
  type MonitoringPrediksi {
    rataRataHarian: Float!
    prediksiAkhirBulan: Float!
    hariTersisa: Int!
    hariTercatat: Int!
  }

  # Perbandingan bulan ini vs bulan lalu
  type MonitoringPerbandingan {
    bulanIni: Float!
    bulanLalu: Float!
    selisih: Float!
    persentase: Float!
    status: String!
  }

  # Evaluasi kategori pemakaian
  type MonitoringEvaluasi {
    kategori: String!
    deskripsi: String!
  }

  # Dashboard monitoring lengkap per meteran
  type MonitoringDashboard {
    meteranId: ID!
    nomorMeteran: String!
    nomorAkun: String!
    namaKelompok: String
    bulanIni: MonitoringBulanData!
    bulanLalu: MonitoringBulanData
    prediksi: MonitoringPrediksi!
    perbandingan: MonitoringPerbandingan
    evaluasi: MonitoringEvaluasi!
    estimasiBiayaBulanIni: EstimasiBiaya!
    chartHarian: [DataHarian!]!
    latestReading: Float
    lastUpdate: String
    redisConnected: Boolean!
  }

  # Riwayat bulanan (6 bulan terakhir dari MongoDB Ahmad)
  type MonitoringHistoriBulan {
    periode: String!
    totalPenggunaan: Float!
    dataHarian: [DataHarian!]!
  }

  # Data harian per jam (dari Redis hash DataPerJam Ahmad)
  type DataPerJam {
    jam: String!
    liter: Float!
  }

  type MonitoringHarian {
    tanggal: String!
    dataPerJam: [DataPerJam!]!
    totalHari: Float!
  }

  extend type Query {
    getMonitoringDashboard(meteranId: ID!): MonitoringDashboard
    getMonitoringHistori(meteranId: ID!, jumlahBulan: Int): [MonitoringHistoriBulan!]!
    getMonitoringHarian(meteranId: ID!, tanggal: String!): MonitoringHarian
  }
`;
