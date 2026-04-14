/**
 * GraphQL client untuk komunikasi ke backend Ahmad (flowin-backend).
 * Ahmad's system: customer-facing backend (Pengguna, KoneksiData, Tagihan, Meter, Laporan, RAB)
 *
 * Catatan: Backend Ahmad adalah customer-facing. Admin menggunakan client ini
 * hanya untuk operasi cross-system yang membutuhkan data dari Ahmad
 * (misalnya sinkronisasi status, notifikasi pelanggan, dsb).
 * Untuk operasi admin penuh (list all, approve, generate billing),
 * admin mengakses MongoDB yang sama secara langsung via models sendiri.
 */

const BASE_URL = process.env.AHMAD_BACKEND_URL ?? 'http://localhost:3001';

// ─── GraphQL client ────────────────────────────────────────────────────────────

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Kirim GraphQL query/mutation ke backend Ahmad.
 * @param query - GraphQL query/mutation string
 * @param variables - variables object
 * @param token - JWT token user (dari Ahmad's auth)
 */
export async function ahmadGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Ahmad GraphQL request gagal: ${res.status} ${res.statusText}`);
  }

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map(e => e.message).join('; ');
    throw new Error(`Ahmad GraphQL error: ${msg}`);
  }

  if (!json.data) {
    throw new Error('Ahmad GraphQL: response tidak memiliki data');
  }

  return json.data;
}

export const ahmadClient = { graphql: ahmadGraphQL };
