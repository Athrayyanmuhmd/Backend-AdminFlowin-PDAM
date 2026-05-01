import { ApolloServer } from '@apollo/server';
import { typeDefs } from './schemas/typeDefs/index.js';
import { resolvers } from './resolvers/index.js';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import AdminAccount from '../models/AdminAccount.js';
import Technician from '../models/Technician.js';

// Operasi yang boleh berjalan tanpa sesi aktif di DB (login/logout public)
const PUBLIC_OPERATIONS = new Set(['loginAdmin', 'loginTechnician', 'logoutAdmin', 'logoutTechnician']);

/**
 * Validasi token terhadap DB: cek apakah sesi masih aktif setelah logout.
 * Hanya dijalankan jika token ada DAN operasi bukan public.
 * Error DB diabaikan (graceful degrade) — JWT expiry tetap jadi garis pertahanan terakhir.
 */
async function validateSessionInDB(token: string, operationName?: string): Promise<void> {
  if (!token || PUBLIC_OPERATIONS.has(operationName ?? '')) return;
  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch {
    return; // JWT verify error ditangani di resolver
  }
  const id = decoded.id ?? decoded.userId; // handle REST token lama (userId) + GraphQL token (id)
  const role = decoded.role;
  if (!id) return;

  try {
    // Cek apakah token di DB di-null-kan (logout eksplisit).
    // Tidak memeriksa kecocokan string penuh — hanya pastikan token tidak null.
    // Alasan: REST login dan GraphQL login masing-masing menyimpan token berbeda ke DB,
    // sehingga perbandingan string penuh tidak reliable untuk multi-login-path.
    if (role === 'technician') {
      const teknisi = await Technician.findById(id).select('token').lean() as any;
      if (teknisi && teknisi.token === null) {
        throw new Error('Sesi tidak valid. Silakan login ulang.');
      }
    } else {
      const admin = await AdminAccount.findById(id).select('token').lean() as any;
      if (admin && admin.token === null) {
        throw new Error('Sesi tidak valid. Silakan login ulang.');
      }
    }
  } catch (err: any) {
    if (err.message === 'Sesi tidak valid. Silakan login ulang.') throw err;
    // DB error → graceful degrade, JWT masih berlaku
  }
}

// Rate limiter for login operations — 10 attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  validate: { xForwardedForHeader: false },
  skip: (req: Request) => {
    const body = req.body;
    if (!body || !body.query) return true;
    const op = (body.operationName || '').toLowerCase();
    const query = body.query.toLowerCase();
    const isLogin = op.includes('login') || query.includes('loginadmin') || query.includes('logintechnician');
    return !isLogin;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      errors: [{ message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }],
    });
  },
});

