import RabConnection from "../models/RabConnection.js";
import ConnectionData from "../models/ConnectionData.js";
import { uploadPdfAsImage } from "../utils/cloudinary.js";
import midtransClient from "../middleware/midtrans.js";

// Create RAB Connection (Technician)
export const createRabConnection = async (req, res) => {
  try {
    const { connectionDataId, totalBiaya, catatan } = req.body;

    console.log(
      "[createRabConnection] Request from technician:",
      req.technicianId
    );
    console.log("[createRabConnection] Connection Data ID:", connectionDataId);

    // Check if connection data exists and verified
    const connectionData = await ConnectionData.findById(connectionDataId);
    if (!connectionData) {
      return res.status(404).json({
        status: 404,
        pesan: "Connection data not found",
      });
    }

    if (!connectionData.isVerifiedByTechnician) {
      return res.status(400).json({
        status: 400,
        pesan: "Connection data must be verified by technician first",
      });
    }

    // Check if RAB already exists
    const existingRab = await RabConnection.findOne({ idKoneksiData: connectionDataId });
    if (existingRab) {
      return res.status(400).json({
        status: 400,
        pesan: "RAB connection already exists for this connection",
      });
    }

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        status: 400,
        pesan: "RAB file (PDF/Image) is required",
      });
    }

    // Upload RAB document to Cloudinary
    const rabUrl = await uploadPdfAsImage(
      req.file.buffer,
      "aqualink/rab",
      req.file.mimetype
    );

    const rabConnection = new RabConnection({
      idKoneksiData: connectionDataId,
      totalBiaya: parseInt(totalBiaya),
      urlRab: rabUrl,
      catatan: catatan || "",
    });

    await rabConnection.save();

    // Update connection data with RAB ID
    connectionData.rabConnectionId = rabConnection._id;
    await connectionData.save();

    console.log(
      "[createRabConnection] RAB created successfully:",
      rabConnection._id
    );

    res.status(201).json({
      status: 201,
      pesan: "RAB connection created successfully",
      data: rabConnection,
    });
  } catch (error) {
    console.error("[createRabConnection] Error:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get All RAB Connections (Admin/Technician)
export const getAllRabConnections = async (req, res) => {
  try {
    const { isPaid } = req.query;

    let filter = {};
    if (isPaid !== undefined) filter.isPaid = isPaid === "true";

    const rabConnections = await RabConnection.find(filter)
      .populate("idKoneksiData");

    res.status(200).json({
      status: 200,
      data: rabConnections,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get RAB Connection by ID
export const getRabConnectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const rabConnection = await RabConnection.findById(id)
      .populate("idKoneksiData");

    if (!rabConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB connection not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: rabConnection,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get RAB Connection by User ID (via ConnectionData.idPelanggan)
export const getRabConnectionByUserId = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find KoneksiData yang dimiliki user, lalu cari RAB yang terhubung
    const koneksiData = await ConnectionData.findOne({ idPelanggan: userId });
    if (!koneksiData) {
      return res.status(404).json({ status: 404, pesan: "RAB connection not found" });
    }
    const rabConnection = await RabConnection.findOne({ idKoneksiData: koneksiData._id })
      .populate("idKoneksiData");

    if (!rabConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB connection not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: rabConnection,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Get RAB Connection by Connection Data ID
export const getRabConnectionByConnectionId = async (req, res) => {
  try {
    const { connectionDataId } = req.params;

    const rabConnection = await RabConnection.findOne({ idKoneksiData: connectionDataId })
      .populate("idKoneksiData");

    if (!rabConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB connection not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: rabConnection,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Update RAB Connection Payment Status (User/Admin)
export const updateRabPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPaid } = req.body;

    const rabConnection = await RabConnection.findById(id);

    if (!rabConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB connection not found",
      });
    }

    rabConnection.isPaid = isPaid;
    await rabConnection.save();

    res.status(200).json({
      status: 200,
      pesan: "RAB payment status updated successfully",
      data: rabConnection,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Update RAB Connection (Technician)
export const updateRabConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle RAB document upload if provided
    if (req.file) {
      updates.rabUrl = await uploadPdfAsImage(
        req.file.buffer,
        "aqualink/rab",
        req.file.mimetype
      );
    }

    // Convert totalBiaya to number if provided
    if (updates.totalBiaya) {
      updates.totalBiaya = parseInt(updates.totalBiaya);
    }

    const rabConnection = await RabConnection.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!rabConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB connection not found",
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "RAB connection updated successfully",
      data: rabConnection,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Delete RAB Connection
export const deleteRabConnection = async (req, res) => {
  try {
    const { id } = req.params;

    const rabConnection = await RabConnection.findByIdAndDelete(id);

    if (!rabConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB connection not found",
      });
    }

    // Remove RAB ID from connection data
    await ConnectionData.findByIdAndUpdate(rabConnection.idKoneksiData, {
      rabConnectionId: null,
    });

    res.status(200).json({
      status: 200,
      pesan: "RAB connection deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

// Create Payment Transaction for RAB (User)
export const createRabPayment = async (req, res) => {
  try {
    const { rabId } = req.params;
    const userId = req.user.userId;

    // Get RAB data
    const rab = await RabConnection.findById(rabId)
      .populate({
        path: "idKoneksiData",
        populate: { path: "idPelanggan", select: "namaLengkap email noHP" }
      });

    if (!rab) {
      return res.status(404).json({
        status: 404,
        pesan: "RAB not found",
      });
    }

    // Verify user ownership via idKoneksiData.idPelanggan
    const pelanggan = rab.idKoneksiData?.idPelanggan;
    if (!pelanggan || pelanggan._id.toString() !== userId) {
      return res.status(403).json({
        status: 403,
        pesan: "Unauthorized to pay this RAB",
      });
    }

    // Check if already paid
    if (rab.statusPembayaran === 'Settlement') {
      return res.status(400).json({
        status: 400,
        pesan: "RAB already paid",
      });
    }

    // Create order_id dengan format RAB-{rabId}-{timestamp}
    // Timestamp memastikan order_id unique untuk setiap attempt pembayaran
    const timestamp = Date.now();
    const orderId = `RAB-${rab._id}-${timestamp}`;

    console.log(`📝 Creating payment transaction with order_id: ${orderId}`);

    // Midtrans parameter
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: rab.totalBiaya,
      },
      customer_details: {
        first_name: pelanggan.namaLengkap,
        email: pelanggan.email,
        phone: pelanggan.noHP || "08123456789",
      },
      item_details: [
        {
          id: `rab-${rab._id}`,
          price: rab.totalBiaya,
          quantity: 1,
          name: `Biaya Pemasangan RAB`,
        },
      ],
      callbacks: {
        finish: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/profile/rab-payment/status`,
        error: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/profile/rab-payment/status`,
        pending: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/profile/rab-payment/status`,
      },
    };

    // Create transaction using the configured midtransClient
    const transaction = await midtransClient.createTransaction(parameter);

    console.log(`✅ Payment transaction created successfully: ${orderId}`);

    res.status(200).json({
      status: 200,
      pesan: "Payment transaction created successfully",
      data: {
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId: orderId,
        grossAmount: rab.totalBiaya,
      },
    });
  } catch (error) {
    console.error("❌ Error creating RAB payment:", error);

    // Handle specific Midtrans errors
    if (error.message && error.message.includes("already been taken")) {
      // Order ID conflict - seharusnya tidak terjadi dengan timestamp, tapi sebagai fallback
      console.error(
        "⚠️ Order ID conflict detected, this should not happen with timestamp"
      );
      return res.status(409).json({
        status: 409,
        message:
          "Transaksi sedang diproses. Silakan tunggu beberapa saat dan coba lagi.",
      });
    }

    // Handle other Midtrans API errors
    if (error.httpStatusCode) {
      return res.status(error.httpStatusCode).json({
        status: error.httpStatusCode,
        message: error.message || "Midtrans API error",
      });
    }

    // Generic error
    res.status(500).json({
      status: 500,
      message: error.message || "Failed to create payment transaction",
    });
  }
};
