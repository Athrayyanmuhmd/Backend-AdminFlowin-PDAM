/**
 * HTTP/GraphQL client untuk komunikasi ke backend Pelanggan (USER-TA-AHMAD, port 3001).
 * Ini adalah satu-satunya pintu masuk data dari sistem Ahmad ke admin.
 *
 * Semua resolver domain admin harus menerima payload canonical dari sini,
 * bukan memparse payload mentah langsung dari Ahmad.
 *
 * Lihat: docs/INTEGRATION_FIELD_MAPPING.md untuk aturan transform.
 */

const BASE_URL = process.env.PELANGGAN_BACKEND_URL ?? 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 500;

// ─── Error Contract ────────────────────────────────────────────────────────────

export interface IntegrationError {
  source: 'ahmad';
  operation: string;
  statusCode: number;
  retryable: boolean;
  message: string;
}

function buildError(
  operation: string,
  statusCode: number,
  message: string,
  retryable: boolean,
): IntegrationError {
  return { source: 'ahmad', operation, statusCode, retryable, message };
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

function isRetryable(statusCode: number): boolean {
  // Network error (0) atau 5xx server error
  return statusCode === 0 || statusCode >= 500;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  attempt = 1,
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isIntegrationErr = err && 'source' in err;
    const retryable = isIntegrationErr ? err.retryable : true;

    if (retryable && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE_MS * 2 ** (attempt - 1);
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, operation, attempt + 1);
    }

    throw err;
  }
}

// ─── Response Validator ───────────────────────────────────────────────────────

function validateGQLResponse<T>(
  json: { data?: T; errors?: { message: string }[] },
  operation: string,
): T {
  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map(e => e.message).join('; ');
    throw buildError(operation, 422, `Pelanggan GQL errors: ${msg}`, false);
  }
  if (!json.data) {
    throw buildError(operation, 502, 'Pelanggan GraphQL: response tidak memiliki data', true);
  }
  return json.data;
}

// ─── GraphQL client ────────────────────────────────────────────────────────────

/**
 * Kirim GraphQL query/mutation ke backend Pelanggan (Ahmad).
 * Otomatis: timeout 30s, retry 3x untuk network/5xx, error contract standar.
 */
export async function pelangganGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>,
  token?: string,
  operation = 'unknown',
): Promise<T> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      if (fetchErr?.name === 'AbortError') {
        throw buildError(operation, 0, `Pelanggan backend timeout (${REQUEST_TIMEOUT_MS}ms)`, true);
      }
      throw buildError(operation, 0, `Pelanggan backend tidak tersedia: ${fetchErr.message}`, true);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw buildError(
        operation,
        res.status,
        `Pelanggan GraphQL HTTP ${res.status}: ${res.statusText}`,
        isRetryable(res.status),
      );
    }

    let json: { data?: T; errors?: { message: string }[] };
    try {
      json = await res.json();
    } catch {
      throw buildError(operation, 502, 'Pelanggan GraphQL: response bukan JSON valid', true);
    }

    return validateGQLResponse<T>(json, operation);
  }, operation);
}

export const pelangganClient = { graphql: pelangganGraphQL };
