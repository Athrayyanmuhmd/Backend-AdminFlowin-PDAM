/**
 * HTTP/GraphQL client untuk komunikasi ke backend Teknisi (TEKNISI-TA-RAFLI, port 4000).
 * Ini adalah satu-satunya pintu masuk data dari sistem Rafli ke admin.
 *
 * Auth: x-api-key (INTERNAL_API_SECRET) + x-signature HMAC-SHA256 dari payload variables.
 * Semua resolver domain admin menerima payload canonical dari sini.
 *
 * Lihat: docs/INTEGRATION_FIELD_MAPPING.md untuk aturan transform.
 */

import crypto from 'crypto';

const BASE_URL = process.env.TEKNISI_BACKEND_URL ?? 'http://localhost:4000';
const API_KEY = process.env.INTERNAL_API_SECRET ?? '';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 500;

// ─── Error Contract ────────────────────────────────────────────────────────────

export interface IntegrationError {
  source: 'rafli';
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
  return { source: 'rafli', operation, statusCode, retryable, message };
}

function isRetryable(statusCode: number): boolean {
  return statusCode === 0 || statusCode >= 500;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  attempt = 1,
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const retryable = ('retryable' in err) ? err.retryable : true;
    if (retryable && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE_MS * 2 ** (attempt - 1);
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, operation, attempt + 1);
    }
    throw err;
  }
}

// ─── Payload signature ────────────────────────────────────────────────────────

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

const generateSignature = (payload: unknown): string =>
  crypto.createHmac('sha256', API_KEY).update(canonicalize(payload)).digest('hex');

// ─── Response Validator ───────────────────────────────────────────────────────

function validateGQLResponse<T>(
  json: { data?: T; errors?: { message: string; extensions?: any }[] },
  operation: string,
): T {
  if (json.errors && json.errors.length > 0) {
    if (json.data) {
      // Partial success — data tersedia meski ada error di beberapa field; log & continue
      console.warn(`[teknisiClient:${operation}] Rafli partial errors (${json.errors.length}):`, json.errors.slice(0, 3).map(e => e.message).join('; '));
    } else {
      // Fatal — tidak ada data sama sekali
      const msg = json.errors.map(e => e.message).join('; ');
      throw buildError(operation, 422, `Teknisi GQL errors: ${msg}`, false);
    }
  }
  if (!json.data) {
    throw buildError(operation, 502, 'Teknisi GraphQL: response tidak memiliki data', true);
  }
  return json.data;
}

// ─── GraphQL client ────────────────────────────────────────────────────────────

/**
 * Kirim GraphQL query/mutation ke backend Teknisi (Rafli).
 * Otomatis: x-api-key + x-signature, timeout 30s, retry 3x, error contract standar.
 */
export async function teknisiGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>,
  _adminToken?: string,
  operation = 'unknown',
): Promise<T> {
  return withRetry(async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    };

    if (variables && Object.keys(variables).length > 0) {
      const payloadToSign = variables.input ?? variables;
      headers['x-signature'] = generateSignature(payloadToSign);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
        throw buildError(operation, 0, `Teknisi backend timeout (${REQUEST_TIMEOUT_MS}ms)`, true);
      }
      throw buildError(operation, 0, `Teknisi backend tidak tersedia: ${fetchErr.message}`, true);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw buildError(
        operation,
        res.status,
        `Teknisi GraphQL HTTP ${res.status}: ${res.statusText}`,
        isRetryable(res.status),
      );
    }

    let json: { data?: T; errors?: { message: string; extensions?: any }[] };
    try {
      json = await res.json();
    } catch {
      throw buildError(operation, 502, 'Teknisi GraphQL: response bukan JSON valid', true);
    }

    return validateGQLResponse<T>(json, operation);
  }, operation);
}

// ─── REST client ──────────────────────────────────────────────────────────────

const defaultHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

async function restRequest<T = any>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    clearTimeout(timer);
    if (fetchErr?.name === 'AbortError') {
      throw buildError(path, 0, `Teknisi REST timeout: ${path}`, true);
    }
    throw buildError(path, 0, `Teknisi REST tidak tersedia: ${fetchErr.message}`, true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw buildError(path, res.status, `Teknisi REST ${method} ${path} gagal: ${res.status}`, isRetryable(res.status));
  }

  return res.json() as Promise<T>;
}

export const teknisiClient = {
  get: <T = any>(path: string) => restRequest<T>('GET', path),
  post: <T = any>(path: string, body: unknown) => restRequest<T>('POST', path, body),
  patch: <T = any>(path: string, body: unknown) => restRequest<T>('PATCH', path, body),
  graphql: teknisiGraphQL,
};
