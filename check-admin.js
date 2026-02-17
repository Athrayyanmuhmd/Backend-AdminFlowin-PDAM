import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import AdminAccount from './models/AdminAccount.js';

dotenv.config();

async function checkAndCreateAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if any admin exists
    const adminCount = await AdminAccount.countDocuments();
    console.log(`\n📊 Total admin accounts: ${adminCount}`);

    if (adminCount === 0) {
      console.log('\n⚠️  No admin account found. Creating default admin...');

      // Create default admin
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const defaultAdmin = new AdminAccount({
        NIP: 'ADMIN001',
        namaLengkap: 'Administrator',
        email: 'admin@aqualink.com',
        noHP: '081234567890',
        password: hashedPassword,
      });

      await defaultAdmin.save();
      console.log('\n✅ Default admin account created successfully!');
      console.log('\n📝 Login Credentials:');
      console.log('   Email: admin@aqualink.com');
      console.log('   Password: admin123');
      console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');
    } else {
      console.log('\n📋 Existing admin accounts:');
      const admins = await AdminAccount.find({}, 'NIP namaLengkap email noHP').limit(10);
      admins.forEach((admin, index) => {
        console.log(`\n${index + 1}. ${admin.namaLengkap}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   NIP: ${admin.NIP}`);
        console.log(`   Phone: ${admin.noHP}`);
      });
      console.log('\n');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndCreateAdmin();
