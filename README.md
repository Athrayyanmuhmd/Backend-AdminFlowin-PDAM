# Flowin Backend API

> **GraphQL API Server untuk Smart Water Meter Management System**
> PERUMDAM Tirta Daroy Kota Banda Aceh

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.0-lightgrey?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green?logo=mongodb)](https://www.mongodb.com/)
[![GraphQL](https://img.shields.io/badge/GraphQL-Apollo%20Server-E10098?logo=graphql)](https://www.apollographql.com/)
[![Midtrans](https://img.shields.io/badge/Payment-Midtrans-blue)](https://midtrans.com/)

## 📋 Overview

Flowin Backend API adalah GraphQL API server yang dibangun dengan Node.js, Express, dan Apollo Server untuk mengelola seluruh backend operations sistem smart water meter PDAM. Server ini melayani 14.000 pengguna dengan fitur real-time monitoring, automated billing, payment gateway integration, dan IoT device management.

## ✨ Key Features

### 🔐 Authentication & Authorization
- Multi-role JWT authentication (Admin, Technician, User)
- Role-based access control (RBAC)
- Secure password hashing dengan bcrypt
- Token expiration dan refresh mechanism

### 💳 Payment Gateway Integration
- Midtrans payment gateway
- Multiple payment methods (GoPay, OVO, DANA, QRIS, Bank Transfer)
- Automated webhook handling
- Transaction tracking dan reconciliation

### 📊 Automated Billing System
- Monthly billing generation dengan cron jobs
- Progressive tariff calculation
- Multi-tier customer groups
- Overdue detection dan reminders
- Payment processing dan history

### 🌐 IoT Integration
- Real-time water meter data collection
- MQTT/HTTP endpoint for IoT devices
- Automated usage calculation
- Anomaly detection (leaks, tampering)
- Remote meter configuration

### 📁 Document Management
- Cloudinary integration untuk PDF storage
- KTP, KK, IMB document upload
- Survey dan RAB file management
- Secure document access control

### 📱 Notification System
- Multi-channel notifications
- Transaction alerts
- Billing reminders
- System notifications
- Push notification support

### 🔄 Background Jobs (Cron)
- Monthly billing generation (1st day, 00:01)
- Daily overdue check (00:05)
- Daily payment reminders (08:00)
- Automated report generation

## 🚀 Tech Stack

**Runtime & Framework:**
- Node.js 20.x
- Express.js 5.0
- ES Modules (ESM)

**API Layer:**
- Apollo Server 5.4.0 (GraphQL)
- Express REST endpoints (legacy support)

**Database:**
- MongoDB 7.0
- Mongoose ODM 8.0

**Authentication:**
- JWT (jsonwebtoken)
- bcryptjs for password hashing

**Payment:**
- Midtrans Node.js SDK
- Webhook verification

**File Storage:**
- Cloudinary SDK

**Scheduling:**
- node-cron for automated tasks

**Development:**
- Nodemon for auto-reload
- dotenv for environment variables

## 📦 Installation

### Prerequisites

- Node.js 18+ atau 20+
- MongoDB 6.0+ (local atau cloud)
- npm atau yarn
- Midtrans account (Sandbox/Production)
- Cloudinary account
- Redis (optional, untuk caching)

### Setup

```bash
# Clone repository
git clone https://github.com/Athrayyanmuhmd/flowin_adminPanel_BE.git
cd flowin_adminPanel_BE

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Edit .env dengan konfigurasi Anda
nano .env
```

### Environment Variables

Create `.env` file with the following configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/aqualink
# Or use MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aqualink

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Midtrans Configuration
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Webhook URLs (for production)
WEBHOOK_BASE_URL=https://your-api-domain.com
```

## 🏃 Running the Application

### Development Mode

```bash
npm start
# Server runs on http://localhost:5000
# GraphQL Playground: http://localhost:5000/graphql
```

### Production Mode

```bash
NODE_ENV=production node server.js
```

### Using PM2 (Recommended for Production)

```bash
npm install -g pm2
pm2 start server.js --name "flowin-api"
pm2 save
pm2 startup
```

## 📡 API Endpoints

### GraphQL Endpoint

```
POST http://localhost:5000/graphql
```

**GraphQL Playground (Development only):**
```
GET http://localhost:5000/graphql
```

### REST Endpoints (Legacy)

```
POST /api/auth/login              # User login
POST /api/auth/register           # User registration
POST /api/admin/login             # Admin login
POST /api/technician/login        # Technician login

POST /webhook/payment             # Midtrans webhook (Billing & RAB)
POST /midtrans/notification       # Midtrans webhook (Wallet)

POST /api/iot/usage               # IoT device data submission
GET  /api/meteran/:id/usage       # Get meter usage data
```

## 🔌 GraphQL Schema

### Sample Queries

```graphql
# Get all customers
query {
  getAllPengguna {
    _id
    namaLengkap
    email
    noHP
    isVerified
  }
}

# Get all meters
query {
  getAllMeteran {
    _id
    nomorMeteran
    nomorAkun
    statusMeteran
    pemakaianBelumTerbayar
    idPengguna {
      namaLengkap
      email
    }
  }
}

# Get dashboard stats
query {
  getDashboardStats {
    totalPengguna
    totalMeteran
    totalTagihanBulanIni
    totalPendapatanBulanIni
  }
}

# Admin login
mutation {
  loginAdmin(email: "admin@test.com", password: "admin123") {
    token
    admin {
      _id
      namaLengkap
      email
      role
    }
  }
}
```

## 🗄️ Database Models

**24 Mongoose Models (ERD Compliant):**

- `Pengguna` - Customers/users
- `AdminAccount` - Admin users
- `Teknisi` - Technicians
- `Meteran` - Water meters
- `KelompokPelanggan` - Customer groups/tariffs
- `Tagihan` - Billing records
- `Transaksi` - Payment transactions
- `RiwayatPemakaian` - Usage history from IoT
- `KoneksiData` - Connection applications
- `RABConnection` - Budget estimates
- `PekerjaanTeknisi` - Work orders
- `Notifikasi` - Notifications
- `DataSurvei` - Survey data
- `SCADA` - SCADA integration data
- `Laporan` - Reports
- And 9 more models...

**All models use Indonesian field names** (ERD compliant):
- `namaLengkap`, `noHP`, `email`
- `totalBiaya`, `statusPembayaran`
- `tanggalPembayaran`, `metodePembayaran`
- `pemakaianBelumTerbayar`, `nomorMeteran`

## 🔐 Authentication Flow

### Admin/Technician Login

```graphql
mutation LoginAdmin {
  loginAdmin(email: "admin@test.com", password: "admin123") {
    token
    admin {
      _id
      namaLengkap
      email
      role
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "loginAdmin": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "admin": {
        "_id": "507f1f77bcf86cd799439011",
        "namaLengkap": "Admin Test",
        "email": "admin@test.com",
        "role": "Admin"
      }
    }
  }
}
```

**Use token in subsequent requests:**
```
Authorization: Bearer <token>
```

## 💰 Payment Integration

### Payment Flow

1. **Create Transaction** → Frontend creates Midtrans snap token
2. **User Pays** → User completes payment on Midtrans
3. **Webhook Received** → Backend receives webhook notification
4. **Process Payment** → Update transaction status, billing, meter usage
5. **Send Notification** → Notify user of successful payment

### Webhook Endpoints

**Billing & RAB Payments:**
```
POST /webhook/payment
```

**Wallet Top-up:**
```
POST /midtrans/notification
```

### Order ID Formats

- Billing: `BILLING-{billingId}` or `BILLING-MULTI-{userId}-{timestamp}`
- RAB: `RAB-{rabId}`
- Wallet: UUID

## 🤖 IoT Integration

### Submit Water Usage Data

```
POST /api/iot/usage
Content-Type: application/json

{
  "deviceId": "METER-12345",
  "waterUsage": 15.5,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Response

```json
{
  "success": true,
  "message": "Usage data recorded successfully",
  "data": {
    "meteranId": "507f1f77bcf86cd799439011",
    "pemakaianBaru": 15.5,
    "pemakaianTotal": 125.5
  }
}
```

## ⏰ Cron Jobs

Automated tasks running in `utils/billingCron.js`:

| Cron Expression | Schedule | Task |
|-----------------|----------|------|
| `0 1 1 * *` | 1st day, 00:01 | Generate monthly billing |
| `0 5 * * *` | Daily, 00:05 | Check overdue payments |
| `0 8 * * *` | Daily, 08:00 | Send payment reminders |

## 🧪 Testing

### Testing with GraphQL Playground

1. Start server: `npm start`
2. Open browser: `http://localhost:5000/graphql`
3. Run queries/mutations in the playground

### Testing with curl

```bash
# Test health check
curl http://localhost:5000/

# Test GraphQL query
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ getAllPengguna { _id namaLengkap } }"}'

# Test with authentication
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"query":"{ getAllMeteran { _id nomorMeteran } }"}'
```

## 🔧 Utility Scripts

```bash
# Check admin accounts
node check-admin.js

# Reset admin password
node reset-admin-password.js
```

## 🌍 Deployment

### Vercel Deployment

The project includes `vercel.json` for easy deployment:

```bash
npm install -g vercel
vercel
```

### Environment Variables on Vercel

Add all `.env` variables in Vercel Dashboard → Settings → Environment Variables

### Production Checklist

- [ ] Change JWT_SECRET to strong random key
- [ ] Set MIDTRANS_IS_PRODUCTION=true
- [ ] Use MongoDB Atlas for production database
- [ ] Configure CORS_ORIGIN to production frontend URL
- [ ] Set up SSL certificates
- [ ] Enable rate limiting
- [ ] Set up monitoring (PM2, DataDog, etc.)
- [ ] Configure backup strategy for MongoDB

## 🔒 Security Best Practices

- JWT tokens expire after 30 days
- Passwords hashed with bcrypt (10 salt rounds)
- Input validation on all mutations
- CORS configured for specific origins
- Webhook signature verification (Midtrans)
- SQL injection prevention (Mongoose)
- XSS protection in GraphQL resolvers

## 📊 Performance Tips

- Use MongoDB indexes on frequently queried fields
- Enable Redis caching for repeated queries
- Use GraphQL DataLoader for N+1 query prevention
- Optimize image uploads with Cloudinary transformations
- Use pagination for large datasets
- Enable gzip compression

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is developed as part of a thesis/final project (TA) at Universitas Syiah Kuala.

**Researcher:** Athar Rayyan Muhammad (2208107010074)

**Thesis Title:** Rancang Bangun Website Administrasi Terintegrasi untuk Pengelolaan Operasional Smart Water Meter pada PERUMDAM Tirta Daroy Kota Banda Aceh

## 🔗 Related Repositories

- **Frontend Admin Panel:** [flowin_adminPanel_FE](https://github.com/Athrayyanmuhmd/flowin_adminPanel_FE)

## 📞 Contact

**Athar Rayyan Muhammad**

Email: athrayyanmuhmd@gmail.com

GitHub: [@Athrayyanmuhmd](https://github.com/Athrayyanmuhmd)

---

Made with ❤️ for PERUMDAM Tirta Daroy Banda Aceh
