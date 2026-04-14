// Resolver aggregator — merges all domain resolver objects into one.
// Apollo Server handles deep-merging of Query/Mutation keys when an array is passed,
// but for simplicity we merge manually here so apolloServer.ts keeps a single import.

import { authResolvers } from './domains/auth.js';
import { pelangganResolvers } from './domains/pelanggan.js';
import { kelompokPelangganResolvers } from './domains/kelompokPelanggan.js';
import { meteranResolvers } from './domains/meteran.js';
import { koneksiDataResolvers } from './domains/koneksiData.js';
import { tagihanResolvers } from './domains/tagihan.js';
import { laporanResolvers } from './domains/laporan.js';
import { workOrderResolvers } from './domains/workOrder.js';
import { teknisiResolvers } from './domains/teknisi.js';
import { surveiResolvers } from './domains/survei.js';
import { notifikasiResolvers } from './domains/notifikasi.js';
import { pemasanganResolvers } from './domains/pemasangan.js';
import { dashboardResolvers } from './domains/dashboard.js';
import { fieldResolvers } from './domains/fieldResolvers.js';

const domainResolvers = [
  authResolvers,
  pelangganResolvers,
  kelompokPelangganResolvers,
  meteranResolvers,
  koneksiDataResolvers,
  tagihanResolvers,
  laporanResolvers,
  workOrderResolvers,
  teknisiResolvers,
  surveiResolvers,
  notifikasiResolvers,
  pemasanganResolvers,
  dashboardResolvers,
];

// Merge Query and Mutation from all domain resolvers
const mergedQuery: Record<string, any> = {};
const mergedMutation: Record<string, any> = {};

for (const domain of domainResolvers as any[]) {
  if (domain.Query) Object.assign(mergedQuery, domain.Query);
  if (domain.Mutation) Object.assign(mergedMutation, domain.Mutation);
}

export const resolvers = {
  Query: mergedQuery,
  Mutation: mergedMutation,
  // Field resolvers (type-level)
  ...fieldResolvers,
};
