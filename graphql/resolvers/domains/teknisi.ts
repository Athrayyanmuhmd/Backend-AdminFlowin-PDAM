// Operasi READ Teknisi: coba proxy ke Rafli dulu, fallback langsung ke MongoDB shared
// Operasi WRITE (create/update/delete/toggle) tetap proxy ke Rafli karena butuh auth Rafli

import { rafliGraphQL } from '../../../utils/rafliClient.js';
import Technician from '../../../models/Technician.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

function getToken(ctx: GraphQLContext): string | undefined {
  return ctx.token ?? undefined;
}

const TEKNISI_FIELDS = `
  id namaLengkap nip email noHp divisi isActive pekerjaanSekarang createdAt updatedAt
`;

// Normalize MongoDB dokumen Teknisi → shape yang konsisten dengan GraphQL Teknisi type
function normalizeTeknisi(t: any) {
  return {
    id: t._id?.toString() ?? t.id,
    namaLengkap: t.namaLengkap,
    nip: t.nip ?? null,
    email: t.email ?? null,
    noHp: t.noHp ?? null,
    divisi: t.divisi ?? null,
    isActive: t.isActive ?? false,
    pekerjaanSekarang: t.pekerjaanSekarang?.toString() ?? null,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
  };
}

export const teknisiResolvers = {
  Query: {
    getAllTeknisi: async (_: any, { search }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query GetAllTeknisi($search: String) {
            users(search: $search) { ${TEKNISI_FIELDS} }
          }`,
          { search },
          getToken(ctx)
        );
        return (data as any).users ?? [];
      } catch (err: any) {
        console.error('[getAllTeknisi] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        // Fallback: baca langsung dari koleksi teknisiperumdams
        const filter: any = {};
        if (search) {
          const re = new RegExp(search, 'i');
          filter.$or = [{ namaLengkap: re }, { email: re }, { nip: re }];
        }
        const list = await Technician.find(filter).sort({ createdAt: -1 }).lean();
        return list.map(normalizeTeknisi);
      }
    },

    getTeknisi: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query GetTeknisi($id: ID!) {
            user(id: $id) { ${TEKNISI_FIELDS} }
          }`,
          { id },
          getToken(ctx)
        );
        return (data as any).user ?? null;
      } catch (err: any) {
        console.error('[getTeknisi] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        const t = await Technician.findById(id).lean();
        return t ? normalizeTeknisi(t) : null;
      }
    },

    getTeknisiByDivisi: async (_: any, { divisi }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await rafliGraphQL(
          `query GetAllTeknisi {
            users { ${TEKNISI_FIELDS} }
          }`,
          {},
          getToken(ctx)
        );
        const all: any[] = (data as any).users ?? [];
        return all.filter((t) => t.divisi === divisi);
      } catch (err: any) {
        console.error('[getTeknisiByDivisi] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message);
        const list = await Technician.find({ divisi }).sort({ createdAt: -1 }).lean();
        return list.map(normalizeTeknisi);
      }
    },
  },

  Mutation: {
    createTeknisi: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      // Proxy ke Rafli's register mutation
      const data = await rafliGraphQL(
        `mutation Register($input: RegisterInput!) {
          register(input: $input) {
            user { ${TEKNISI_FIELDS} }
          }
        }`,
        { input },
        getToken(ctx)
      );
      return (data as any).register.user;
    },

    updateTeknisi: async (_: any, { id, input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      const data = await rafliGraphQL(
        `mutation UpdateTeknisi($id: ID!, $input: UpdateUserInput!) {
          updateUser(id: $id, input: $input) { ${TEKNISI_FIELDS} }
        }`,
        { id, input },
        getToken(ctx)
      );
      return (data as any).updateUser;
    },

    toggleTeknisiStatus: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      const data = await rafliGraphQL(
        `mutation ToggleTeknisiStatus($id: ID!) {
          toggleUserStatus(id: $id) {
            success message
            user { ${TEKNISI_FIELDS} }
          }
        }`,
        { id },
        getToken(ctx)
      );
      return (data as any).toggleUserStatus;
    },

    deleteTeknisi: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      const data = await rafliGraphQL(
        `mutation DeleteTeknisi($id: ID!) {
          deleteUser(id: $id) { success message }
        }`,
        { id },
        getToken(ctx)
      );
      return (data as any).deleteUser;
    },
  },
};
