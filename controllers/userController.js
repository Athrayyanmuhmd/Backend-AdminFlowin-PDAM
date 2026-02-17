import usersModel from "../models/User.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
// import Wallet from "../models/Wallet.js";
import Notification from "../models/Notification.js";
import { verifyToken } from "../middleware/auth.js";
import mongoose from "mongoose";

export const registerUser = async (req, res, next) => {
  try {
    const { email, noHP, namaLengkap, password } = req.body;
    if (!email || !noHP || !namaLengkap || !password) {
      return res
        .status(400)
        .json({ pesan: "Silakan isi semua kolom yang diperlukan." });
    } else {
      const isAlreadyRegistered = await usersModel.findOne({ email });
      if (isAlreadyRegistered) {
        return res
          .status(400)
          .json({ pesan: "Pengguna dengan email ini sudah terdaftar." });
      } else {
        const newUser = new usersModel({
          email,
          noHP,
          namaLengkap,
        });

        // Menggunakan promise untuk menangani hash password
        bcryptjs.hash(password, 10, async (err, hash) => {
          if (err) {
            return res.status(500).json(err);
          }

          newUser.set("password", hash);
          await newUser.save(); // Tunggu sampai user disimpan ke DB

          // // Setelah user disimpan, buat wallet baru
          // const newWallet = new Wallet({
          //   userId: newUser._id, // Menggunakan _id dari user yang baru dibuat
          //   balance: 0,
          //   pendingBalance: 0,
          //   consevationToken: 0,
          // });

          // await newWallet.save(); // Tunggu sampai wallet disimpan ke DB

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

export const changePassword = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pengguna diperlukan, tetapi tidak disediakan",
        });
      }

      if (!newPassword) {
        return res.status(400).json({
          status: 400,
          pesan: "Kata sandi baru diperlukan, tetapi tidak disediakan",
        });
      }

      const user = await usersModel.findById(id);

      if (!user) {
        return res.status(404).json({
          status: 404,
          pesan: "Pengguna Tidak Ditemukan",
        });
      }

      bcryptjs.hash(newPassword, 10, async (err, hash) => {
        if (err) {
          return res.status(500).json(err);
        }

        user.set("password", hash);
        await user.save();

        // Create notification for password change
        const passwordNotification = new Notification({
          userId: id,
          judul: "Kata Sandi Diubah",
          pesan: "Kata sandi akun Anda telah berhasil diubah.",
          kategori: "Informasi",
          link: `/profile/${id}`,
        });

        await passwordNotification.save();

        return res
          .status(200)
          .json({ data: user, pesan: "Kata sandi berhasil diubah." });
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        pesan: "Kesalahan Server Internal",
      });
    }
  },
];

export const editProfile = [
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newFullName, newEmail, newPhone } = req.body;

      if (!id) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pengguna diperlukan, tetapi tidak disediakan",
        });
      }

      if (!newFullName || !newEmail) {
        return res.status(400).json({
          status: 400,
          pesan: "Semua kolom diperlukan, tetapi tidak disediakan",
        });
      }

      // Get current user data first
      const user = await usersModel.findById(id);

      if (!user) {
        return res.status(404).json({
          status: 404,
          pesan: "Pengguna tidak ditemukan",
        });
      }

      // Check if email is being changed and if new email is already used by another user
      if (newEmail !== user.email) {
        const emailAlreadyRegistered = await usersModel.findOne({
          email: newEmail,
          _id: { $ne: id }, // Exclude current user
        });

        if (emailAlreadyRegistered) {
          return res.status(400).json({
            status: 400,
            pesan: "Email sudah digunakan oleh pengguna lain",
          });
        }
      }

      // Check if namaLengkap is being changed and if new name is already used by another user
      if (newFullName !== user.namaLengkap) {
        const nameAlreadyRegistered = await usersModel.findOne({
          namaLengkap: newFullName,
          _id: { $ne: id }, // Exclude current user
        });

        if (nameAlreadyRegistered) {
          return res.status(400).json({
            status: 400,
            pesan: "Nama sudah digunakan oleh pengguna lain",
          });
        }
      }

      user.set("namaLengkap", newFullName);
      user.set("email", newEmail);

      // Update noHP if provided
      if (newPhone !== undefined) {
        user.set("noHP", newPhone || null);
      }

      await user.save();

      // Create notification for profile update
      const profileNotification = new Notification({
        userId: id,
        judul: "Profil Diperbarui",
        pesan: "Profil akun Anda telah berhasil diperbarui.",
        kategori: "Informasi",
        link: `/profile/${id}`,
      });

      await profileNotification.save();

      return res.status(200).json({
        status: 200,
        data: user,
        pesan: "Profil berhasil diubah",
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        pesan: "Kesalahan server internal",
      });
    }
  },
];

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        status: 400,
        pesan: "Silakan isi semua kolom yang diperlukan.",
      });
    } else {
      const user = await usersModel.findOne({ email });
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
                pesan: "Login Berhasi, Sedang Mengarahkan ke Beranda.",
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

export const loginByGoogle = async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await usersModel.findOne({ email });

    if (!existingUser) {
      return res.status(200).json({
        status: 200,
        data: {
          status: "NEED_REGISTER",
        },
        pesan: "Akun ini belum terdaftar, silahkan mendaftar terlebih dahulu",
      });
    }

    const payload = {
      userId: existingUser._id,
      email: existingUser.email,
    };
    const JWT_SECRET = process.env.JWT_SECRET;

    jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" }, async (err, token) => {
      if (err) {
        return res.status(500).json(err);
      }
      existingUser.set("token", token);
      await existingUser.save();

      // Create a notification for successful login
      const loginNotification = new Notification({
        userId: existingUser._id,
        judul: "Login Berhasil",
        pesan: "Anda telah berhasil masuk ke akun Anda.",
        kategori: "Informasi",
      });

      await loginNotification.save();

      return res.status(200).json({
        status: 200,
        data: existingUser,
        token: existingUser.token,
        pesan: "Login berhasil, Sedang Mengarahkan ke Beranda.",
      });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      pesan: "Kesalahan server internal",
    });
  }
};

