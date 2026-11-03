import { useEffect, useState } from 'react';
import type {
  Announcement,
  AttendanceRecord,
  Batch,
  Book,
  Course,
  Enquiry,
  Exam,
  Expense,
  FeeTransaction,
  InstituteProfile,
  NotificationLog,
  NotificationTemplate,
  Salary,
  StaffAttendance,
  Student,
  StudyMaterial,
  Submission,
  TimetableSlot
} from '../../types';
import type { UserRole } from '../../Context/Access';

// Talks to the AcademiaOS server (server/db-server.mjs).
//
// - every call goes to /api (the Vite dev server forwards it to the server, and the server itself
//   answers it when the built app is opened from it)
// - the session token is kept in localStorage ("keep me signed in") or sessionStorage
// - a small loop asks the server every few seconds for changes made on other computers

export type AccountStatus = 'active' | 'pending';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  phone?: string;
  subject?: string;
  studentId?: string; // students: linked admission record
  batchIds?: string[]; // teachers: batches they handle
  resetRequestedAt?: string; // set when the person asked for a new password
  mustChangePassword?: boolean; // somebody else set the password: the person must choose an own one
  isParent?: boolean; // a parent's login (role student, linked to the child's record, read only)
}

export interface InstituteData {
  profile?: InstituteProfile;
  courses?: Course[];
  batches?: Batch[];
  students?: Student[];
  attendance?: AttendanceRecord[];
  transactions?: FeeTransaction[];
  exams?: Exam[];
  timetable?: TimetableSlot[];
  templates?: NotificationTemplate[];
  notificationLogs?: NotificationLog[];
  enquiries?: Enquiry[];
  expenses?: Expense[];
  salaries?: Salary[];
  staffAttendance?: StaffAttendance[];
  books?: Book[];
  submissions?: Submission[];
  announcements?: Announcement[];
  materials?: StudyMaterial[];
}

export interface ListChange<T> {
  upsert?: T[];
  remove?: string[];
}

export type InstituteChanges = { profile?: InstituteProfile } & {
  [K in Exclude<keyof InstituteData, 'profile'>]?: ListChange<NonNullable<InstituteData[K]>[number]>;
};

export interface SyncPayload {
  changed: true;
  version: number;
  user: AuthUser;
  users?: AuthUser[]; // only for the principal and front desk staff
  org?: { id: string; name: string; city: string }; // the coaching this account belongs to
  institute: InstituteData;
}

export type SyncStatus = 'connected' | 'offline';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- session token ----------

const TOKEN_KEY = 'academia_os_token_v1';

const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

let token: string | null = readToken();

export const hasToken = () => !!token;

// When the Super Admin enters a coaching (with that coaching's principal login) the Super Admin sign-in is
// kept for this browser tab only, so signing out of the coaching brings the Super Admin dashboard back.
const RETURN_KEY = 'academia_os_return_token_v1';

export const rememberSuperSession = () => {
  try {
    if (token) sessionStorage.setItem(RETURN_KEY, token);
  } catch {
    /* then signing out simply goes to the login page */
  }
};

export const hasSuperSession = (): boolean => {
  try {
    return !!sessionStorage.getItem(RETURN_KEY);
  } catch {
    return false;
  }
};

export const takeSuperSession = (): string | null => {
  try {
    const value = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return value;
  } catch {
    return null;
  }
};

export const setToken = (value: string, remember: boolean) => {
  token = value;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, value);
  } catch {
    /* the session then lasts until the page is closed */
  }
};

