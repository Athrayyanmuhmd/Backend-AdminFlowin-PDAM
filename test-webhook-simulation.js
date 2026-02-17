import mongoose from "mongoose";
import RabConnection from "./models/RabConnection.js";
import { configDotenv } from "dotenv";

configDotenv();

// Simulate webhook payload
const webhookPayload = {
  order_id: "RAB-68e4edfdb754d89f3fcfe571-1759851837407",
  transaction_status: "settlement",
  gross_amount: "1200000.00",
  status_code: "200",
  fraud_status: "accept",
};

const MONGODB_URI = process.env.MONGODB_URI;

console.log("🔗 Connecting to MongoDB...");
console.log("URI:", MONGODB_URI ? "Set" : "Not set");

try {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  // Parse order_id
  const parts = webhookPayload.order_id.split("-");
  const rabId = parts[1];

  console.log("📋 Parsing order_id:");
  console.log("  Order ID:", webhookPayload.order_id);
  console.log("  Extracted RAB ID:", rabId);
  console.log("");

  // Find RAB
  console.log("🔍 Finding RAB...");
  const rab = await RabConnection.findById(rabId);

  if (!rab) {
    console.error("❌ RAB not found!");
    process.exit(1);
  }

  console.log("✅ RAB found:");
  console.log("  ID:", rab._id.toString());
  console.log("  isPaid (before):", rab.isPaid);
  console.log("  totalBiaya:", rab.totalBiaya);
  console.log("");

  // Method 1: findByIdAndUpdate
  console.log("🔄 Method 1: Using findByIdAndUpdate...");
  const updated1 = await RabConnection.findByIdAndUpdate(
    rabId,
    { isPaid: true },
    { new: true, runValidators: true }
  );

  console.log("  Updated:", updated1 ? "Yes" : "No");
  console.log("  isPaid:", updated1?.isPaid);
  console.log("");

  // Verify
  const verify1 = await RabConnection.findById(rabId);
  console.log("🔍 Verification 1:");
  console.log("  isPaid:", verify1?.isPaid);
  console.log("  Match:", verify1?.isPaid === true ? "✅" : "❌");
  console.log("");

  // Reset for next test
  await RabConnection.findByIdAndUpdate(rabId, { isPaid: false });
  console.log("🔄 Reset to false\n");

  // Method 2: Direct save
  console.log("🔄 Method 2: Using direct save...");
  const rab2 = await RabConnection.findById(rabId);
  rab2.isPaid = true;
  await rab2.save();

  console.log("  Saved");
  console.log("  isPaid:", rab2.isPaid);
  console.log("");

  // Verify
  const verify2 = await RabConnection.findById(rabId);
  console.log("🔍 Verification 2:");
  console.log("  isPaid:", verify2?.isPaid);
  console.log("  Match:", verify2?.isPaid === true ? "✅" : "❌");
  console.log("");

  // Reset back
  await RabConnection.findByIdAndUpdate(rabId, { isPaid: false });
  console.log("🔄 Reset back to false");

  console.log("\n✅ All tests completed!");
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
} finally {
  await mongoose.disconnect();
  console.log("\n🔌 Disconnected from MongoDB");
  process.exit(0);
}
