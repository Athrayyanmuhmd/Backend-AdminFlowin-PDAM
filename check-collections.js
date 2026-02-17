import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';

configDotenv();

async function checkCollections() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('📊 CURRENT COLLECTIONS:\n');
    
    // Group related collections
    const collectionGroups = {
      'Pengguna/User': ['users', 'penggunas'],
      'Notifikasi/Notification': ['notifications', 'notifikasis'],
      'Teknisi/Technician': ['technicians', 'teknisis'],
      'Meteran/Meter': ['meters', 'meterans'],
      'Laporan/Report': ['reports', 'laporans']
    };
    
    for (const [name, variants] of Object.entries(collectionGroups)) {
      console.log(`\n${name}:`);
      for (const variant of variants) {
        const exists = collections.find(c => c.name === variant);
        if (exists) {
          const count = await db.collection(variant).countDocuments();
          console.log(`  - ${variant}: ${count} documents ${count > 0 ? '📦' : '⚪'}`);
        } else {
          console.log(`  - ${variant}: not exists ❌`);
        }
      }
    }
    
    console.log('\n\nOTHER COLLECTIONS:');
    const otherCollections = collections.filter(c => 
      !['users', 'penggunas', 'notifications', 'notifikasis', 'technicians', 'teknisis', 'meters', 'meterans', 'reports', 'laporans'].includes(c.name)
    );
    
    for (const col of otherCollections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  - ${col.name}: ${count} documents`);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCollections();