export const clearToken = () => {
  token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

// ---------- requests ----------

const unauthorizedListeners = new Set<() => void>();

// Called when the server says the session is not valid anymore (signed out, removed, password reset)
export const onUnauthorized = (fn: () => void) => {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
};

// The coaching a student or teacher is signing up to. The sign-up forms send it with their requests.
let publicOrgId: string | null = null;
export const setPublicOrg = (id: string | null) => {
  publicOrgId = id;
};
const needsOrg = (path: string) => /^\/(auth\/register-|public\/registration-options)/.test(path);

export const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  options: { auth?: boolean } = {}
): Promise<T> => {
  const auth = options.auth !== false;
  let url = `/api${path}`;
  if (!auth && publicOrgId && needsOrg(path)) {
    if (method === 'GET') url += `${url.includes('?') ? '&' : '?'}orgId=${encodeURIComponent(publicOrgId)}`;
    else if (body && typeof body === 'object') body = { ...(body as Record<string, unknown>), orgId: publicOrgId };
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    setStatus('offline');
    throw new ApiError(0, 'Cannot reach the server. Please check that it is running ("npm run server").');
  }

  const data = await res.json().catch(() => ({}));
  if (res.status >= 500) setStatus('offline'); // the server or its database is not working right now
  if (!res.ok) {
    if (res.status === 401 && auth && token) {
      clearToken();
      stopSync();
      unauthorizedListeners.forEach(fn => fn());
    }
    throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status}).`);
  }
  return data as T;
};

// ---------- connection status ----------

let currentStatus: SyncStatus = 'offline';
const statusListeners = new Set<(s: SyncStatus) => void>();

const setStatus = (s: SyncStatus) => {
  if (s === currentStatus) return;
  currentStatus = s;
  statusListeners.forEach(fn => fn(s));
};

export const useSyncStatus = (): SyncStatus => {
  const [status, setLocal] = useState<SyncStatus>(currentStatus);
  useEffect(() => {
    setLocal(currentStatus);
    statusListeners.add(setLocal);
    return () => {
      statusListeners.delete(setLocal);
    };
  }, []);
  return status;
};

// ---------- the sync loop ----------

const POLL_MS = 4000;

let version = -1;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let inFlight = false;
let lastPayload: SyncPayload | null = null;
const syncListeners = new Set<(payload: SyncPayload) => void>();
const flushers = new Set<() => Promise<void>>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const tick = async () => {
  if (!running || inFlight) return;
  inFlight = true;
  try {
    const res = await request<SyncPayload | { changed: false; version: number }>('GET', `/sync?since=${version}`);
    setStatus('connected');
    if (res.changed) {
      version = res.version;
      lastPayload = res;
      syncListeners.forEach(fn => fn(res));
    }
  } catch {
    /* request() already updated the status; the next tick tries again */
  } finally {
    inFlight = false;
  }
};

export const startSync = () => {
  if (running) return;
  running = true;
  version = -1;
  void tick();
  timer = setInterval(tick, POLL_MS);
};

export const stopSync = () => {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  version = -1;
  lastPayload = null;
};

// Gets the newest data now (after our own change on the server). `force` also takes data we already have.
export const refreshNow = async (force = false) => {
  if (!running) return;
  while (inFlight) await sleep(25);
  if (force) version = -1;
  await tick();
};

// Listener gets the newest data at once (if there is any) and every later change
export const subscribeSync = (fn: (payload: SyncPayload) => void) => {
  syncListeners.add(fn);
  if (lastPayload) fn(lastPayload);
  return () => {
    syncListeners.delete(fn);
  };
};

// Sends changed institute data. Our own change does not need to be fetched back.
export const pushInstitute = async (changes: InstituteChanges) => {
  const res = await request<{ version: number; adjusted?: number }>('PUT', '/institute', { changes });
  // If the server changed something itself (a roll / receipt number, a photo moved) it must be fetched,
  // otherwise it is our own change only
  if (res.adjusted) version = -1;
  else if (res.version === version + 1) version = res.version;
  return res;
};

// Screens with changes that are still waiting to be sent register here, so signing out sends them first
export const registerFlusher = (fn: () => Promise<void>) => {
  flushers.add(fn);
  return () => {
    flushers.delete(fn);
  };
};

export const flushPending = async () => {
  await Promise.all([...flushers].map(fn => fn().catch(() => undefined)));
};

// ---------- backups (principal only) ----------

export interface StoredBackup {
  id: string;
  createdAt: string;
  label: string;
  size: number;
}

// Downloads a file from the server (needs the session token, so a plain link would not work)
export const downloadFromServer = async (path: string, fallbackName: string) => {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, 'Cannot reach the server.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data && data.error) || `Download failed (${res.status}).`);
  }
  const blob = await res.blob();
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const listBackups = () => request<{ backups: StoredBackup[] }>('GET', '/backups').then(r => r.backups);
export const createBackup = (label = 'manual') => request<{ id: string }>('POST', '/backups', { label });
export const restoreStoredBackup = (id: string) =>
  request<unknown>('POST', `/backups/${id}/restore`, { confirm: 'RESTORE' });
export const restoreBackupFile = (backup: unknown) =>
  request<unknown>('POST', '/backup/restore', { confirm: 'RESTORE', backup });

// Own phone number / name / subject
export const updateOwnDetails = (details: { name?: string; phone?: string; subject?: string }) =>
  request<{ user: AuthUser }>('PUT', '/auth/profile', details);

// The Super Admin forgot the password: works only on the server computer itself
export const resetSuperPassword = (email: string, newPassword: string) =>
  request<{ ok: true }>('POST', '/super/forgot-password', { email, newPassword }, { auth: false });

// Tells the principal that somebody forgot the password (the answer is always the same)
export const requestPasswordReset = (email: string) =>
  request<{ ok: true }>('POST', '/auth/forgot-password', { email }, { auth: false });

// the 6-digit code that was emailed after "Forgot your password?", and the new password
export const resetPasswordWithCode = (email: string, code: string, password: string) =>
  request<{ ok: true }>('POST', '/auth/reset-with-code', { email, code, password }, { auth: false });

// ---------- coachings (sign-up pages) ----------

export interface PublicCoaching {
  id: string;
  name: string;
  city: string;
}

export const listCoachings = () => request<{ coachings: PublicCoaching[] }>('GET', '/public/coachings', undefined, { auth: false }).then(r => r.coachings);

export interface CoachingRequest {
  coachingName: string;
  city: string;
  adminName: string;
  phone: string;
  email: string;
  password: string;
}

// A coaching asks to join; the super admin has to approve it before its principal can sign in
export const registerCoaching = (input: CoachingRequest) =>
  request<{ ok: true }>('POST', '/public/register-coaching', input, { auth: false });
