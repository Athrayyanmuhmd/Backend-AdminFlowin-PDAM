import bcrypt from 'bcryptjs';
import User from '../../../models/User.js';
import Meteran from '../../../models/Meteran.js';
import KelompokPelanggan from '../../../models/KelompokPelanggan.js';
import Billing from '../../../models/Billing.js';
import ConnectionData from '../../../models/ConnectionData.js';
import Notification from '../../../models/Notification.js';
import { verifyAdminToken, catatAuditLog, validateEmail, validatePhone } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

async function batchPopulateAlamat(users: any[]): Promise<Map<string, string>> {
  const missingIds = users.filter((u: any) => !u.address).map((u: any) => u._id);
  const alamatMap = new Map<string, string>();
  if (missingIds.length === 0) return alamatMap;
  const koneksiList = await ConnectionData.find(
    { IdPelanggan: { $in: missingIds } },
    'IdPelanggan Alamat'
  ).sort({ createdAt: -1 }).lean();
  (koneksiList as any[]).forEach((k: any) => {
    const key = k.IdPelanggan?.toString();
    if (key && k.Alamat && !alamatMap.has(key)) alamatMap.set(key, k.Alamat);
  });
  return alamatMap;
}

function serializeUser(u: any, alamatMap?: Map<string, string>) {
  const obj = { ...u, createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null, updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null };
  if (!obj.address && alamatMap) obj.address = alamatMap.get(u._id.toString()) ?? null;
  return obj;
}

