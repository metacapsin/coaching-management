import { useEffect, useState } from 'react';
import type {
  AttendanceRecord,
  Batch,
  Course,
  Exam,
  FeeTransaction,
  InstituteProfile,
  NotificationLog,
  NotificationTemplate,
  Student,
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

export const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  options: { auth?: boolean } = {}
): Promise<T> => {
  const auth = options.auth !== false;
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
  const res = await request<{ version: number; renumbered?: number }>('PUT', '/institute', { changes });
  // If the server changed a roll / receipt number it must be fetched, otherwise it is our own change only
  if (res.renumbered) version = -1;
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
