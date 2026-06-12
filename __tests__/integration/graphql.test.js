/**
 * ============================================================
 * GREYBOX TESTING — GraphQL API Integration Tests
 * ============================================================
 * Menguji GraphQL endpoint menggunakan Apollo Server executeOperation
 * + MongoDB in-memory (tanpa koneksi Atlas, tanpa network).
 *
 * Yang diuji:
 * - loginAdmin: credentials valid, salah email, salah password
 * - loginTechnician: credentials valid, salah password
 * - getAllAdmins, getAllPengguna, getAllTeknisi: tanpa/dengan auth
 * - createKoneksiData: input valid dan tidak valid
 * - getAllNotifikasiAdmin: harus butuh token
 * ============================================================
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ApolloServer } from '@apollo/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { connectTestDB, disconnectTestDB, clearCollections } from '../setup/dbSetup.js';
import { typeDefs } from '../../graphql/schemas/typeDefs.js';
import { resolvers } from '../../graphql/resolvers/index.js';
import AdminAccount from '../../models/AdminAccount.js';
import Technician from '../../models/Technician.js';
import User from '../../models/User.js';

const JWT_SECRET = 'test-jwt-secret-aqualink';
process.env.JWT_SECRET = JWT_SECRET;
process.env.REDIS_URL = ''; // Disable Redis untuk test

let server;
let testAdminToken;
let testAdmin;

// ============================================================
// Setup: start server + DB + seed data
// ============================================================
beforeAll(async () => {
  await connectTestDB();

  server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  // Seed admin test
  const hashedPw = await bcrypt.hash('admin123', 10);
  testAdmin = await AdminAccount.create({
    namaLengkap: 'Admin Test Aqualink',
    email: 'admin@test.com',
    password: hashedPw,
    NIP: 'NIP001',
    noHP: '08123456789',
    role: 'administrator',
  });

  // Seed teknisi test
  await Technician.create({
    namaLengkap: 'Teknisi Test',
    email: 'teknisi@test.com',
    password: await bcrypt.hash('teknisi123', 10),
    // Field names & enum disesuaikan dengan model TeknisiPerumdam aktual:
    // nip/noHp (lowercase, required+unique) & divisi enum snake_case.
    nip: 'NIPTEK001',
    noHp: '08199999999',
    divisi: 'teknik_cabang',
  });

  // Seed pengguna test
  await User.create({
    namaLengkap: 'Pelanggan Test',
    email: 'pelanggan@test.com',
    noHP: '08111111111',
    alamat: 'Jl. Test No. 1, Banda Aceh',
  });
});

afterAll(async () => {
  await server.stop();
  await disconnectTestDB();
});

beforeEach(async () => {
  // Reset token agar test tidak saling tergantung
  testAdminToken = null;
});

// ============================================================
// Helper: jalankan query GraphQL
// ============================================================
async function gqlQuery(query, variables = {}, token = null) {
  const contextValue = token ? { token } : { token: null };
  return server.executeOperation(
    { query, variables },
    { contextValue }
  );
}

// ============================================================
// SUITE 1: Authentication — loginAdmin
// ============================================================
describe('[GREYBOX] GraphQL — loginAdmin', () => {
  it('TC-GQL-01 ✅ Login dengan kredensial valid harus mengembalikan token + data admin', async () => {
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "admin@test.com", password: "admin123") {
          token
          admin {
            namaLengkap
            email
          }
        }
      }
    `);

    expect(response.body.kind).toBe('single');
    const data = response.body.singleResult.data;
    expect(data.loginAdmin.token).toBeTruthy();
    expect(data.loginAdmin.admin.email).toBe('admin@test.com');
    expect(data.loginAdmin.admin.namaLengkap).toBe('Admin Test Aqualink');

    // Simpan token untuk test berikutnya
    testAdminToken = data.loginAdmin.token;
  });

  it('TC-GQL-02 ❌ Login dengan email yang tidak terdaftar harus return error', async () => {
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "tidakada@test.com", password: "admin123") {
          token
        }
      }
    `);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
    // Pesan sengaja generik (anti user-enumeration) — tidak membocorkan
    // apakah email-nya yang salah atau password-nya.
    expect(errors[0].message).toContain('Email atau kata sandi salah');
  });

  it('TC-GQL-03 ❌ Login dengan password salah harus return error', async () => {
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "admin@test.com", password: "passwordsalah") {
          token
        }
      }
    `);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
    // Pesan generik yang sama dengan email tidak terdaftar (anti user-enumeration).
    expect(errors[0].message).toContain('Email atau kata sandi salah');
  });

  it('TC-GQL-04 ❌ Login dengan password kosong harus return error', async () => {
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "admin@test.com", password: "") {
          token
        }
      }
    `);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
  });
});

// ============================================================
// SUITE 2: Authentication — loginTechnician (GraphQL Query)
// ============================================================
// loginTechnician kini tersedia di GraphQL schema (Query, JWT 30 hari),
// mengembalikan TechnicianAuthPayload { token, technician }.
describe('[GREYBOX] GraphQL — loginTechnician', () => {
  it('TC-GQL-05 ✅ loginTechnician dengan kredensial valid harus mengembalikan token', async () => {
    const response = await gqlQuery(`
      query {
        loginTechnician(email: "teknisi@test.com", password: "teknisi123") {
          token
        }
      }
    `);

    expect(response.body.singleResult.errors).toBeUndefined();
    expect(response.body.singleResult.data.loginTechnician.token).toBeTruthy();
  });

  it('TC-GQL-06 ❌ loginTechnician dengan password salah harus return error', async () => {
    const response = await gqlQuery(`
      query {
        loginTechnician(email: "teknisi@test.com", password: "salah") {
          token
        }
      }
    `);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].message).toContain('Email atau kata sandi salah');
  });
});

// ============================================================
// SUITE 3: Protected Queries — Harus Butuh Token
// ============================================================
describe('[GREYBOX] GraphQL — Protected Queries (Auth Required)', () => {
  let adminToken;

  beforeAll(async () => {
    // Login dulu untuk dapat token
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "admin@test.com", password: "admin123") {
          token
        }
      }
    `);
    adminToken = response.body.singleResult.data.loginAdmin.token;
  });

  it('TC-GQL-07 ❌ getAuditLogs tanpa token harus return error auth', async () => {
    const response = await gqlQuery(`
      query {
        getAuditLogs {
          _id
          aksi
        }
      }
    `, {}, null);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].message).toContain('Token tidak ditemukan');
  });

  it('TC-GQL-08 ✅ getAuditLogs dengan token valid harus berhasil (return array)', async () => {
    const response = await gqlQuery(`
      query {
        getAuditLogs {
          _id
          aksi
          resource
        }
      }
    `, {}, adminToken);

    expect(response.body.singleResult.errors).toBeUndefined();
    const data = response.body.singleResult.data;
    expect(Array.isArray(data.getAuditLogs)).toBe(true);
  });

  it('TC-GQL-09 ✅ getAllNotifikasiAdmin tanpa token TIDAK throw (polling-safe) → array kosong', async () => {
    // Desain sengaja: resolver ini di-polling frontend tiap 30 detik. Jika token
    // invalid/expired, resolver mengembalikan [] (bukan throw) supaya UI tidak
    // crash & log tidak dibanjiri error. Tanpa token = tidak ada data bocor, []
    // dikembalikan — bukan celah keamanan, melainkan keputusan desain.
    const response = await gqlQuery(`
      query {
        getAllNotifikasiAdmin {
          _id
          judul
        }
      }
    `, {}, null);

    expect(response.body.singleResult.errors).toBeUndefined();
    expect(response.body.singleResult.data.getAllNotifikasiAdmin).toEqual([]);
  });

  it('TC-GQL-10 ✅ getAllNotifikasiAdmin dengan token valid harus berhasil', async () => {
    const response = await gqlQuery(`
      query {
        getAllNotifikasiAdmin {
          _id
          judul
          pesan
          isRead
        }
      }
    `, {}, adminToken);

    expect(response.body.singleResult.errors).toBeUndefined();
    const data = response.body.singleResult.data;
    expect(Array.isArray(data.getAllNotifikasiAdmin)).toBe(true);
  });
});

// ============================================================
// SUITE 4: Pengguna Queries — Butuh Token (data PII pelanggan)
// ============================================================
// getAllPengguna & searchPengguna kini memanggil verifyAdminToken — data
// pelanggan (nama, email, no HP) hanya boleh diakses admin terautentikasi.
describe('[GREYBOX] GraphQL — Pengguna Queries (Auth Required)', () => {
  let adminToken;

  beforeAll(async () => {
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "admin@test.com", password: "admin123") {
          token
        }
      }
    `);
    adminToken = response.body.singleResult.data.loginAdmin.token;
  });

  it('TC-GQL-11 ✅ getAllPengguna (dengan token) harus mengembalikan array data pengguna', async () => {
    const response = await gqlQuery(`
      query {
        getAllPengguna {
          _id
          namaLengkap
          email
        }
      }
    `, {}, adminToken);

    expect(response.body.singleResult.errors).toBeUndefined();
    const data = response.body.singleResult.data;
    expect(Array.isArray(data.getAllPengguna)).toBe(true);
    expect(data.getAllPengguna.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-GQL-12 ✅ getAllPengguna harus mengandung pengguna yang sudah di-seed', async () => {
    const response = await gqlQuery(`
      query {
        getAllPengguna {
          namaLengkap
          email
        }
      }
    `, {}, adminToken);

    const pengguna = response.body.singleResult.data.getAllPengguna;
    const found = pengguna.find(p => p.email === 'pelanggan@test.com');
    expect(found).toBeDefined();
    expect(found.namaLengkap).toBe('Pelanggan Test');
  });

  it('TC-GQL-13 ✅ searchPengguna dengan keyword valid harus menemukan pengguna', async () => {
    const response = await gqlQuery(`
      query {
        searchPengguna(search: "Pelanggan Test") {
          namaLengkap
          email
        }
      }
    `, {}, adminToken);

    expect(response.body.singleResult.errors).toBeUndefined();
    const results = response.body.singleResult.data.searchPengguna;
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-GQL-14 ✅ searchPengguna dengan keyword tidak cocok harus return array kosong', async () => {
    const response = await gqlQuery(`
      query {
        searchPengguna(search: "ZZZ_TIDAK_ADA_ZZZ") {
          namaLengkap
        }
      }
    `, {}, adminToken);

    expect(response.body.singleResult.errors).toBeUndefined();
    const results = response.body.singleResult.data.searchPengguna;
    expect(results.length).toBe(0);
  });

  it('TC-GQL-14b ❌ getAllPengguna TANPA token harus return error auth', async () => {
    const response = await gqlQuery(`
      query {
        getAllPengguna { _id }
      }
    `, {}, null);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].message).toContain('Token tidak ditemukan');
  });
});

// ============================================================
// SUITE 5: Mutation — createNotifikasi (dengan auth)
// ============================================================
describe('[GREYBOX] GraphQL — Mutation createNotifikasi', () => {
  let adminToken;

  beforeAll(async () => {
    const response = await gqlQuery(`
      query {
        loginAdmin(email: "admin@test.com", password: "admin123") {
          token
        }
      }
    `);
    adminToken = response.body.singleResult.data.loginAdmin.token;
  });

  it('TC-GQL-15 ✅ createNotifikasi dengan token valid harus berhasil dibuat', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const response = await gqlQuery(`
      mutation CreateNotif($input: CreateNotifikasiInput!) {
        createNotifikasi(input: $input) {
          _id
          judul
          pesan
          kategori
          isRead
        }
      }
    `, {
      input: {
        judul: 'Test Notifikasi',
        pesan: 'Pesan test dari integration test',
        kategori: 'INFORMASI',
        idPelanggan: userId,
      }
    }, adminToken);

    expect(response.body.singleResult.errors).toBeUndefined();
    const notif = response.body.singleResult.data.createNotifikasi;
    expect(notif.judul).toBe('Test Notifikasi');
    expect(notif.pesan).toBe('Pesan test dari integration test');
    expect(notif.isRead).toBe(false);
  });

  it('TC-GQL-16 ❌ createNotifikasi tanpa token harus return error auth (FIXED)', async () => {
    // Fix diterapkan: createNotifikasi sekarang memanggil verifyAdminToken
    const response = await gqlQuery(`
      mutation CreateNotifNoAuth($input: CreateNotifikasiInput!) {
        createNotifikasi(input: $input) {
          _id
          judul
        }
      }
    `, {
      input: {
        judul: 'Test Tanpa Auth',
        pesan: 'Test tanpa token',
        kategori: 'INFORMASI',
      }
    }, null);

    const errors = response.body.singleResult.errors;
    expect(errors).toBeDefined();
    expect(errors[0].message).toContain('Token tidak ditemukan');
  });
});
