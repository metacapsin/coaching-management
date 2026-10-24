// Small shared helpers used across the app.

// Local date as YYYY-MM-DD (toISOString() would give the UTC date, which is
// yesterday in India between 00:00 and 05:30).
export const toLocalISODate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Local "YYYY-MM-DD HH:mm"
export const toLocalDateTime = (d: Date = new Date()): string =>
  `${toLocalISODate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Unique id even when called many times in the same millisecond (bulk loops).
let idCounter = 0;
export const uid = (prefix: string): string => {
  idCounter = (idCounter + 1) % 1000000;
  return `${prefix}-${Date.now()}-${idCounter}`;
};

// wa.me needs the country code. A bare 10-digit Indian number gets 91 in front.
export const toWhatsAppNumber = (phone: string, defaultCountryCode = '91'): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `${defaultCountryCode}${digits.slice(1)}`;
  return digits;
};

export const openWhatsApp = (phone: string, text: string) => {
  window.open(`https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`, '_blank');
};

// Stores a phone in one format: "+91 98765 43210" for 10-digit numbers.
export const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : '';
  if (ten && (digits.length === 10 || digits.startsWith('91') || digits.startsWith('0'))) {
    return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  }
  return (phone || '').trim();
};

// Ranks scores high-to-low. Equal scores share a rank (1, 2, 2, 4).
export const rankOf = (score: number, allScores: number[]): number =>
  allScores.filter(s => s > score).length + 1;

// Replaces {{tag}} placeholders; unknown tags are left as they are.
export const fillTemplate = (body: string, vars: Record<string, string | number>): string =>
  body.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));

// Quotes a CSV cell and blocks spreadsheet formula injection.
export const csvCell = (value: string | number): string => {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '""'; // real numbers stay numbers
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

// ---------- Times like "04:30 PM" ----------

export const TIME_REGEX = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

// "4:30 PM" -> "04:30 PM" (the format must already be hh:mm AM/PM)
export const normalizeTime = (t: string): string => {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t.trim();
  return `${m[1].padStart(2, '0')}:${m[2]} ${m[3].toUpperCase()}`;
};

// "04:30 PM" -> minutes since midnight
export const timeToMinutes = (t: string): number => {
  const m = (t || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

export const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);

export const formatINR = (n: number): string => n.toLocaleString('en-IN');

export const downloadTextFile =(filename: string, content: string, mime = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ---------- dates for display ----------

// "2026-10-24" -> "24 Oct 2026"
export const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// "2026-10-24T10:30:00Z" -> "24 Oct, 04:00 pm" (in the local time zone)
export const formatDateTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Whole days from one YYYY-MM-DD date to another (negative when `toIso` is earlier)
export const daysBetween = (fromIso: string, toIso: string): number => {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
};

// ---------- CSV files (they open in Excel) ----------

export const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const lines = [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))];
  // The BOM makes Excel read names in Hindi or with accents correctly
  downloadTextFile(filename, '\uFEFF' + lines.join('\n'));
};
