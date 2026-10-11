'use client';

/** Error with a stable machine code from the API (e.g. "table_has_open_order"). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields?: { path: string; message: string }[],
  ) {
    super(code);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

function branchHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const id = window.localStorage.getItem('sufra.branch');
    return id ? { 'x-branch-id': id } : {};
  } catch {
    return {};
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...branchHeader(),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, init, false);
    if (typeof window !== 'undefined') window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  if (!res.ok) {
    let body: { message?: string | string[]; errors?: { path: string; message: string }[] } = {};
    try {
      body = await res.json();
    } catch {
      /* not json */
    }
    const code = Array.isArray(body.message) ? body.message[0] ?? 'error' : body.message ?? `http_${res.status}`;
    throw new ApiError(res.status, code, body.errors);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Downloads a file from the API (CSV exports) keeping auth cookies. */
export async function download(path: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'same-origin', headers: branchHeader() });
  if (!res.ok) throw new ApiError(res.status, `http_${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
