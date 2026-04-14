// Semua operasi WorkOrder di-proxy ke Rafli (flowin-teknisi-graphql)
// Admin menggunakan JWT-nya sendiri sebagai Bearer token ke Rafli's API
// + x-api-key (INTERNAL_API_SECRET) otomatis ditambahkan oleh rafliGraphQL

import { rafliGraphQL } from '../../../utils/rafliClient.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

function getToken(ctx: GraphQLContext): string | undefined {
  return ctx.token ?? undefined;
}

export const workOrderResolvers = {
  Query: {
    workOrders: async (_: any, { filter, pagination }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query WorkOrders($filter: WorkOrderFilterInput, $pagination: PaginationInput) {
            workOrders(filter: $filter, pagination: $pagination) {
              data {
                id idKoneksiData jenisPekerjaan statusTim status statusRespon
                alasanPenolakan catatanTim catatanReview createdAt updatedAt
                teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
                tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
                koneksiData {
                  id statusPengajuan nik noKK imb alamat kelurahan kecamatan luasBangunan
                  nikUrl kkUrl imbUrl tanggalVerifikasi alasanPenolakan createdAt updatedAt
                  pelanggan { id namaLengkap email noHp }
                }
                workOrderSebelumnya { id jenisPekerjaan status }
                riwayatRespon { aksi alasan tanggal oleh { id namaLengkap } }
                riwayatReview { status catatan tanggal oleh { id namaLengkap } }
              }
              pagination { total page limit totalPages hasNextPage }
            }
          }`,
          { filter, pagination },
          getToken(ctx)
        );
        return (data as any).workOrders ?? { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false } };
      } catch (err: any) {
        console.error('[workOrders] Rafli backend tidak tersedia:', err.message);
        return { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false } };
      }
    },

    workOrder: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query WorkOrder($id: ID!) {
            workOrder(id: $id) {
              id idKoneksiData jenisPekerjaan statusTim status statusRespon
              alasanPenolakan catatanTim catatanReview catatanReviewPenolakan createdAt updatedAt
              idSurvei idRAB idPemasangan idPengawasanPemasangan idPengawasanSetelahPemasangan idPenyelesaianLaporan
              teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              koneksiData {
                id statusPengajuan nik noKK imb alamat kelurahan kecamatan luasBangunan
                nikUrl kkUrl imbUrl tanggalVerifikasi alasanPenolakan createdAt updatedAt
                pelanggan { id namaLengkap email noHp }
              }
              workOrderSebelumnya { id jenisPekerjaan status createdAt }
              riwayatRespon { aksi alasan tanggal oleh { id namaLengkap } }
              riwayatReview { status catatan tanggal oleh { id namaLengkap } }
            }
          }`,
          { id },
          getToken(ctx)
        );
        return (data as any).workOrder ?? null;
      } catch (err: any) {
        console.error('[workOrder] Rafli backend tidak tersedia:', err.message);
        return null;
      }
    },

    workOrdersByKoneksiData: async (_: any, { idKoneksiData }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query WorkOrdersByKoneksiData($idKoneksiData: ID!) {
            workOrdersByKoneksiData(idKoneksiData: $idKoneksiData) {
              id idKoneksiData jenisPekerjaan status statusRespon statusTim createdAt updatedAt
              teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
            }
          }`,
          { idKoneksiData },
          getToken(ctx)
        );
        return (data as any).workOrdersByKoneksiData ?? [];
      } catch (err: any) {
        console.error('[workOrdersByKoneksiData] Rafli backend tidak tersedia:', err.message);
        return [];
      }
    },

    workflowChain: async (_: any, { idKoneksiData }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query WorkflowChain($idKoneksiData: ID!) {
            workflowChain(idKoneksiData: $idKoneksiData) {
              jenisPekerjaan chainStatus urutan bisaDibuat
              workOrder {
                id status statusRespon statusTim createdAt updatedAt
                teknisiPenanggungJawab { id namaLengkap }
              }
            }
          }`,
          { idKoneksiData },
          getToken(ctx)
        );
        return (data as any).workflowChain ?? [];
      } catch (err: any) {
        console.error('[workflowChain] Rafli backend tidak tersedia:', err.message);
        return [];
      }
    },

    cekPrerequisitePekerjaan: async (_: any, { idKoneksiData, jenisPekerjaan }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query CekPrerequisite($idKoneksiData: ID!, $jenisPekerjaan: JenisPekerjaan!) {
            cekPrerequisitePekerjaan(idKoneksiData: $idKoneksiData, jenisPekerjaan: $jenisPekerjaan)
          }`,
          { idKoneksiData, jenisPekerjaan },
          getToken(ctx)
        );
        return (data as any).cekPrerequisitePekerjaan ?? false;
      } catch (err: any) {
        console.error('[cekPrerequisitePekerjaan] Rafli backend tidak tersedia:', err.message);
        return false;
      }
    },
  },

  Mutation: {
    buatWorkOrder: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `mutation BuatWorkOrder($input: BuatWorkOrderInput!) {
            buatWorkOrder(input: $input) {
              success message
              workOrder {
                id idKoneksiData jenisPekerjaan status statusRespon statusTim createdAt updatedAt
                teknisiPenanggungJawab { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
                tim { id namaLengkap email nip divisi noHp isActive createdAt updatedAt }
              }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).buatWorkOrder;
      } catch (err: any) {
        console.error('[buatWorkOrder] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}`, workOrder: null };
      }
    },

    reviewPenolakan: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `mutation ReviewPenolakan($input: ReviewPenolakanInput!) {
            reviewPenolakan(input: $input) {
              success message
              workOrder { id status statusRespon riwayatRespon { aksi alasan tanggal oleh { id namaLengkap } } }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).reviewPenolakan;
      } catch (err: any) {
        console.error('[reviewPenolakan] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}`, workOrder: null };
      }
    },

    reviewTim: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `mutation ReviewTim($input: ReviewTimInput!) {
            reviewTim(input: $input) {
              success message
              workOrder { id status statusTim tim { id namaLengkap } }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).reviewTim;
      } catch (err: any) {
        console.error('[reviewTim] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}`, workOrder: null };
      }
    },

    reviewHasil: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `mutation ReviewHasil($input: ReviewHasilInput!) {
            reviewHasil(input: $input) {
              success message
              workOrder { id status riwayatReview { status catatan tanggal oleh { id namaLengkap } } }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).reviewHasil;
      } catch (err: any) {
        console.error('[reviewHasil] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}`, workOrder: null };
      }
    },

    batalkanWorkOrder: async (_: any, { id, catatan }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `mutation BatalkanWorkOrder($id: ID!, $catatan: String) {
            batalkanWorkOrder(id: $id, catatan: $catatan) {
              success message
            }
          }`,
          { id, catatan },
          getToken(ctx)
        );
        return (data as any).batalkanWorkOrder;
      } catch (err: any) {
        console.error('[batalkanWorkOrder] Rafli backend error:', err.message);
        return { success: false, message: `Sistem teknisi tidak tersedia: ${err.message}` };
      }
    },
  },
};
