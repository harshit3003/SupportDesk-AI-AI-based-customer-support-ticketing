const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const token = auth ? getToken() : null;
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Please try again.');
  }
  if (res.status === 401 && auth && typeof window !== 'undefined') { window.location.href = '/login'; throw new Error('Unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
};

export const fmtMin = (m) => (m == null ? '—' : m < 60 ? `${Math.round(m)}m` : m < 1440 ? `${(m / 60).toFixed(1)}h` : `${(m / 1440).toFixed(1)}d`);
export const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
export const label = (s) => String(s).replace(/_/g, ' ');
