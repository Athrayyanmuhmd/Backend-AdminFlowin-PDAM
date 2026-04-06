import { baseTypeDefs } from './base.js';
import { authTypeDefs } from './auth.js';
import { pelangganTypeDefs } from './pelanggan.js';
import { kelompokPelangganTypeDefs } from './kelompokPelanggan.js';
import { meteranTypeDefs } from './meteran.js';
import { koneksiDataTypeDefs } from './koneksiData.js';
import { tagihanTypeDefs } from './tagihan.js';
import { laporanTypeDefs } from './laporan.js';
import { workOrderTypeDefs } from './workOrder.js';
import { surveiTypeDefs } from './survei.js';
import { notifikasiTypeDefs } from './notifikasi.js';
import { pemasanganTypeDefs } from './pemasangan.js';
import { dashboardTypeDefs } from './dashboard.js';

// Apollo Server accepts an array of DocumentNode — it merges them automatically.
// All domain files use `extend type Query` / `extend type Mutation`
// while base.ts declares the root Query and Mutation types.
export const typeDefs = [
  baseTypeDefs,
  authTypeDefs,
  pelangganTypeDefs,
  kelompokPelangganTypeDefs,
  meteranTypeDefs,
  koneksiDataTypeDefs,
  tagihanTypeDefs,
  laporanTypeDefs,
  workOrderTypeDefs,
  surveiTypeDefs,
  notifikasiTypeDefs,
  pemasanganTypeDefs,
  dashboardTypeDefs,
];
