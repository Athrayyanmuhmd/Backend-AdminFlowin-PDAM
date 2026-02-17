import axios from 'axios';

async function testRestLogin() {
  try {
    console.log('\n🔍 Testing REST login endpoint...\n');

    const response = await axios.post('http://localhost:5000/admin/auth/login', {
      email: 'admin@test.com',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ REST LOGIN SUCCESSFUL!\n');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.token) {
      console.log('\n🎉 TOKEN RECEIVED:', response.data.token.substring(0, 50) + '...');
    }
  } catch (error) {
    console.error('\n❌ REST LOGIN FAILED!\n');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testRestLogin();
