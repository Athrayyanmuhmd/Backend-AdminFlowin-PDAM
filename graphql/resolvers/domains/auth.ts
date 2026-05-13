import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import AdminAccount from '../../../models/AdminAccount.js';
import Technician from '../../../models/Technician.js';
import logger from '../../../utils/logger.js';
import { verifyAdminToken, /* catatAuditLog, */ validateEmail, validatePassword, validatePhone } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const authResolvers = {
  Query: {
    loginAdmin: async (_, { email, password }) => {
      const admin = await AdminAccount.findOne({ email: email?.toLowerCase().trim() });
      if (!admin) throw new Error('Email atau kata sandi salah.');
      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) throw new Error('Email atau kata sandi salah.');
      if (admin.isActive === false) throw new Error('Akun admin ini telah dinonaktifkan. Hubungi administrator.');
      const token = jwt.sign(
        { id: admin._id, email: admin.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' },
      );
      admin.token = token;
      await admin.save();
      logger.info({ adminId: admin._id, email: admin.email }, 'Admin login successful');
      return { token, admin: { ...admin.toObject(), token } };
    },

    // Login teknisi ke admin panel â€” pakai Technician model lokal (bukan Rafli)
    loginTechnician: async (_, { email, password }) => {
      const teknisi = await Technician.findOne({ email: email?.toLowerCase().trim() });
      if (!teknisi) throw new Error('Email atau kata sandi salah.');
      const isValid = await bcrypt.compare(password, teknisi.password);
      if (!isValid) throw new Error('Email atau kata sandi salah.');
      const token = jwt.sign(
        { id: teknisi._id, email: teknisi.email, role: 'technician' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' },
      );
      teknisi.token = token;
      await teknisi.save();
      logger.info({ teknisiId: teknisi._id, email: teknisi.email }, 'Technician login successful');
      return { token, technician: { ...teknisi.toObject(), token } };
    },

    getAdmin: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await AdminAccount.findById(id);
    },

    getAllAdmins: async (_, __, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      return await AdminAccount.find().limit(500);
    },
  },

  Mutation: {
    createAdmin: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      input.email = input.email?.toLowerCase().trim();
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePassword(input.password);
      validatePhone(input.noHP);
      const existing = await AdminAccount.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const admin = new AdminAccount({ ...input, password: hashedPassword });
      const saved = await admin.save();
      /* [auditlog nonaktif â€” uncomment untuk mengaktifkan kembali]
      await catatAuditLog({
        token,
        aksi: 'ADMIN_CREATE',
        resource: 'Admin',
        resourceId: saved._id,
        nilaiAfter: { NIP: input.NIP, namaLengkap: input.namaLengkap, email: input.email },
      }); */
      return saved;
    },

    updateAdmin: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      if (input.password) input.password = await bcrypt.hash(input.password, 10);
      const updated = await AdminAccount.findByIdAndUpdate(id, input, { new: true });
      /* [auditlog nonaktif â€” uncomment untuk mengaktifkan kembali]
      await catatAuditLog({
        token,
        aksi: 'ADMIN_UPDATE',
        resource: 'Admin',
        resourceId: id,
        nilaiAfter: { namaLengkap: input.namaLengkap, email: input.email },
      }); */
      return updated;
    },

    toggleAdminActive: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const admin = await AdminAccount.findById(id).select('isActive namaLengkap').lean() as any;
      if (!admin) throw new Error('Admin tidak ditemukan');
      const newStatus = admin.isActive === false ? true : false;
      return AdminAccount.findByIdAndUpdate(id, { isActive: newStatus }, { new: true });
    },

    deleteAdmin: async (_, { id }, { token }) => {
      verifyAdminToken(token);
      const existing = await AdminAccount.findById(id, 'namaLengkap email');
      await AdminAccount.findByIdAndDelete(id);
      /* [auditlog nonaktif â€” uncomment untuk mengaktifkan kembali]
      await catatAuditLog({
        token,
        aksi: 'ADMIN_DELETE',
        resource: 'Admin',
        resourceId: id,
        nilaiBefore: existing ? { namaLengkap: existing.namaLengkap, email: existing.email } : null,
      }); */
      return { success: true, message: 'Admin berhasil dihapus' };
    },

    logoutAdmin: async (_, __, { token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        const adminId = decoded.id || decoded.userId;
        if (adminId) {
          await AdminAccount.findByIdAndUpdate(adminId, { token: null });
          logger.info({ adminId }, 'Admin logout successful');
        }
      } catch (_) {}
      return true;
    },

    logoutTechnician: async (_, __, { token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        if (decoded.id) await Technician.findByIdAndUpdate(decoded.id, { token: null });
      } catch (_) {}
      return true;
    },
  },
};