// ─── GraphiQL Explorer HTML ───────────────────────────────────────────────────
const GRAPHIQL_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <title>Aqualink GraphQL Explorer</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3.7.1/graphiql.min.css" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; height: 100vh; display: flex; flex-direction: column; font-family: system-ui, sans-serif; }
    #topbar { background: #1c2333; color: #e6edf3; padding: 8px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; border-bottom: 1px solid #30363d; }
    #topbar h1 { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; }
    .badge { background: #238636; color: #fff; font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 600; }
    .badge.warn { background: #9e6a03; }
    #token-section { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    #token-input { background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 5px 10px; border-radius: 6px; font-size: 12px; width: 300px; font-family: monospace; outline: none; }
    #token-input:focus { border-color: #58a6ff; }
    #token-input::placeholder { color: #484f58; }
    .btn { border: none; padding: 5px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500; transition: opacity .15s; }
    .btn:hover { opacity: .85; }
    .btn-green { background: #238636; color: #fff; }
    .btn-ghost { background: transparent; color: #8b949e; border: 1px solid #30363d; }
    #status { font-size: 11px; white-space: nowrap; }
    #status.ok { color: #3fb950; }
    #status.off { color: #6e7681; }
    #graphiql { flex: 1; overflow: hidden; }
  </style>
</head>
<body>
  <div id="topbar">
    <h1>🚰 Aqualink GraphQL Explorer</h1>
    <span class="badge">Production</span>
    <div id="token-section">
      <span id="status" class="off">● Belum login</span>
      <input id="token-input" type="password" placeholder="Paste token JWT setelah login…" autocomplete="off" />
      <button class="btn btn-green" onclick="saveToken()">Simpan Token</button>
      <button class="btn btn-ghost" onclick="clearToken()">Hapus</button>
    </div>
  </div>
  <div id="graphiql"></div>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/graphiql@3.7.1/graphiql.min.js" type="application/javascript"></script>
  <script>
    const STORAGE_KEY = 'aqualink_jwt_token';
    const GRAPHQL_URL = window.location.origin + '/graphql';
    let token = localStorage.getItem(STORAGE_KEY) || '';
    let gqlRoot = null;

    const DEFAULT_QUERY = \`# =====================================================
# 🔐 LANGKAH 1: Jalankan query login di bawah ini
#    Klik tombol  ▶  atau tekan Ctrl+Enter
# =====================================================

query LoginAdmin {
  loginAdmin(email: "admin@test.com", password: "admin123") {
    token
    admin {
      namaLengkap
      email
    }
  }
}

# =====================================================
# Setelah login:
#   1. Copy nilai "token" dari panel kanan
#   2. Paste ke kotak Token JWT di header atas
#   3. Klik "Simpan Token"
#   4. Ganti query ini dengan query yang kamu butuhkan
#   5. Jelajahi schema di panel kiri (klik buku 📚)
# =====================================================
\`;

    function updateStatus() {
      const el = document.getElementById('status');
      const inp = document.getElementById('token-input');
      if (token) {
        const preview = token.substring(0, 12) + '…';
        el.textContent = '● Login aktif (' + preview + ')';
        el.className = 'ok';
        inp.value = token;
      } else {
        el.textContent = '● Belum login';
        el.className = 'off';
        inp.value = '';
      }
    }

    function makeFetcher() {
      return GraphiQL.createFetcher({
        url: GRAPHQL_URL,
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
    }

    function render() {
      if (!gqlRoot) gqlRoot = ReactDOM.createRoot(document.getElementById('graphiql'));
      gqlRoot.render(React.createElement(GraphiQL, {
        fetcher: makeFetcher(),
        defaultQuery: DEFAULT_QUERY,
        shouldPersistHeaders: true,
        isHeadersEditorEnabled: true,
        defaultEditorToolsVisibility: 'docs',
      }));
    }

    function saveToken() {
      const val = document.getElementById('token-input').value.trim().replace(/^Bearer\\s+/i, '');
      if (!val) { alert('Token tidak boleh kosong'); return; }
      token = val;
      localStorage.setItem(STORAGE_KEY, token);
      updateStatus();
      render();
      // brief flash notification
      const s = document.getElementById('status');
      s.textContent = '✅ Token disimpan!';
      setTimeout(() => updateStatus(), 2000);
    }

    function clearToken() {
      token = '';
      localStorage.removeItem(STORAGE_KEY);
      updateStatus();
      render();
    }

    updateStatus();
    render();
  </script>
</body>
</html>`;

export async function setupApolloServer(app: Express): Promise<ApolloServer<any>> {
  const server = new ApolloServer<any>({
    typeDefs,
    resolvers,
    // Introspection selalu aktif agar GraphiQL Explorer dan Apollo Studio bisa membaca schema
    introspection: true,
    formatError: (error: any) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
      };
    },
  });

  await server.start();

  app.use(
    '/graphql',
    loginRateLimiter,
    cors({ origin: true, credentials: true }),
    express.json(),
    async (req: Request, res: Response) => {
      try {
        if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
        }

        // Serve GraphiQL Explorer pada GET request
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(GRAPHIQL_HTML);
          return;
        }

        const { query, variables, operationName } = req.body;

        const rawToken = req.headers.authorization
          ? req.headers.authorization.replace(/^Bearer\s+/i, '')
          : '';

        // DB session check — dilakukan sebelum resolver berjalan, satu kali per request
        if (rawToken) {
          await validateSessionInDB(rawToken, operationName);
        }

        const result = await server.executeOperation(
          { query, variables, operationName },
          {
            contextValue: {
              token: rawToken,
              req,
            },
          }
        );

        if (result.body.kind === 'single') {
          res.json(result.body.singleResult);
        } else {
          res.status(500).json({ error: 'Incremental delivery not supported' });
        }
      } catch (error: any) {
        console.error('GraphQL execution error:', error);
        res.status(500).json({
          errors: [{ message: error.message || 'Internal server error' }],
        });
      }
    }
  );

  console.log('🚀 GraphQL Server ready at http://localhost:5000/graphql');
  return server;
}
