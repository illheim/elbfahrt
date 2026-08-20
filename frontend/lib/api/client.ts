/**
 * Tiny Strapi API client.
 *
 * - Pulls the Strapi base URL from NEXT_PUBLIC_STRAPI_URL with a localhost
 *   fallback so things work even before .env.local is configured.
 * - Adds the bearer token from localStorage when one is present.
 * - Normalises Strapi 5 errors into a single ApiError type.
 *
 * Storage choice: localStorage. Simpler than HttpOnly cookies, acceptable
 * for an MVP at this scale. Documented as a tradeoff in PLAN.md when we
 * revisit security in M4.
 */

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

const JWT_STORAGE_KEY = 'elb-fahrt.jwt';

export class ApiError extends Error {
  public readonly status: number;
  public readonly details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(JWT_STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(JWT_STORAGE_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(JWT_STORAGE_KEY);
}

type RequestInitWithBody = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /**
   * Set to true to suppress the automatic Authorization: Bearer header.
   * Needed for /api/auth/local/register and /api/auth/local — Strapi
   * 403s those when a stale JWT is attached.
   */
  skipAuth?: boolean;
};

/** Endpoints we always send unauthenticated, regardless of token state. */
function isAuthEndpoint(path: string): boolean {
  return (
    path.startsWith('/api/auth/local') ||
    path.startsWith('/api/auth/send-email-confirmation') ||
    path.startsWith('/api/auth/email-confirmation') ||
    path.startsWith('/api/auth/forgot-password') ||
    path.startsWith('/api/auth/reset-password')
  );
}

/**
 * Generic Strapi request. Always sets Accept + Content-Type for JSON,
 * adds bearer auth if a JWT is present (unless skipAuth or an auth
 * endpoint), parses the response body as JSON, throws ApiError on non-2xx.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInitWithBody = {}
): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${STRAPI_URL}${path.startsWith('/') ? path : '/' + path}`;

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const shouldAttachToken =
    !init.skipAuth && !isAuthEndpoint(path);
  const token = shouldAttachToken ? getToken() : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const body =
    init.body === undefined
      ? undefined
      : typeof init.body === 'string'
        ? init.body
        : JSON.stringify(init.body);

  const res = await fetch(url, { ...init, headers, body });

  // 204 No Content → no body to parse.
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    // Strapi 5 error shape: { error: { status, name, message, details } }
    const errObj = (payload as { error?: { message?: string } })?.error;
    const message = errObj?.message || res.statusText || 'Request failed';
    throw new ApiError(res.status, message, errObj);
  }

  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
