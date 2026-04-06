/**
 * HTTP client untuk komunikasi dari backend ini ke backend Rafli (flowin-teknisi-graphql).
 * Otomatis menyertakan x-internal-secret di setiap request.
 *
 * Contoh pemakaian:
 *   import { rafliClient } from '../utils/rafliClient.js';
 *   const data = await rafliClient.get('/teknisi/123');
 *   const result = await rafliClient.post('/assign', { teknisiId: '...', orderId: '...' });
 */

const BASE_URL = process.env.RAFLI_BACKEND_URL ?? 'http://localhost:4000';
const SECRET = process.env.INTERNAL_API_SECRET ?? '';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'x-internal-secret': SECRET,
};

async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: defaultHeaders,
  });
  if (!res.ok) throw new Error(`rafliClient GET ${path} gagal: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rafliClient POST ${path} gagal: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function patch<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rafliClient PATCH ${path} gagal: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const rafliClient = { get, post, patch };
