// @ts-nocheck — legacy REST controller, phase-out menuju GraphQL
// Endpoint /register hanya untuk setup awal — dinonaktifkan di production
import AdminAccount from "../models/AdminAccount.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerAdminAccount = async (req, res, next) => {
  // Nonaktifkan di production — gunakan GraphQL createAdmin
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ status: 403, pesan: "Endpoint ini tidak aktif di production. Gunakan panel admin." });
  }

  try {
    const { email, noHP, namaLengkap, password } = req.body;
    if (!email || !noHP || !namaLengkap || !password) {
      return res
        .status(400)
        .json({ pesan: "Silakan isi semua kolom yang diperlukan." });
    }

    const isAlreadyRegistered = await AdminAccount.findOne({ email });
    if (isAlreadyRegistered) {
      return res
        .status(400)
        .json({ pesan: "Pengguna dengan email ini sudah terdaftar." });
    }

    const hash = await bcryptjs.hash(password, 10);
    const newUser = new AdminAccount({ email, noHP, namaLengkap, password: hash });
    await newUser.save();

    return res.status(201).json({
      status: 201,
      data: { _id: newUser._id, email: newUser.email, namaLengkap: newUser.namaLengkap, noHP: newUser.noHP },
      pesan: "Admin berhasil terdaftar.",
    });
  } catch (err) {
    res.status(500).json({ status: 500, pesan: "Kesalahan server internal." });
  }
};

export const loginAdminAccount = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        status: 400,
        pesan: "Silakan isi semua kolom yang diperlukan.",
      });
    } else {
      const user = await AdminAccount.findOne({ email });
      if (!user) {
        return res
          .status(400)
          .json({ status: 400, pesan: "Email atau kata sandi salah." });
      } else {
        const validateUser = await bcryptjs.compare(password, user.password);
        if (!validateUser) {
          res
            .status(400)
            .json({ status: 400, pesan: "Email atau kata sandi salah." });
        } else {
          const payload = {
            id: user._id,       // canonical — dipakai verifyAdminToken
            userId: user._id,   // backward compat untuk consumer lama
            email: user.email,
            role: 'admin',      // wajib — agar token bisa diverifikasi role-nya
          };
          const JWT_SECRET = process.env.JWT_SECRET;

          jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: "30d" },
            async (err, token) => {
              if (err) {
                return res.status(500).json(err);
              }
              user.set("token", token);
              await user.save();

              return res.status(200).json({
                status: 200,
                data: user,
                token: user.token,
              });
            }
          );
        }
      }
    }
  } catch (error) {
    console.log("Error during login:", error);
    res.status(500).json({
      status: 500,
      pesan: "Kesalahan server internal",
    });
  }
};

export const logoutAdminAccount = async (req, res) => {
  try {
    const { userId } = req.body; // Assuming userId is sent from the client during logout

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, pesan: "ID Pengguna diperlukan untuk keluar." });
    }

    const user = await AdminAccount.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ status: 404, pesan: "Pengguna tidak ditemukan." });
    }

    // Remove or set token to null
    user.set("token", null);
    await user.save();

    return res
      .status(200)
      .json({ status: 200, pesan: "Pengguna berhasil keluar." });
  } catch (error) {
    console.error("Error during logout:", error);
    res
      .status(500)
      .json({ status: 500, pesan: "Terjadi kesalahan saat keluar." });
  }
};
