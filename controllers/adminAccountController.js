import AdminAccount from "../models/AdminAccount.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import Wallet from "../models/Wallet.js";
import Notification from "../models/Notification.js";

export const registerAdminAccount = async (req, res, next) => {
  try {
    const { email, phone, fullName, password } = req.body;
    if (!email || !phone || !fullName || !password) {
      return res
        .status(400)
        .json({ pesan: "Silakan isi semua kolom yang diperlukan." });
    } else {
      const isAlreadyRegistered = await AdminAccount.findOne({ email });
      if (isAlreadyRegistered) {
        return res
          .status(400)
          .json({ pesan: "Pengguna dengan email ini sudah terdaftar." });
      } else {
        const newUser = new AdminAccount({
          email,
          phone,
          fullName,
        });

        // Menggunakan promise untuk menangani hash password
        bcryptjs.hash(password, 10, async (err, hash) => {
          if (err) {
            return res.status(500).json(err);
          }

          newUser.set("password", hash);
          await newUser.save(); // Tunggu sampai user disimpan ke DB

          // Setelah user disimpan, buat wallet baru
          const newWallet = new Wallet({
            userId: newUser._id, // Menggunakan _id dari user yang baru dibuat
            balance: 0,
            pendingBalance: 0,
            consevationToken: 0,
          });

          await newWallet.save(); // Tunggu sampai wallet disimpan ke DB

          return res
            .status(200)
            .json({ data: newUser, pesan: "Pengguna berhasil terdaftar." });
        });
      }
    }
  } catch (err) {
    res.status(500).json(err);
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
            userId: user._id,
            email: user.email,
          };
          const JWT_SECRET = process.env.JWT_SECRET;

          jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: "1d" },
            async (err, token) => {
              if (err) {
                return res.status(500).json(err);
              }
              user.set("token", token);
              await user.save();

              // Create a notification for successful login
              const loginNotification = new Notification({
                userId: user._id,
                judul: "Login Berhasil",
                pesan: "Anda telah berhasil masuk ke akun Anda.",
                kategori: "Informasi",
              });

              await loginNotification.save();

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

    // Create a notification for logout
    const logoutNotification = new Notification({
      userId,
      judul: "Logout Berhasil",
      pesan: "Anda telah berhasil keluar dari akun Anda.",
      kategori: "Informasi",
    });

    await logoutNotification.save();

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
