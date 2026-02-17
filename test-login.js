import axios from 'axios';

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:5000/graphql', {
      query: `
        query LoginAdmin($email: String!, $password: String!) {
          loginAdmin(email: $email, password: $password) {
            token
            admin {
              _id
              NIP
              namaLengkap
              email
              noHP
            }
          }
        }
      `,
      variables: {
        email: 'admin@test.com',
        password: 'admin123'
      }
    });

    console.log('\n✅ LOGIN TEST SUCCESSFUL!\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.data?.loginAdmin?.token) {
      console.log('\n🎉 TOKEN RECEIVED:', response.data.data.loginAdmin.token.substring(0, 50) + '...');
      console.log('👤 Admin:', response.data.data.loginAdmin.admin.namaLengkap);
    }
  } catch (error) {
    console.error('\n❌ LOGIN TEST FAILED!\n');
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
