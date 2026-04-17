// Operasi READ & WRITE Teknisi: coba proxy ke backend Teknisi dulu, fallback langsung ke MongoDB shared
// Semua operasi memiliki MongoDB fallback sehingga halaman tetap berfungsi tanpa backend Rafli.

import bcrypt from 'bcryptjs';
import { teknisiGraphQL } from '../../../utils/teknisiClient.js';
import Technician from '../../../models/Technician.js';
import { verifyAdminToken } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

function getToken(ctx: GraphQLContext): string | undefined {
  return ctx.token ?? undefined;
}

const TEKNISI_FIELDS = `
  id namaLengkap nip email noHp divisi isActive pekerjaanSekarang createdAt updatedAt
`;

// Konversi aman: Date object, epoch-ms number, epoch-ms string, atau ISO string → ISO string
function safeIso(val: any): string | null {
  if (!val) return null;
  try {
    // Epoch ms sebagai number atau string yang hanya digit
    if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
      const d = new Date(Number(val));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

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
    createdAt: safeIso(t.createdAt),
    updatedAt: safeIso(t.updatedAt),
  };
}

export const teknisiResolvers = {
  Query: {
    getAllTeknisi: async (_: any, { search }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query GetAllTeknisi($search: String) {
            users(search: $search) { ${TEKNISI_FIELDS} }
          }`,
          { search },
          getToken(ctx)
        );
        return (data as any).users ?? [];
      } catch (err: any) {
        console.error('[getAllTeknisi] Teknisi backend tidak tersedia, fallback ke MongoDB:', err.message);
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
        const data = await teknisiGraphQL(
          `query GetTeknisi($id: ID!) {
            user(id: $id) { ${TEKNISI_FIELDS} }
          }`,
          { id },
          getToken(ctx)
        );
        return (data as any).user ?? null;
      } catch (err: any) {
        console.error('[getTeknisi] Teknisi backend tidak tersedia, fallback ke MongoDB:', err.message);
        const t = await Technician.findById(id).lean();
        return t ? normalizeTeknisi(t) : null;
      }
    },

    getTeknisiByDivisi: async (_: any, { divisi }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `query GetAllTeknisi {
            users { ${TEKNISI_FIELDS} }
          }`,
          {},
          getToken(ctx)
        );
        const all: any[] = (data as any).users ?? [];
        return all.filter((t) => t.divisi === divisi);
      } catch (err: any) {
        console.error('[getTeknisiByDivisi] Teknisi backend tidak tersedia, fallback ke MongoDB:', err.message);
        const list = await Technician.find({ divisi }).sort({ createdAt: -1 }).lean();
        return list.map(normalizeTeknisi);
      }
    },
  },

  Mutation: {
    createTeknisi: async (_: any, { input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation Register($input: RegisterInput!) {
            register(input: $input) {
              user { ${TEKNISI_FIELDS} }
            }
          }`,
          { input },
          getToken(ctx)
        );
        return (data as any).register.user;
      } catch (err: any) {
        console.error('[createTeknisi] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message ?? err);
        // Cek duplikat sebelum membuat
        const existing = await Technician.findOne({
          $or: [{ email: input.email }, { nip: input.nip }, { noHp: input.noHp }],
        });
        if (existing) {
          const field = existing.email === input.email ? 'email' : existing.nip === input.nip ? 'NIP' : 'nomor HP';
          throw new Error(`Teknisi dengan ${field} tersebut sudah terdaftar`);
        }
        const hashed = await bcrypt.hash(input.password, 10);
        const teknisi = await Technician.create({
          namaLengkap: input.namaLengkap,
          nip: input.nip,
          email: input.email,
          noHp: input.noHp,
          divisi: input.divisi,
          password: hashed,
          isActive: false,
        });
        return normalizeTeknisi(teknisi.toObject());
      }
    },

    updateTeknisi: async (_: any, { id, input }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation UpdateTeknisi($id: ID!, $input: UpdateUserInput!) {
            updateUser(id: $id, input: $input) { ${TEKNISI_FIELDS} }
          }`,
          { id, input },
          getToken(ctx)
        );
        return (data as any).updateUser;
      } catch (err: any) {
        console.error('[updateTeknisi] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message ?? err);
        const updated = await Technician.findByIdAndUpdate(
          id,
          { $set: input },
          { new: true, runValidators: true }
        ).lean();
        if (!updated) throw new Error('Teknisi tidak ditemukan');
        return normalizeTeknisi(updated);
      }
    },

    toggleTeknisiStatus: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
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
      } catch (err: any) {
        console.error('[toggleTeknisiStatus] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message ?? err);
        const teknisi = await Technician.findById(id).lean();
        if (!teknisi) throw new Error('Teknisi tidak ditemukan');
        const updated = await Technician.findByIdAndUpdate(
          id,
          { $set: { isActive: !teknisi.isActive } },
          { new: true }
        ).lean();
        return {
          success: true,
          message: `Status teknisi diubah menjadi ${updated!.isActive ? 'aktif' : 'nonaktif'}`,
          user: normalizeTeknisi(updated!),
        };
      }
    },

    deleteTeknisi: async (_: any, { id }: any, ctx: GraphQLContext) => {
      verifyAdminToken(ctx.token);
      try {
        const data = await teknisiGraphQL(
          `mutation DeleteTeknisi($id: ID!) {
            deleteUser(id: $id) { success message }
          }`,
          { id },
          getToken(ctx)
        );
        return (data as any).deleteUser;
      } catch (err: any) {
        console.error('[deleteTeknisi] Rafli backend tidak tersedia, fallback ke MongoDB:', err.message ?? err);
        const deleted = await Technician.findByIdAndDelete(id);
        if (!deleted) throw new Error('Teknisi tidak ditemukan');
        return { success: true, message: 'Teknisi berhasil dihapus' };
      }
    },
  },
};
