import IoTConnection from "../models/IoTConnection.js";
import User from "../models/User.js";
import Meteran from "../models/Meteran.js";
import crypto from "crypto";

/**
 * Generate Pairing Code untuk IoT Connection
 * User request pairing code sebelum connect bluetooth
 */
export const generatePairingCode = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { meteranId } = req.body;

    // Verify user dan meteran
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 404,
        pesan: "User not found",
      });
    }

    if (!user.meteranId || user.meteranId.toString() !== meteranId) {
      return res.status(403).json({
        status: 403,
        pesan: "Meteran not assigned to this user",
      });
    }

    const meteran = await Meteran.findById(meteranId);
    if (!meteran) {
      return res.status(404).json({
        status: 404,
        pesan: "Meteran not found",
      });
    }

    // Generate random 6-digit pairing code
    const pairingCode = crypto.randomInt(100000, 999999).toString();
    const pairingCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Check if user already has pending connection
    let iotConnection = await IoTConnection.findOne({
      userId,
      status: "pending",
    });

    if (iotConnection) {
      // Update existing pending connection
      iotConnection.pairingCode = pairingCode;
      iotConnection.pairingCodeExpiry = pairingCodeExpiry;
      iotConnection.meteranId = meteranId;
      await iotConnection.save();
    } else {
      // Create new IoT connection record
      iotConnection = new IoTConnection({
        userId,
        meteranId,
        pairingCode,
        pairingCodeExpiry,
        status: "pending",
      });
      await iotConnection.save();
    }

    console.log(`✅ Pairing code generated for user ${userId}: ${pairingCode}`);

    res.status(200).json({
      status: 200,
      pesan: "Pairing code generated successfully",
      data: {
        pairingCode,
        expiresIn: 300, // seconds
        expiresAt: pairingCodeExpiry,
      },
    });
  } catch (error) {
    console.error("Error generating pairing code:", error);
    res.status(500).json({
      status: 500,
      message: error.message || "Failed to generate pairing code",
    });
  }
};

/**
 * Pair IoT Device
 * Called by IoT device (via bluetooth dari frontend) setelah user input pairing code
 */
export const pairDevice = async (req, res) => {
  try {
    const { pairingCode, deviceId } = req.body;

    if (!pairingCode || !deviceId) {
      return res.status(400).json({
        status: 400,
        pesan: "Pairing code and device ID are required",
      });
    }

    // Find IoT connection by pairing code
    const iotConnection = await IoTConnection.findOne({
      pairingCode,
      status: "pending",
    }).populate("userId meteranId");

    if (!iotConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "Invalid pairing code or already used",
      });
    }

    // Check if pairing code expired
    if (new Date() > iotConnection.pairingCodeExpiry) {
      return res.status(400).json({
        status: 400,
        pesan: "Pairing code expired. Please generate a new one.",
      });
    }

    // Update IoT connection
    iotConnection.deviceId = deviceId;
    iotConnection.status = "connected";
    iotConnection.connectedAt = new Date();
    iotConnection.lastSync = new Date();
    iotConnection.pairingCode = null; // Clear pairing code after use
    iotConnection.pairingCodeExpiry = null;
    await iotConnection.save();

    // Update user
    await User.findByIdAndUpdate(iotConnection.userId._id, {
      iotConnectionId: iotConnection._id,
      isIoTConnected: true,
    });

    console.log(
      `✅ IoT device ${deviceId} paired successfully for user ${iotConnection.userId._id}`
    );

    res.status(200).json({
      status: 200,
      pesan: "Device paired successfully",
      data: {
        userId: iotConnection.userId._id,
        meteranId: iotConnection.meteranId._id,
        deviceId: iotConnection.deviceId,
        connectedAt: iotConnection.connectedAt,
      },
    });
  } catch (error) {
    console.error("Error pairing device:", error);
    res.status(500).json({
      status: 500,
      message: error.message || "Failed to pair device",
    });
  }
};

/**
 * Get IoT Connection Status
 * Check if user's IoT is connected
 */
export const getConnectionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).populate("iotConnectionId");

    if (!user) {
      return res.status(404).json({
        status: 404,
        pesan: "User not found",
      });
    }

    const iotConnection = user.iotConnectionId;

    res.status(200).json({
      status: 200,
      data: {
        isConnected: user.isIoTConnected,
        connection: iotConnection
          ? {
              deviceId: iotConnection.deviceId,
              status: iotConnection.status,
              connectedAt: iotConnection.connectedAt,
              lastSync: iotConnection.lastSync,
              connectionMethod: iotConnection.connectionMethod,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting connection status:", error);
    res.status(500).json({
      status: 500,
      message: error.message || "Failed to get connection status",
    });
  }
};

/**
 * Disconnect IoT Device
 * User manually disconnect IoT
 */
export const disconnectDevice = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.iotConnectionId) {
      return res.status(404).json({
        status: 404,
        pesan: "No IoT connection found",
      });
    }

    // Update IoT connection status
    await IoTConnection.findByIdAndUpdate(user.iotConnectionId, {
      status: "disconnected",
    });

    // Update user
    await User.findByIdAndUpdate(userId, {
      isIoTConnected: false,
    });

    console.log(`✅ IoT device disconnected for user ${userId}`);

    res.status(200).json({
      status: 200,
      pesan: "Device disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting device:", error);
    res.status(500).json({
      status: 500,
      message: error.message || "Failed to disconnect device",
    });
  }
};

/**
 * IoT Heartbeat / Sync
 * IoT device send heartbeat periodically
 */
export const iotHeartbeat = async (req, res) => {
  try {
    const { deviceId, currentReading, battery } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        status: 400,
        pesan: "Device ID is required",
      });
    }

    // Find IoT connection by deviceId
    const iotConnection = await IoTConnection.findOne({ deviceId });

    if (!iotConnection) {
      return res.status(404).json({
        status: 404,
        pesan: "Device not registered",
      });
    }

    // Update last sync time
    iotConnection.lastSync = new Date();
    iotConnection.status = "connected";
    await iotConnection.save();

    // Optional: Update meteran reading if provided
    if (currentReading !== undefined) {
      await Meteran.findByIdAndUpdate(iotConnection.meteranId, {
        lastReading: currentReading,
        lastReadingTime: new Date(),
      });
    }

    res.status(200).json({
      status: 200,
      pesan: "Heartbeat received",
      data: {
        syncInterval: 60, // seconds
      },
    });
  } catch (error) {
    console.error("Error processing heartbeat:", error);
    res.status(500).json({
      status: 500,
      message: error.message || "Failed to process heartbeat",
    });
  }
};
