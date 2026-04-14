/**
 * HTTP/GraphQL client untuk komunikasi ke backend Rafli (flowin-teknisi-graphql).
 * Setiap request otomatis menyertakan x-api-key (INTERNAL_API_SECRET).
 *
 * Rafli's system: port 4000, endpoint /graphql
 * Auth: x-api-key header (wajib) + x-signature HMAC-SHA256 dari payload variables
 */

import crypto from 'crypto';

const BASE_URL = process.env.RAFLI_BACKEND_URL ?? 'http://localhost:4000';
const API_KEY = process.env.INTERNAL_API_SECRET ?? '';

// ─── Payload signature (mirror Rafli's signatureHash.ts) ─────────────────────

const canonicalize = (obj: unknown): string => {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + (obj as unknown[]).map(canonicalize).join(',') + ']';
  const sorted = Object.keys(obj as Record<string, unknown>).sort().reduce((acc, key) => {
    (acc as Record<string, unknown>)[key] = (obj as Record<string, unknown>)[key];
    return acc;
  }, {} as Record<string, unknown>);
  const entries = Object.entries(sorted).map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return '{' + entries.join(',') + '}';
};

const generateSignature = (payload: unknown): string => {
  return crypto.createHmac('sha256', API_KEY).update(canonicalize(payload)).digest('hex');
};

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
  _adminToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  // Tambahkan x-signature dari payload variables agar Rafli's verifyPayloadSignature lolos
  // Signature dihitung dari variables (bukan seluruh body) — mirror Rafli's signatureHash.ts
  if (variables && Object.keys(variables).length > 0) {
    // Rafli verifies signature against the first-level variable value (e.g. variables.input or variables.id)
    const payloadToSign = variables.input ?? variables;
    headers['x-signature'] = generateSignature(payloadToSign);
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
