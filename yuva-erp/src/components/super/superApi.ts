import { useEffect, useState } from 'react';

// The Super Admin page has its own sign-in: its token is kept apart from the coaching app's token,
// so the two can never mix up.

const KEY = 'academia_os_super_token_v1';

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

let token = read();

export const hasSuperToken = () => !!token;

export const setSuperToken = (value: string, remember: boolean) => {
  token = value;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, value);
  } catch {
    /* the sign-in then lasts until the page is closed */
  }
};

export const clearSuperToken = () => {
  token = null;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

export class SuperApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const superRequest = async <T>(method: string, path: string, body?: unknown, auth = true): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new SuperApiError(0, 'Cannot reach the server. Please check that it is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth && token) clearSuperToken();
    throw new SuperApiError(res.status, (data && data.error) || `Request failed (${res.status}).`);
  }
  return data as T;
};

export type OrgStatus = 'pending' | 'active' | 'suspended';

export interface OrgSummary {
  id: string;
  name: string;
  city: string;
  status: OrgStatus;
  createdAt: string;
  admin: { id: string; name: string; email: string; phone: string } | null;
  students: number;
  accounts: number;
}

export interface SuperUser {
  id: string;
  name: string;
  email: string;
  role: 'super';
}

export interface NewCoaching {
  coachingName: string;
  city: string;
  adminName: string;
  phone: string;
  email: string;
  password: string;
}

export const superApi = {
  status: () => superRequest<{ hasSuper: boolean }>('GET', '/super/status', undefined, false),
  setup: (input: { name: string; email: string; password: string }) =>
    superRequest<{ token: string; user: SuperUser }>('POST', '/super/setup', input, false),
  login: (email: string, password: string, remember: boolean) =>
    superRequest<{ token: string; user: SuperUser }>('POST', '/auth/login', { email, password, portal: 'super', remember }, false),
  me: () => superRequest<{ user: SuperUser }>('GET', '/auth/me'),
  logout: () => superRequest<{ ok: true }>('POST', '/auth/logout'),
  orgs: () => superRequest<{ orgs: OrgSummary[] }>('GET', '/super/orgs').then(r => r.orgs),
  add: (input: NewCoaching) => superRequest<{ org: OrgSummary }>('POST', '/super/orgs', input),
  edit: (id: string, input: { name: string; city: string }) => superRequest<{ org: OrgSummary }>('PUT', `/super/orgs/${id}`, input),
  approve: (id: string) => superRequest<unknown>('POST', `/super/orgs/${id}/approve`, {}),
  reject: (id: string) => superRequest<unknown>('POST', `/super/orgs/${id}/reject`, {}),
  suspend: (id: string) => superRequest<unknown>('POST', `/super/orgs/${id}/suspend`, {}),
  activate: (id: string) => superRequest<unknown>('POST', `/super/orgs/${id}/activate`, {}),
  remove: (id: string, confirmName: string) => superRequest<unknown>('DELETE', `/super/orgs/${id}`, { confirmName }),
  resetAdminPassword: (id: string, newPassword: string) =>
    superRequest<unknown>('POST', `/super/orgs/${id}/reset-admin-password`, { newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    superRequest<unknown>('POST', '/auth/change-password', { currentPassword, newPassword })
};

// The list of coachings, refreshed every 15 seconds
export const useOrgs = (enabled: boolean) => {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const list = await superApi.orgs();
        if (alive) {
          setOrgs(list);
          setError('');
          setLoaded(true);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load the coachings.');
      }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled, tick]);

  return { orgs, error, loaded, reload: () => setTick(t => t + 1) };
};