export const pelangganResolvers = {
  Query: {
    getPengguna: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const user = await User.findById(id).lean() as any;
      if (!user) return null;
      return serializeUser(user);
    },

    getAllPengguna: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const users = await User.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500)).lean() as any[];
      const alamatMap = await batchPopulateAlamat(users);
      return users.map(u => serializeUser(u, alamatMap));
    },

    searchPengguna: async (_, { search }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const users = await User.find({
        $or: [
          { namaLengkap: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { noHP: { $regex: search, $options: 'i' } },
        ],
      }).sort({ createdAt: -1 }).lean() as any[];
      const alamatMap = await batchPopulateAlamat(users);
      return users.map(u => serializeUser(u, alamatMap));
    },
  },

  Mutation: {
    createPelanggan: async (_, { input }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const email = input.email?.toLowerCase().trim();
      if (!validateEmail(email)) throw new Error('Format email tidak valid');
      validatePhone(input.noHP);
      const existing = await User.findOne({ email });
      if (existing) throw new Error('Email sudah terdaftar');
      const rawPassword = input.password || input.nik;
      if (!rawPassword) throw new Error('Password atau NIK wajib diisi');
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const user = await new User({ ...input, email, password: hashedPassword, isVerified: false }).save();
      await catatAuditLog({
        token,
        aksi: 'PELANGGAN_CREATE',
        resource: 'Pengguna',
        resourceId: user._id,
        nilaiAfter: { namaLengkap: input.namaLengkap, email, noHP: input.noHP },
      });
      return user;
    },

    updatePelanggan: async (_, { id, input }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      if (input.email) input.email = input.email.toLowerCase().trim();
      const before = await User.findById(id, 'namaLengkap email noHP accountStatus').lean() as any;
      const updated = await User.findByIdAndUpdate(id, input, { new: true });
      await catatAuditLog({
        token,
        aksi: 'PELANGGAN_UPDATE',
        resource: 'Pengguna',
        resourceId: id,
        nilaiBefore: before ? { namaLengkap: before.namaLengkap, email: before.email, noHP: before.noHP } : null,
        nilaiAfter: { namaLengkap: input.namaLengkap, email: input.email, noHP: input.noHP },
      });
      return updated;
    },

    deletePelanggan: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const before = await User.findById(id, 'namaLengkap email noHP').lean() as any;
      await User.findByIdAndDelete(id);
      await catatAuditLog({
        token,
        aksi: 'PELANGGAN_DELETE',
        resource: 'Pengguna',
        resourceId: id,
        nilaiBefore: before ? { namaLengkap: before.namaLengkap, email: before.email, noHP: before.noHP } : null,
      });
      return { success: true, message: 'Pelanggan deleted successfully' };
    },

    deactivateCustomer: async (_, { userId }, { token }) => {
      verifyAdminToken(token);
      const DENDA_BERAT = 1_500_000;

      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');
      if (user.accountStatus === 'inactive') throw new Error('Pelanggan sudah dalam status non-aktif');

      const pendingBillings = await Billing.find({
        userId,
        StatusPembayaran: 'pending',
        jenisBilling: { $ne: 'denda' },
      }).sort({ Periode: 1 }).lean();

      const jumlahBulanTunggak = pendingBillings.reduce((sum, b: any) => sum + (b.bulanCakupan ?? 1), 0);
      if (jumlahBulanTunggak < 3) throw new Error('Pelanggan belum memenuhi syarat pemutusan (minimal 3 bulan menunggak)');

      const dendaAmount = DENDA_BERAT;
      const meteranTagihan = pendingBillings[0];
      if (meteranTagihan) {
        await Billing.create({
          userId,
          IdMeteran: (meteranTagihan as any).IdMeteran,
          Periode: new Date().toISOString().slice(0, 7),
          PenggunaanSebelum: 0,
          PenggunaanSekarang: 0,
          TotalPemakaian: 0,
          Biaya: 0,
          BiayaBeban: 0,
          TotalBiaya: dendaAmount,
          StatusPembayaran: 'pending',
          TenggatWaktu: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          Menunggak: true,
          jenisBilling: 'denda',
          bulanCakupan: 0,
          Catatan: `Denda pemutusan (${jumlahBulanTunggak} bulan menunggak): Rp${dendaAmount.toLocaleString('id-ID')}`,
        });
      }

      user.accountStatus = 'inactive';
      await user.save();

      await catatAuditLog({
        token,
        aksi: 'PELANGGAN_DEACTIVATE',
        resource: 'Pengguna',
        resourceId: userId,
        nilaiBefore: { accountStatus: 'active' },
        nilaiAfter: { accountStatus: 'inactive', jumlahBulanTunggak, dendaAmount },
      });

      await Notification.create({
        IdPelanggan: userId,
        Judul: 'ID Pelanggan Dinonaktifkan',
        Pesan: `ID pelanggan Anda telah dinonaktifkan karena menunggak ${jumlahBulanTunggak} bulan. Harap segera lunasi semua tunggakan beserta denda Rp${dendaAmount.toLocaleString('id-ID')} untuk mengaktifkan kembali.`,
        Kategori: 'PERINGATAN',
        Link: '/pembayaran',
        isRead: false,
      }).catch(() => {});

      return user;
    },

    konfirmasiPembayaranLoket: async (_, { userId }, { token }) => {
      verifyAdminToken(token);
      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');

      const now = new Date();
      const tagihanCount = await Billing.countDocuments({ userId, StatusPembayaran: 'pending' });
      await Billing.updateMany(
        { userId, StatusPembayaran: 'pending' },
        { $set: { StatusPembayaran: 'settlement', TanggalPembayaran: now, MetodePembayaran: 'Loket', Menunggak: false } },
      );

      user.accountStatus = 'active';
      await user.save();

      await catatAuditLog({
        token,
        aksi: 'PELANGGAN_KONFIRMASI_LOKET',
        resource: 'Pengguna',
        resourceId: userId,
        nilaiBefore: { accountStatus: user.accountStatus },
        nilaiAfter: { accountStatus: 'active', tagihanDilunasi: tagihanCount, metodePembayaran: 'Loket' },
      });

      await Notification.create({
        IdPelanggan: userId,
        Judul: 'ID Pelanggan Aktif Kembali',
        Pesan: 'Pembayaran Anda telah dikonfirmasi. ID pelanggan Anda kini aktif kembali.',
        Kategori: 'PEMBAYARAN',
        Link: '/riwayat-tagihan',
        isRead: false,
      }).catch(() => {});

      return user;
    },

    aktivasiPelanggan: async (_, { koneksiDataId }, { token }) => {
      verifyAdminToken(token);

      const koneksiData = await ConnectionData.findById(koneksiDataId);
      if (!koneksiData) throw new Error('Data koneksi tidak ditemukan');

      const userId = (koneksiData as any).IdPelanggan;
      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');

      user.isVerified = true;
      user.accountStatus = 'active';
      await user.save();

      const meteran = await Meteran.findOne({ IdKoneksiData: koneksiDataId }).catch(() => null);
      if (meteran) {
        await Meteran.findByIdAndUpdate(meteran._id, { statusAktif: true }).catch(() => {});
      }

      await catatAuditLog({
        token,
        aksi: 'PELANGGAN_AKTIVASI',
        resource: 'Pengguna',
        resourceId: userId,
        nilaiAfter: { accountStatus: 'active', isVerified: true, koneksiDataId, meteranId: meteran?._id?.toString() ?? null },
      });

      const tanggalAktif = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const kelompok = meteran
        ? await KelompokPelanggan.findById((meteran as any).IdKelompokPelanggan).catch(() => null)
        : null;

      await Notification.create({
        IdPelanggan: userId,
        Judul: 'Sambungan Air Resmi Aktif',
        Pesan: [
          `Selamat! Sambungan air Anda telah resmi diaktifkan per ${tanggalAktif}.`,
          meteran ? `No. Pelanggan : ${(meteran as any).NomorAkun}` : null,
          meteran ? `Seri Meteran  : ${(meteran as any).NomorMeteran}` : null,
          kelompok ? `Kelompok Tarif: ${(kelompok as any).NamaKelompok}` : null,
          ``,
          `Tagihan pertama akan muncul pada awal bulan berikutnya. Pantau pemakaian air Anda di halaman Dashboard.`,
        ].filter(Boolean).join('\n'),
        Kategori: 'INFORMASI',
        Link: '/dashboard',
        isRead: false,
      }).catch(() => {});

      return user;
    },
  },
};
