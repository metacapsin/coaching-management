import { useEffect, useState } from 'react';
import { request } from '../utils/api';

// The Super Admin signs in on the same login page as everybody else (Administration tab); these calls
// use the same sign-in as the rest of the app.

const superRequest = <T>(method: string, path: string, body?: unknown) => request<T>(method, path, body);

export interface ActivityEntry {
  at: string;
  name: string | null;
  action: string;
  detail: string;
}

export type OrgStatus = 'pending' | 'active' | 'suspended';

export interface OrgSummary {
  id: string;
  name: string;
  city: string;
  status: OrgStatus;
  createdAt: string;
  admin: { id: string; name: string; email: string; phone: string; resetRequestedAt?: string | null } | null;
  students: number;
  accounts: number;
}

export interface NewCoaching {
  coachingName: string;
  city: string;
  adminName: string;
  phone: string;
  email: string;
  password: string;
  asRequest?: boolean; // leave it waiting for approval instead of activating it
}

export const superApi = {
  audit: () => superRequest<{ entries: ActivityEntry[] }>('GET', '/super/audit?limit=100').then(r => r.entries),
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
