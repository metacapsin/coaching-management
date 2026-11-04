import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Course, Batch } from '../types';
import type { UserRole } from './Access';
import {
  ApiError,
  clearToken,
  flushPending,
  hasToken,
  onUnauthorized,
  refreshNow,
  rememberSuperSession,
  request,
  setToken,
  startSync,
  stopSync,
  subscribeSync,
  takeSuperSession
} from '../components/utils/api';
import type { AuthUser } from '../components/utils/api';

export type { UserRole } from './Access';
export type { AuthUser, AccountStatus } from '../components/utils/api';

export type Portal = 'super' | 'admin' | 'staff' | 'member' | 'parent';

export type AuthResult = { ok: true } | { ok: false; error: string };

export interface NewAccountInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  subject?: string;
  batchIds?: string[];
  studentId?: string;
  isParent?: boolean;
}

export interface NewStudentInput {
  name: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  grade: string;
  courseId: string;
  batchId: string;
  email: string;
  password: string;
}

// The public sign-up page only gets what it needs to show
export type RegistrationBatch = Pick<
  Batch,
  'id' | 'code' | 'name' | 'courseId' | 'courseName' | 'startTime' | 'endTime' | 'maxCapacity' | 'status'
> & { filled: number };

export type RegistrationCourse = Pick<Course, 'id' | 'code' | 'name'>;

export interface RegistrationOptions {
  courses: RegistrationCourse[];
  batches: RegistrationBatch[];
  nextRollNo: string;
}

interface AuthContextType {
  // false until the first answer from the server (session check)
  ready: boolean;
  // set when the server could not be reached while starting
  serverError: string | null;
  retryConnection: () => void;

  user: AuthUser | null;
  users: AuthUser[]; // filled for the principal and front desk staff
  hasUsers: boolean;
  hasSuper: boolean; // false until the Super Admin was created
  isAdmin: boolean;

