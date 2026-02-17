/**
 * Admin Customer Controller
 * Handles all admin operations for customer management
 */
import User from "../models/User.js";
import Meteran from "../models/Meteran.js";
import KelompokPelanggan from "../models/KelompokPelanggan.js";

// Get all customers with pagination and filters
export const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      customerType = "all",
      accountStatus = "all",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter query
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { namaLengkap: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { noHP: { $regex: search, $options: "i" } },
        { nik: { $regex: search, $options: "i" } },
      ];
    }

    // Customer type filter
    if (customerType && customerType !== "all") {
      filter.customerType = customerType;
    }

    // Account status filter
    if (accountStatus && accountStatus !== "all") {
      filter.accountStatus = accountStatus;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const customers = await User.find(filter)
      .populate("meteranId")
      .populate("SambunganDataId")
      .select("-password -token")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(filter);

    // Calculate stats
    const stats = {
      totalCustomers: await User.countDocuments(),
      activeCustomers: await User.countDocuments({ accountStatus: "active" }),
      inactiveCustomers: await User.countDocuments({
        accountStatus: "inactive",
      }),
      suspendedCustomers: await User.countDocuments({
        accountStatus: "suspended",
      }),
      newThisMonth: await User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    };

    return res.status(200).json({
      status: 200,
      success: true,
      pesan: "Data pelanggan berhasil diambil",
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      stats,
    });
  } catch (error) {
    console.error("Error getting customers:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      pesan: "Gagal mengambil data pelanggan",
      error: error.message,
    });
  }
};

// Get customer by ID
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findById(id)
      .populate({
        path: "meteranId",
        populate: {
          path: "kelompokPelangganId",
          model: "KelompokPelanggan",
        },
      })
      .populate("SambunganDataId")
      .populate("iotConnectionId")
      .select("-password -token");

    if (!customer) {
      return res.status(404).json({
        status: 404,
        success: false,
        pesan: "Pelanggan tidak ditemukan",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      pesan: "Data pelanggan berhasil diambil",
      data: customer,
    });
  } catch (error) {
    console.error("Error getting customer by ID:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      pesan: "Gagal mengambil data pelanggan",
      error: error.message,
    });
  }
};

// Create new customer (admin registration)
export const createCustomer = async (req, res) => {
  try {
    const {
      nik,
      namaLengkap,
      email,
      noHP,
      address,
      customerType = "rumah_tangga",
      gender,
      birthDate,
      occupation,
      location,
    } = req.body;

    // Validation
    if (!nik || !namaLengkap || !email || !noHP || !address) {
      return res.status(400).json({
        status: 400,
        success: false,
        pesan: "Data yang diperlukan tidak lengkap",
      });
    }

    // Validate NIK (should be 16 digits)
    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
      return res.status(400).json({
        status: 400,
        success: false,
        pesan: "NIK harus 16 digit angka",
      });
    }

    // Check if NIK already exists
    const existingNIK = await User.findOne({ nik });
    if (existingNIK) {
      return res.status(400).json({
        status: 400,
        success: false,
        pesan: "NIK sudah terdaftar",
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        status: 400,
        success: false,
        pesan: "Email sudah terdaftar",
      });
    }

    // Create new customer
    const newCustomer = new User({
      nik,
      namaLengkap,
      email,
      noHP,
      address,
      customerType,
      gender,
      birthDate,
      occupation,
      location,
      accountStatus: "active",
      isVerified: false,
    });

    await newCustomer.save();

    return res.status(201).json({
      status: 201,
      success: true,
      pesan: "Pelanggan berhasil didaftarkan",
      data: newCustomer,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      pesan: "Gagal mendaftarkan pelanggan",
      error: error.message,
    });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.token;
    delete updateData._id;

    const customer = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -token");

    if (!customer) {
      return res.status(404).json({
        status: 404,
        success: false,
        pesan: "Pelanggan tidak ditemukan",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      pesan: "Data pelanggan berhasil diperbarui",
      data: customer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      pesan: "Gagal memperbarui data pelanggan",
      error: error.message,
    });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findByIdAndDelete(id);

    if (!customer) {
      return res.status(404).json({
        status: 404,
        success: false,
        pesan: "Pelanggan tidak ditemukan",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      pesan: "Pelanggan berhasil dihapus",
      data: customer,
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      pesan: "Gagal menghapus pelanggan",
      error: error.message,
    });
  }
};

// Get customer statistics
export const getCustomerStats = async (req, res) => {
  try {
    const stats = {
      totalCustomers: await User.countDocuments(),
      activeCustomers: await User.countDocuments({ accountStatus: "active" }),
      inactiveCustomers: await User.countDocuments({
        accountStatus: "inactive",
      }),
      suspendedCustomers: await User.countDocuments({
        accountStatus: "suspended",
      }),
      newThisMonth: await User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
      byType: {
        rumah_tangga: await User.countDocuments({
          customerType: "rumah_tangga",
        }),
        komersial: await User.countDocuments({ customerType: "komersial" }),
        industri: await User.countDocuments({ customerType: "industri" }),
        sosial: await User.countDocuments({ customerType: "sosial" }),
      },
      withMeter: await User.countDocuments({ meteranId: { $ne: null } }),
      withConnection: await User.countDocuments({
        SambunganDataId: { $ne: null },
      }),
    };

    return res.status(200).json({
      status: 200,
      success: true,
      pesan: "Statistik pelanggan berhasil diambil",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting customer stats:", error);
    return res.status(500).json({
      status: 500,
      success: false,
      pesan: "Gagal mengambil statistik pelanggan",
      error: error.message,
    });
  }
};
