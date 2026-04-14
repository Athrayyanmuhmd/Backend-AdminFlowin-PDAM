/**
 * HTTP/GraphQL client untuk komunikasi ke backend Rafli (flowin-teknisi-graphql).
 * Setiap request otomatis menyertakan x-api-key (INTERNAL_API_SECRET).
 *
 * Rafli's system: port 4000, endpoint /graphql
 * Auth: x-api-key header (wajib) + Authorization Bearer token (jika ada user JWT)
 */

const BASE_URL = process.env.RAFLI_BACKEND_URL ?? 'http://localhost:4000';
const API_KEY = process.env.INTERNAL_API_SECRET ?? '';

// ─── GraphQL client ────────────────────────────────────────────────────────────

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: { message: string; extensions?: any }[];
}

/**
 * Kirim GraphQL query/mutation ke backend Rafli.
 * @param query - GraphQL query/mutation string
 * @param variables - variables object
 * @param adminToken - JWT token admin (opsional, untuk operasi yang memerlukan auth)
 */
export async function rafliGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>,
  adminToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const res = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Rafli GraphQL request gagal: ${res.status} ${res.statusText}`);
  }

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map(e => e.message).join('; ');
    throw new Error(`Rafli GraphQL error: ${msg}`);
  }

  if (!json.data) {
    throw new Error('Rafli GraphQL: response tidak memiliki data');
  }

  return json.data;
}

// ─── REST client (legacy) ──────────────────────────────────────────────────────

const defaultHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
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

export const rafliClient = { get, post, patch, graphql: rafliGraphQL };