  // First-time setup only (creates the Super Admin)
  signUp: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
  // Public registration
  registerNewStudent: (input: NewStudentInput) => Promise<AuthResult>;
  getRegistrationOptions: () => Promise<RegistrationOptions>;
  registerStudent: (input: { rollNo: string; phone: string; email: string; password: string }) => Promise<AuthResult>;
  registerParent: (input: { rollNo: string; phone: string; email: string; password: string; orgId?: string }) => Promise<AuthResult>;
  registerTeacher: (input: {
    name: string;
    phone: string;
    subject: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;

  signIn: (input: { email: string; password: string; remember: boolean; portal: Portal; orgId?: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;

  // Administrator only
  addUser: (input: NewAccountInput) => Promise<AuthResult>;
  approveUser: (id: string, batchIds?: string[]) => Promise<AuthResult>;
  rejectUser: (id: string) => Promise<AuthResult>;
  setUserBatches: (id: string, batchIds: string[]) => Promise<AuthResult>;
  removeUser: (id: string) => Promise<AuthResult>;
  setUserRole: (id: string, role: UserRole) => Promise<AuthResult>;
  resetUserPassword: (id: string, newPassword: string) => Promise<AuthResult>;

  // Any signed-in user
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  changeOwnEmail: (currentPassword: string, newEmail: string) => Promise<AuthResult>;
}

// The label of one account: a parent's login is a student-role account marked as parent
export const accountLabel = (user?: { role?: UserRole; isParent?: boolean } | null) =>
  user?.isParent ? 'Parent' : roleLabel(user?.role);

export const roleLabel = (role?: UserRole) => {
  switch (role) {
    case 'super':
      return 'Super Admin';
    case 'admin':
      return 'Principal (Administrator)';
    case 'staff':
      return 'Front Desk Staff';
    case 'teacher':
      return 'Teacher';
    case 'student':
      return 'Student';
    default:
      return 'User';
  }
};

// Which login tab a role belongs to
export const portalLabel = (role: UserRole) =>
  role === 'super' ? 'Super Admin' : role === 'student' || role === 'teacher' ? 'Teacher / Student' : 'Coaching Admin';

// The Super Admin entered a coaching and that sign-in ended (sign out, expired, removed): take the Super Admin
// sign-in back, if this tab has one. Returns the Super Admin account, or null.
const restoreSuperSession = async (): Promise<AuthUser | null> => {
  const back = takeSuperSession();
  if (!back) return null;
  try {
    setToken(back, false);
    const me = await request<{ user: AuthUser }>('GET', '/auth/me');
    if (me.user.role === 'super') return me.user;
  } catch {
    /* the Super Admin sign in is not valid anymore */
  }
  clearToken();
  return null;
};

// Turns a server answer into { ok } / { ok: false, error } for the screens
const attempt = async (action: () => Promise<unknown>): Promise<AuthResult> => {
  try {
    await action();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
  }
};

// ---------- Context ----------

const AuthContext = createContext<AuthContextType | null>(null);

type Session = { token: string; user: AuthUser };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [hasUsers, setHasUsers] = useState(true);
  const [hasSuper, setHasSuper] = useState(true);
  const [attemptNo, setAttemptNo] = useState(0);

  const isAdmin = user?.role === 'admin';
  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;

  // Start: is there an account yet, and is the saved session still valid?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await request<{ hasUsers: boolean; hasSuper: boolean }>('GET', '/auth/status', undefined, { auth: false });
        if (cancelled) return;
        setHasUsers(status.hasUsers);
        setHasSuper(status.hasSuper);

        if (hasToken()) {
          try {
            const me = await request<{ user: AuthUser }>('GET', '/auth/me');
            if (cancelled) return;
            setUser(me.user);
            if (me.user.role !== 'super') startSync(); // the super admin has no coaching data to sync
          } catch (err) {
            if (!(err instanceof ApiError) || err.status !== 401) throw err; // 401: the session expired
          }
        }
        // no sign-in left, but the Super Admin had entered a coaching in this tab: back to the Super Admin
        if (!cancelled && !hasToken()) {
          const superUser = await restoreSuperSession();
          if (superUser && !cancelled) setUser(superUser);
        }
        if (!cancelled) {
          setServerError(null);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setServerError(err instanceof Error ? err.message : 'Cannot reach the server.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptNo]);

  // The server ended the session (signed out elsewhere, account removed, password reset)
  useEffect(
    () =>
      onUnauthorized(() => {
        setUsers([]);
        // a coaching sign-in that ended: the Super Admin who entered it gets the dashboard back
        void restoreSuperSession().then(superUser => setUser(superUser));
      }),
    []
  );

  // Keep the signed-in account and the accounts list in step with the server
  useEffect(() => {
    if (!userId) return;
    return subscribeSync(payload => {
      setUser(payload.user);
      if (payload.users) setUsers(payload.users);
      setHasUsers(true);
    });
  }, [userId]);

  const startSession = (session: Session, remember: boolean) => {
    setToken(session.token, remember);
    setUser(session.user);
    setHasUsers(true);
    if (session.user.role === 'super') setHasSuper(true);
    else startSync(); // the super admin has no coaching data to sync
  };

  // ----- First-time setup: creates the Super Admin (only on the server computer itself) -----
  const signUp = useCallback(
    (input: { name: string; email: string; password: string }) =>
      attempt(async () => {
        const session = await request<Session>('POST', '/super/setup', input, { auth: false });
        startSession(session, true);
      }),
    []
  );

  // ----- Student registration (verified against admission record) -----
  const registerStudent = useCallback(
    (input: { rollNo: string; phone: string; email: string; password: string }) =>
      attempt(async () => {
        const session = await request<Session>('POST', '/auth/register-student', input, { auth: false });
        startSession(session, true);
      }),
    []
  );

  // ----- Parent registration (checked against the admission record: roll number of the child and the parent mobile) -----
  const registerParent = useCallback(
    (input: { rollNo: string; phone: string; email: string; password: string; orgId?: string }) =>
      attempt(async () => {
        const session = await request<Session>('POST', '/auth/register-parent', input, { auth: false });
        startSession(session, true);
      }),
    []
  );

  // ----- New student registration: the server creates the record with an automatic roll number -----
  const registerNewStudent = useCallback(
    (input: NewStudentInput) =>
      attempt(async () => {
        const session = await request<Session>('POST', '/auth/register-new-student', input, { auth: false });
        startSession(session, true);
      }),
    []
  );

  const getRegistrationOptions = useCallback(
    () => request<RegistrationOptions>('GET', '/public/registration-options', undefined, { auth: false }),
    []
  );

  // ----- Teacher registration (needs principal approval) -----
  const registerTeacher = useCallback(
    (input: { name: string; phone: string; subject: string; email: string; password: string }) =>
      attempt(() => request('POST', '/auth/register-teacher', input, { auth: false })),
    []
  );

  // ----- Sign in / out -----
  const signIn = useCallback(
    (input: { email: string; password: string; remember: boolean; portal: Portal; orgId?: string }) =>
      attempt(async () => {
        const session = await request<Session>('POST', '/auth/login', input, { auth: false });
        // the Super Admin enters a coaching: keep the Super Admin sign-in to come back to it
        if (input.orgId && userRef.current?.role === 'super') rememberSuperSession();
        startSession(session, input.remember);
      }),
    []
  );

  const signOut = useCallback(async () => {
    if (userRef.current?.role === 'super') takeSuperSession(); // a real Super Admin sign out: nothing to come back to
    await flushPending(); // changes that are still waiting are sent first
    try {
      await request('POST', '/auth/logout');
    } catch {
      /* the session is removed on this device anyway */
    }
    clearToken();
    stopSync();
    setUsers([]);
    // Signed out of a coaching that the Super Admin had entered: back to the Super Admin dashboard
    setUser(await restoreSuperSession());
  }, []);

  // ----- Account management (administrator only) -----
  // After each change the newest list is fetched, so the screen shows the result at once.
  const changeAccounts = (action: () => Promise<unknown>) =>
    attempt(async () => {
      await action();
      await refreshNow();
    });

  const addUser = useCallback(
    (input: NewAccountInput) => changeAccounts(() => request('POST', '/users', input)),
    []
  );

  const approveUser = useCallback(
    (id: string, batchIds?: string[]) => changeAccounts(() => request('POST', `/users/${id}/approve`, { batchIds })),
    []
  );

  const rejectUser = useCallback((id: string) => changeAccounts(() => request('POST', `/users/${id}/reject`, {})), []);

  const setUserBatches = useCallback(
    (id: string, batchIds: string[]) => changeAccounts(() => request('PUT', `/users/${id}/batches`, { batchIds })),
    []
  );

  const removeUser = useCallback((id: string) => changeAccounts(() => request('DELETE', `/users/${id}`)), []);

  // Only between Administrator and Front Desk Staff. Teacher / student roles are fixed.
  const setUserRole = useCallback(
    (id: string, role: UserRole) => changeAccounts(() => request('PUT', `/users/${id}/role`, { role })),
    []
  );

  const resetUserPassword = useCallback(
    (id: string, newPassword: string) => changeAccounts(() => request('POST', `/users/${id}/reset-password`, { newPassword })),
    []
  );

  // ----- Own account -----
  const changeOwnEmail = useCallback(
    (currentPassword: string, newEmail: string) =>
      attempt(async () => {
        const res = await request<{ user: AuthUser }>('POST', '/auth/change-email', { currentPassword, newEmail });
        setUser(res.user);
      }),
    []
  );

  const changeOwnPassword = useCallback(
    (currentPassword: string, newPassword: string) =>
      attempt(async () => {
        await request('POST', '/auth/change-password', { currentPassword, newPassword });
        // the account no longer has to change its password: fetch it again (the screen follows)
        const me = await request<{ user: AuthUser }>('GET', '/auth/me');
        setUser(me.user);
      }),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        ready,
        serverError,
        retryConnection: () => {
          setServerError(null);
          setAttemptNo(n => n + 1);
        },
        user,
        users,
        hasUsers,
        hasSuper,
        isAdmin,
        signUp,
        registerNewStudent,
        getRegistrationOptions,
        registerStudent,
        registerParent,
        registerTeacher,
        signIn,
        signOut,
        addUser,
        approveUser,
        rejectUser,
        setUserBatches,
        removeUser,
        setUserRole,
        resetUserPassword,
        changeOwnPassword,
        changeOwnEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
