import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { request } from '../utils/api';
import { formatDate } from '../utils/helpers';
import type { AuthUser } from '../../Context/AuthContext';

interface Details {
  name: string;
  email: string;
  phone: string;
  subject: string;
  createdAt: string;
  rulesAcceptedAt: string | null;
  details: null | {
    idImage?: string;
    firstName?: string; middleName?: string; lastName?: string; guardianName?: string; alternatePhone?: string; country?: string; countryCode?: string;
    address?: { line?: string; district?: string; state?: string; pin?: string }; dateOfBirth?: string; idType?: string; idNumber?: string;
    qualifications?: string[]; qualification?: string; workHistory?: string; payType?: string; payAmount?: number | null; payNotes?: string;
    termsAccepted?: boolean; termsAcceptedOn?: string; registeredOn?: string;
  };
}

const PAY: Record<string, string> = { monthly: 'Monthly salary', per_lecture: 'Per lecture', per_hour: 'Per hour', honorarium: 'Honorarium' };

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="py-2 grid grid-cols-3 gap-3 border-b border-slate-100 last:border-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="col-span-2 text-sm font-medium text-slate-900 break-words">{children || <span className="text-slate-300">-</span>}</dd>
  </div>
);

// What the principal wrote when the teacher joined (the registration form). Only the principal opens it. The identity number is hidden until it is shown.
export const TeacherDetailsModal: React.FC<{ teacher: AuthUser; onClose: () => void }> = ({ teacher, onClose }) => {
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [showId, setShowId] = useState(false);

  useEffect(() => {
    let alive = true;
    request<Details>('GET', `/users/${teacher.id}/details`)
      .then(d => alive && setData(d))
      .catch(err => alive && setError(err instanceof Error ? err.message : 'The details could not be loaded.'));
    return () => {
      alive = false;
    };
  }, [teacher.id]);

  const d = data?.details;
  const id = d?.idNumber ?? '';
  const idShown = !id ? '' : showId ? id.replace(/(.{4})/g, '$1 ').trim() : `${'X'.repeat(Math.max(0, id.length - 4))}${id.slice(-4)}`.replace(/(.{4})/g, '$1 ').trim();
  const address = d?.address ? [d.address.line, d.address.district, d.address.state, d.address.pin].filter(Boolean).join(', ') : '';
  const degrees = d?.qualifications?.length ? d.qualifications : d?.qualification ? [d.qualification] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{teacher.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Teacher details (the registration form)</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto overscroll-contain">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!data && !error && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </p>
          )}
          {data && !d && <p className="text-sm text-slate-500">This teacher was added without the registration form, so there are no more details than the name, the email, the mobile number and the subject.</p>}
          {data && (
            <dl>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-700 pb-1.5 border-b border-slate-200">Registration</h3>
              <Row label="Date of registration">{formatDate(d?.registeredOn || data.createdAt)}</Row>
              <Row label="Rules and regulations">
                {data.rulesAcceptedAt ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Agreed by the teacher on {formatDate(data.rulesAcceptedAt)}
                  </span>
                ) : d?.termsAccepted ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700">
                    <Clock className="w-4 h-4" />
                    Sent by email. The teacher has not agreed yet (the teacher agrees at the first sign in).
                  </span>
                ) : (
                  ''
                )}
              </Row>
              {d?.termsAccepted && <Row label="Ticked by the principal">{formatDate(d.termsAcceptedOn)}</Row>}

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-700 pt-4 pb-1.5 border-b border-slate-200">Personal &amp; contact</h3>
              <Row label="Name">{[d?.firstName, d?.middleName, d?.lastName].filter(Boolean).join(' ') || data.name}</Row>
              <Row label="Guardian / family name">{d?.guardianName}</Row>
              <Row label="Email">{data.email}</Row>
              <Row label="Primary contact number">{data.phone}</Row>
              <Row label="Alternate contact number">{d?.alternatePhone ? `${d.countryCode ?? ''} ${d.alternatePhone}`.trim() : ''}</Row>
              <Row label="Country">{d?.country}</Row>
              <Row label="Date of birth">{d?.dateOfBirth ? formatDate(d.dateOfBirth) : ''}</Row>
              <Row label="Address">{address}</Row>
              <Row label={d?.idType === 'Aadhaar' ? 'Aadhaar number' : 'Government ID'}>
                {id && (
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono">{idShown}</span>
                    <button type="button" onClick={() => setShowId(v => !v)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                      {showId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showId ? 'Hide' : 'Show'}
                    </button>
                  </span>
                )}
              </Row>

              {d?.idImage && (
                <Row label="Photo of the ID">
                  {showId ? (
                    <img src={d.idImage} alt="Photo of the ID" className="max-h-64 w-auto rounded-md border border-slate-300 bg-white" />
                  ) : (
                    <span className="text-xs text-slate-500">Hidden. Press Show above to see it.</span>
                  )}
                </Row>
              )}

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-700 pt-4 pb-1.5 border-b border-slate-200">Academic &amp; professional</h3>
              <Row label="Degrees">{degrees.join(', ')}</Row>
              <Row label="Subject">{data.subject}</Row>
              <Row label="Previous work">{d?.workHistory}</Row>

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-700 pt-4 pb-1.5 border-b border-slate-200">Agreement &amp; terms</h3>
              <Row label="Pay">{d?.payType ? `${PAY[d.payType] ?? d.payType}${d.payAmount != null ? ` - ${d.payAmount.toLocaleString('en-IN')}` : ''}` : ''}</Row>
              <Row label="Other terms &amp; notes">{d?.payNotes}</Row>
            </dl>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
