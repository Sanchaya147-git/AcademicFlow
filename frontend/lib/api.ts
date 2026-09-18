export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options, credentials: 'include',
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || 'Request failed');
    throw new Error(`${response.status}: ${message}`);
  }
  return body as T;
}
export const post = <T>(path: string, data?: unknown) => api<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
