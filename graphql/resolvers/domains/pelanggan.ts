// @ts-nocheck
import bcrypt from 'bcryptjs';
import User from '../../../models/User.js';
import Billing from '../../../models/Billing.js';
import Notification from '../../../models/Notification.js';
import { verifyAdminToken, validateEmail, validatePassword, validatePhone } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const pelangganResolvers = {
  Query: {
    getPengguna: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const user = await User.findById(id);
      if (!user) return null;
      return { ...user.toObject(), createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null, updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null };
    },

    getAllPengguna: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const users = await User.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500));
      return users.map(u => ({ ...u.toObject(), createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null, updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null }));
    },

    searchPengguna: async (_, { search }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const users = await User.find({
        $or: [
          { namaLengkap: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { noHP: { $regex: search, $options: 'i' } },
        ],
      }).sort({ createdAt: -1 });
      return users.map(u => ({ ...u.toObject(), createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null, updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null }));
    },
  },

  Mutation: {
    createPelanggan: async (_, { input }) => {
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePhone(input.noHP);
      const existing = await User.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
      // Jika password tidak disediakan (registrasi oleh admin), gunakan NIK sebagai password default
      const rawPassword = input.password || input.nik;
      if (!rawPassword) throw new Error('Password atau NIK wajib diisi');
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      return await new User({ ...input, password: hashedPassword, isVerified: false }).save();
    },

    updatePelanggan: async (_, { id, input }) => {
      return await User.findByIdAndUpdate(id, input, { new: true });
    },

    deletePelanggan: async (_, { id }) => {
      await User.findByIdAndDelete(id);
      return { success: true, message: 'Pelanggan deleted successfully' };
    },

    deactivateCustomer: async (_, { userId }, { token }) => {
      verifyAdminToken(token);
      const DENDA_RINGAN = 150_000;
      const DENDA_BERAT = 1_500_000;

      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');
      if (user.accountStatus === 'inactive') throw new Error('Pelanggan sudah dalam status non-aktif');

      const pendingBillings = await Billing.find({
        userId,
        statusPembayaran: 'Pending',
        jenisBilling: { $ne: 'denda' },
      }).sort({ periode: 1 }).lean();

      const jumlahBulanTunggak = pendingBillings.reduce((sum, b: any) => sum + (b.bulanCakupan ?? 1), 0);
      if (jumlahBulanTunggak < 3) throw new Error('Pelanggan belum memenuhi syarat pemutusan (minimal 3 bulan menunggak)');

      const dendaAmount = jumlahBulanTunggak >= 3 ? DENDA_BERAT : DENDA_RINGAN;

      const meteranTagihan = pendingBillings[0];
      if (meteranTagihan) {
        await Billing.create({
          userId,
          idMeteran: meteranTagihan.idMeteran,
          periode: new Date(),
          penggunaanSebelum: 0,
          penggunaanSekarang: 0,
          totalPemakaian: 0,
          biaya: 0,
          biayaBeban: 0,
          totalBiaya: dendaAmount,
          statusPembayaran: 'Pending',
          tenggatWaktu: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          menunggak: true,
          jenisBilling: 'denda',
          bulanCakupan: 0,
          catatan: `Denda pemutusan (${jumlahBulanTunggak} bulan menunggak): Rp${dendaAmount.toLocaleString('id-ID')}`,
        });
      }

      user.accountStatus = 'inactive';
      await user.save();

      await Notification.create({
        idPelanggan: userId,
        judul: 'ID Pelanggan Dinonaktifkan',
        pesan: `ID pelanggan Anda telah dinonaktifkan karena menunggak ${jumlahBulanTunggak} bulan. Harap segera lunasi semua tunggakan beserta denda Rp${dendaAmount.toLocaleString('id-ID')} untuk mengaktifkan kembali.`,
        kategori: 'Peringatan',
        link: '/pembayaran',
        isRead: false,
      }).catch(() => {});

      return user;
    },

    konfirmasiPembayaranLoket: async (_, { userId }, { token }) => {
      verifyAdminToken(token);
      const user = await User.findById(userId);
      if (!user) throw new Error('Pelanggan tidak ditemukan');

      const now = new Date();
      await Billing.updateMany(
        { userId, statusPembayaran: 'Pending' },
        { $set: { statusPembayaran: 'Settlement', tanggalPembayaran: now, metodePembayaran: 'Loket', menunggak: false } },
      );

      user.accountStatus = 'active';
      await user.save();

      await Notification.create({
        idPelanggan: userId,
        judul: 'ID Pelanggan Aktif Kembali',
        pesan: 'Pembayaran Anda telah dikonfirmasi. ID pelanggan Anda kini aktif kembali.',
        kategori: 'Pembayaran',
        link: '/riwayat-tagihan',
        isRead: false,
      }).catch(() => {});

      return user;
    },
  },
};
