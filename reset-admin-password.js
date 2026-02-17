import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import AdminAccount from './models/AdminAccount.js';

dotenv.config();

async function resetAdminPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin by email
    const adminEmail = 'admin@test.com';
    const newPassword = 'admin123';

    const admin = await AdminAccount.findOne({ email: adminEmail });

    if (!admin) {
      console.log(`❌ Admin with email ${adminEmail} not found`);
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    admin.password = hashedPassword;
    await admin.save();

    console.log('✅ Password reset successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('📝 ADMIN LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════');
    console.log(`👤 Name     : ${admin.namaLengkap}`);
    console.log(`📧 Email    : ${admin.email}`);
    console.log(`🔑 Password : ${newPassword}`);
    console.log(`📱 Phone    : ${admin.noHP}`);
    console.log(`🆔 NIP      : ${admin.NIP}`);
    console.log('═══════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Change this password after login!\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdminPassword();
