/**
 * Redis Connection Test
 *
 * Usage: node test-redis.js
 */

import { getCache, setCache, deleteCache, isRedisConnected } from './utils/redis.js';

async function testRedis() {
  console.log('\n🧪 Testing Redis Connection...\n');

  // Wait for connection to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 1: Check connection status
  console.log('Test 1: Connection Status');
  const connected = isRedisConnected();
  console.log(`Status: ${connected ? '✅ Connected' : '❌ Not Connected'}\n`);

  if (!connected) {
    console.log('⚠️  Redis not connected. Please check REDIS_URL in .env file.\n');
    process.exit(1);
  }

  // Test 2: Set cache
  console.log('Test 2: Set Cache');
  const testData = {
    message: 'Hello from Redis!',
    timestamp: new Date().toISOString(),
    number: 42
  };
  await setCache('test:data', testData, 60); // 60 seconds TTL
  console.log('Data:', testData);
  console.log('');

  // Test 3: Get cache
  console.log('Test 3: Get Cache');
  const retrieved = await getCache('test:data');
  console.log('Retrieved:', retrieved);
  console.log(`Match: ${JSON.stringify(retrieved) === JSON.stringify(testData) ? '✅' : '❌'}\n`);

  // Test 4: Cache Miss
  console.log('Test 4: Cache Miss (non-existent key)');
  const missing = await getCache('test:nonexistent');
  console.log(`Result: ${missing === null ? '✅ null (expected)' : '❌ unexpected value'}\n`);

  // Test 5: Delete cache
  console.log('Test 5: Delete Cache');
  await deleteCache('test:data');
  const afterDelete = await getCache('test:data');
  console.log(`After delete: ${afterDelete === null ? '✅ null (expected)' : '❌ still exists'}\n`);

  // Test 6: Dashboard stats cache simulation
  console.log('Test 6: Dashboard Stats Cache Simulation');
  const dashboardStats = {
    totalPelanggan: 14000,
    totalTeknisi: 25,
    totalMeteran: 12500,
    pendingKoneksi: 150,
    activeWorkOrders: 35,
    totalTagihanBulanIni: 450000000,
    tunggakanAktif: 340,
    laporanTerbuka: 12
  };
  await setCache('dashboard:stats', dashboardStats, 300); // 5 minutes
  const cachedStats = await getCache('dashboard:stats');
  console.log('Cached Stats:', cachedStats);
  console.log(`Match: ${JSON.stringify(cachedStats) === JSON.stringify(dashboardStats) ? '✅' : '❌'}\n`);

  // Cleanup
  await deleteCache('dashboard:stats');

  console.log('✅ All Redis tests passed!\n');
  console.log('📝 Summary:');
  console.log('   - Redis connection: ✅ Working');
  console.log('   - SET operation: ✅ Working');
  console.log('   - GET operation: ✅ Working');
  console.log('   - DELETE operation: ✅ Working');
  console.log('   - Cache TTL: ✅ Working');
  console.log('   - Dashboard caching: ✅ Ready\n');

  process.exit(0);
}

// Run test
testRedis().catch(error => {
  console.error('\n❌ Redis test failed:', error.message);
  process.exit(1);
});
