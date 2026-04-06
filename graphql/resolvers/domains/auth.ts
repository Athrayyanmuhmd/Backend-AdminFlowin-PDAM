// @ts-nocheck
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import AdminAccount from '../../../models/AdminAccount.js';
import Technician from '../../../models/Technician.js';
import logger from '../../../utils/logger.js';
import { verifyAdminToken, catatAuditLog, validateEmail, validatePassword, validatePhone } from '../helpers.js';
import type { GraphQLContext } from '../../../types/index.js';

export const authResolvers = {
  Query: {
    loginAdmin: async (_, { email, password }) => {
      const admin = await AdminAccount.findOne({ email });
      if (!admin) throw new Error('Email atau kata sandi salah.');
      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) throw new Error('Email atau kata sandi salah.');
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

    loginTechnician: async (_, { email, password }) => {
      const teknisi = await Technician.findOne({ email });
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

    getTeknisi: async (_, { id }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const tek = await Technician.findById(id);
      if (!tek) return null;
      return { ...tek.toObject(), createdAt: tek.createdAt?.toISOString(), updatedAt: tek.updatedAt?.toISOString() };
    },

    getAllTeknisi: async (_, { limit = 100, offset = 0 } = {}, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const list = await Technician.find().sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 500));
      return list.map(tek => ({ ...tek.toObject(), createdAt: tek.createdAt?.toISOString(), updatedAt: tek.updatedAt?.toISOString() }));
    },

    getTeknisiByDivisi: async (_, { divisi }, { token }: GraphQLContext) => {
      verifyAdminToken(token);
      const list = await Technician.find({ divisi });
      return list.map(tek => ({ ...tek.toObject(), createdAt: tek.createdAt?.toISOString(), updatedAt: tek.updatedAt?.toISOString() }));
    },
  },

  Mutation: {
    createAdmin: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePassword(input.password);
      validatePhone(input.noHP);
      const existing = await AdminAccount.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const admin = new AdminAccount({ ...input, password: hashedPassword });
      const saved = await admin.save();
      await catatAuditLog({ token, aksi: 'ADMIN_CREATE', resource: 'Admin', resourceId: saved._id, nilaiAfter: { NIP: input.NIP, namaLengkap: input.namaLengkap, email: input.email } });
      return saved;
    },

    updateAdmin: async (_, { id, input }, { token }) => {
      verifyAdminToken(token);
      if (input.password) input.password = await bcrypt.hash(input.password, 10);
      const updated = await AdminAccount.findByIdAndUpdate(id, input, { new: true });
      await catatAuditLog({ token, aksi: 'ADMIN_UPDATE', resource: 'Admin', resourceId: id, nilaiAfter: { namaLengkap: input.namaLengkap, email: input.email } });
      return updated;
    },

    deleteAdmin: async (_, { id }, { token }) => {
      const existing = await AdminAccount.findById(id, 'namaLengkap email');
      await AdminAccount.findByIdAndDelete(id);
      await catatAuditLog({ token, aksi: 'ADMIN_DELETE', resource: 'Admin', resourceId: id, nilaiBefore: existing ? { namaLengkap: existing.namaLengkap, email: existing.email } : null });
      return { success: true, message: 'Admin deleted successfully' };
    },

    createTeknisi: async (_, { input }, { token }) => {
      verifyAdminToken(token);
      if (!validateEmail(input.email)) throw new Error('Format email tidak valid');
      validatePassword(input.password);
      validatePhone(input.noHP);
      const existing = await Technician.findOne({ email: input.email });
      if (existing) throw new Error('Email sudah terdaftar');
      const hashedPassword = await bcrypt.hash(input.password, 10);
      return await new Technician({ ...input, password: hashedPassword }).save();
    },

    updateTeknisi: async (_, { id, input }) => {
      return await Technician.findByIdAndUpdate(id, input, { new: true });
    },

    deleteTeknisi: async (_, { id }) => {
      await Technician.findByIdAndDelete(id);
      return { success: true, message: 'Teknisi deleted successfully' };
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
