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
  // what the coaching pays the platform
  monthlyFee: number;
  paidUntil: string | null;
  subscription: 'free' | 'paid' | 'due';
  payments: { id: string; date: string; amount: number; months: number; note: string }[];
}

export interface Income {
  thisMonth: number;
  total: number;
}

export interface DemoLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  coaching: string;
  message: string;
  createdAt: string;
}

export interface NewCoaching {
  coachingName: string;
  city: string;
  adminName: string;
  phone: string;
  email: string;
  password: string;
  appPassword?: string; // optional: the app password of the principal's Gmail (the emails of the coaching go out from it)
}

export interface Decision {
  notified?: 'sent' | 'no-email' | 'none';
  message?: string;
  phone?: string;
}

export const superApi = {
  audit: () => superRequest<{ entries: ActivityEntry[] }>('GET', '/super/audit?limit=100').then(r => r.entries),
  leads: () => superRequest<{ leads: DemoLead[] }>('GET', '/super/leads').then(r => r.leads),
  removeLead: (id: string) => superRequest<unknown>('DELETE', `/super/leads/${id}`),
  orgs: () => superRequest<{ orgs: OrgSummary[]; income: Income }>('GET', '/super/orgs'),
  add: (input: NewCoaching) => superRequest<{ org: OrgSummary }>('POST', '/super/orgs', input),
  recordPayment: (id: string, input: { amount: number; months: number; note: string }) =>
    superRequest<{ org: OrgSummary }>('POST', `/super/orgs/${id}/payments`, input),
  edit: (id: string, input: { name: string; city: string; monthlyFee?: number }) => superRequest<{ org: OrgSummary }>('PUT', `/super/orgs/${id}`, input),
  // `notified` says what happened to the email to the principal: sent, no-email (email not set up on the server) or none
  approve: (id: string) => superRequest<Decision>('POST', `/super/orgs/${id}/approve`, {}),
  reject: (id: string, reason = '') => superRequest<Decision>('POST', `/super/orgs/${id}/reject`, { reason }),
  suspend: (id: string) => superRequest<unknown>('POST', `/super/orgs/${id}/suspend`, {}),
  activate: (id: string) => superRequest<unknown>('POST', `/super/orgs/${id}/activate`, {}),
  remove: (id: string, confirmName: string, password: string) => superRequest<unknown>('DELETE', `/super/orgs/${id}`, { confirmName, password }),
  resetAdminPassword: (id: string, newPassword: string) =>
    superRequest<unknown>('POST', `/super/orgs/${id}/reset-admin-password`, { newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    superRequest<unknown>('POST', '/auth/change-password', { currentPassword, newPassword })
};

// The list of coachings, refreshed every 15 seconds
export const useOrgs = (enabled: boolean) => {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [income, setIncome] = useState<Income>({ thisMonth: 0, total: 0 });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await superApi.orgs();
        if (alive) {
          setOrgs(res.orgs);
          setIncome(res.income);
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

  return { orgs, income, error, loaded, reload: () => setTick(t => t + 1) };
};
