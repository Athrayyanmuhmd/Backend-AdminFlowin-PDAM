import Midtrans from "midtrans-client";
import { configDotenv } from "dotenv";

configDotenv();

// Initialize Midtrans Snap client with environment variables
const midtransClient = new Midtrans.Snap({
  isProduction: process.env.MIDTRANS_ISPRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Validate configuration on startup
if (!process.env.MIDTRANS_SERVER_KEY || !process.env.MIDTRANS_CLIENT_KEY) {
  console.warn('⚠️  WARNING: Midtrans credentials not configured in .env file');
  console.warn('   Please set MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY');
}

export default midtransClient;
