// Input rules shared by the routes. They are the same rules the sign-up screens show.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_PASSWORD_LENGTH = 200; // very long passwords would only slow the server down

export const passwordProblem = pw => {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > MAX_PASSWORD_LENGTH) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
};

export const text = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const last10 = value => String(value || '').replace(/\D/g, '').slice(-10);

// "APEX-25-0101", "apex 25 0101" and "APEX-25-101" all become the same key
export const normRoll = value =>
  String(value || '')
    .toUpperCase()
    .trim()
    .replace(/(\d+)(?=\D*$)/, m => String(parseInt(m, 10)))
    .replace(/[^A-Z0-9]/g, '');

// One format for stored phones: "+91 98765 43210" for 10-digit Indian numbers
export const normalizePhone = value => {
  const raw = String(value || '');
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : '';
  if (ten && (digits.length === 10 || digits.startsWith('91') || digits.startsWith('0'))) {
    return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  }
  return raw.trim();
};

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Roll numbers: highest number in the list + 1 (same rule as the app had in the browser)
export const ROLL_PREFIX = 'APEX-25-';
export const nextRollNumber = students => {
  const used = students.map(s => {
    const match = String(s.rollNo || '').match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const next = Math.max(100, ...used) + 1;
  return `${ROLL_PREFIX}${String(next).padStart(4, '0')}`;
};

export const newId = prefix => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export const roleLabel = role => {
  switch (role) {
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
export const portalLabel = role => (role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Administration');