export const registerByGoogle = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { email, namaLengkap } = req.body;

    if (!email || !namaLengkap) {
      return res.status(200).json({
        status: 200,
        data: {
          status: "MISSING_FIELD",
        },
        pesan: "Kesalahan Dari Google",
      });
    }

    const existingUser = await usersModel.findOne({ email }).lean();

    if (existingUser) {
      return res.status(200).json({
        status: 200,
        data: {
          status: "ALREADY_REGISTERED",
        },
        pesan: "Email ini sudah terdaftar di akun lain",
      });
    }
    session.startTransaction();
    const newUser = await new usersModel({
      email,
      namaLengkap: namaLengkap.trim(),
    }).save({ session });

    // const newWallet = new Wallet({
    //   userId: newUser._id,
    //   balance: 0,
    //   pendingBalance: 0,
    //   conservationToken: 0,
    // });

    const payload = {
      userId: newUser._id,
      email: newUser.email,
    };

    const JWT_SECRET = process.env.JWT_SECRET;

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

    newUser.set("token", token);

    const registerNotification = new Notification({
      userId: newUser._id,
      judul: "Login Berhasil",
      pesan: "Anda telah berhasil masuk ke akun Anda.",
      kategori: "Informasi",
    });
    await Promise.all([
      newUser.save({ session }),
      // newWallet.save({ session }), // Commented out because newWallet is not created
      registerNotification.save({ session }),
    ]);
    await session.commitTransaction();

    return res.status(201).json({
      status: 201,
      data: newUser,
      token: newUser.token,
      pesan: "Pendaftaran Berhasil, Sedang Mengarahkan ke Beranda",
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: 500,
      pesan: "Kesalahan Server",
      error,
    });
  } finally {
    session.endSession();
  }
};

export const logoutUser = [
  verifyToken,
  async (req, res) => {
    try {
      const { userId } = req.user; // Assuming userId is sent from the client during logout

      if (!userId) {
        return res.status(400).json({
          status: 400,
          pesan: "ID Pengguna diperlukan untuk keluar.",
        });
      }

      const user = await usersModel.findById(userId);
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

      return res.status(200).json({
        status: 200,
        pesan: "Pengguna berhasil keluar. Sedang mengarahkan keluar",
      });
    } catch (error) {
      console.error("Error during logout:", error);
      res
        .status(500)
        .json({ status: 500, pesan: "Terjadi kesalahan saat keluar." });
    }
  },
];

// Get user profile with connection and meter status
export const getUserProfile = [
  verifyToken,
  async (req, res) => {
    try {
      const { userId } = req.user;

      const user = await usersModel
        .findById(userId)
        .populate("SambunganDataId")
        .populate({
          path: "meteranId",
          populate: {
            path: "kelompokPelangganId",
            model: "KelompokPelanggan",
          },
        })
        .select("-password -token");

      if (!user) {
        return res.status(404).json({
          status: 404,
          pesan: "Pengguna tidak ditemukan",
        });
      }

      return res.status(200).json({
        status: 200,
        data: {
          user,
          hasConnectionData: !!user.SambunganDataId,
          hasMeteran: !!user.meteranId,
          isVerified: user.isVerified,
        },
        pesan: "Profil berhasil diambil",
      });
    } catch (error) {
      console.error("Error getting user profile:", error);
      return res.status(500).json({
        status: 500,
        pesan: "Kesalahan server internal",
      });
    }
  },
];
