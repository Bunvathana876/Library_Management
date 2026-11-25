import { parseProblemDetail } from '@/utils/errors';

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenProvider = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureHttpClient(options: {
  getToken: TokenProvider;
  onUnauthorized: UnauthorizedHandler;
}): void {
  getToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  skipUnauthorizedHandler?: boolean;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    skipUnauthorizedHandler = false,
    signal,
  } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth && !skipUnauthorizedHandler) {
      onUnauthorized();
    }
    throw parseProblemDetail(response.status, parsed);
  }

  return parsed as T;
}
