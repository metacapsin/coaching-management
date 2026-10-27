import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import type { Book, HostelRoom, Student, TransportRoute } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { formatDate, formatINR, toLocalISODate } from '../utils/helpers';
import { Library, Bus, BedDouble, Plus, Pencil, Trash2, Check, Search, X, Undo2, AlertTriangle } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const primaryBtn = 'px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5';
const smallBtn = 'px-2.5 py-1 text-[11px] font-semibold rounded-md';

const addDays = (iso: string, days: number) => toLocalISODate(new Date(new Date(`${iso}T00:00:00`).getTime() + days * 86400000));

const nameOf = (students: Student[], id: string) => {
  const s = students.find(x => x.id === id);
  return s ? `${s.name} (${s.rollNo})` : 'Removed student';
};

const SaveBar: React.FC<{ onClose: () => void; label?: string }> = ({ onClose, label = 'Save' }) => (
  <div className="flex justify-end gap-2 pt-2">
    <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
      Cancel
    </button>
    <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
      <Check className="w-4 h-4" />
      {label}
    </button>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
    {children}
  </div>
);

const ConfirmDelete: React.FC<{ title: string; text: string; onCancel: () => void; onConfirm: () => void }> = ({ title, text, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-600 mt-2">{text}</p>
      <div className="pt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg">
          Delete
        </button>
      </div>
    </div>
  </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'plain' | 'warn' }> = ({ label, value, tone = 'plain' }) => (
  <div className={`bg-white rounded-xl border p-4 shadow-xs ${tone === 'warn' ? 'border-amber-300' : 'border-slate-200'}`}>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-2xl font-bold font-mono mt-1 text-slate-900">{value}</div>
  </div>
);

// ---------------------------------------------------------------- library

const activeLoans = (book: Book) => book.issues.filter(i => !i.returnedOn);

const BookModal: React.FC<{ book: Book | null; onClose: () => void }> = ({ book, onClose }) => {
  const { addBook, updateBook } = useInstitute();
  const [form, setForm] = useState({ title: book?.title ?? '', author: book?.author ?? '', category: book?.category ?? '', copies: String(book?.copies ?? 1) });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const copies = Math.floor(Number(form.copies));
    if (!form.title.trim()) return setError('Enter the title of the book.');
    if (!Number.isFinite(copies) || copies < 1) return setError('The library needs at least 1 copy.');
    if (book && copies < activeLoans(book).length) return setError(`${activeLoans(book).length} copies are on loan right now: the copies cannot be fewer.`);
    const data = { title: form.title.trim(), author: form.author.trim(), category: form.category.trim() || 'General', copies };
    if (book) updateBook(book.id, data);
    else addBook(data);
    onClose();
  };

  return (
    <ModalShell title={book ? 'Edit book' : 'Add a book'} icon={Library} iconClass="bg-indigo-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Title">
              <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="Author">
            <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Subject / category">
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} placeholder="Physics" />
          </Field>
          <Field label="Copies the library owns">
            <input type="number" min="1" value={form.copies} onChange={e => setForm({ ...form, copies: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <SaveBar onClose={onClose} />
      </form>
    </ModalShell>
  );
};

const IssueModal: React.FC<{ book: Book; onClose: () => void }> = ({ book, onClose }) => {
  const { students, updateBook } = useInstitute();
  const today = toLocalISODate();
  const people = students.filter(s => s.status !== 'inactive');
  const [studentId, setStudentId] = useState('');
  const [dueOn, setDueOn] = useState(addDays(today, 14));
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return setError('Choose the student.');
    if (dueOn < today) return setError('The return date cannot be in the past.');
    if (activeLoans(book).length >= book.copies) return setError('All copies are on loan.');
    if (activeLoans(book).some(i => i.studentId === studentId)) return setError('This student already has this book.');
    updateBook(book.id, { issues: [...book.issues, { id: `bi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, studentId, issuedOn: today, dueOn }] });
    onClose();
  };

  return (
    <ModalShell title={`Issue: ${book.title}`} icon={Library} iconClass="bg-indigo-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <Field label="Student">
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Choose a student</option>
            {people.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.rollNo})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Return by">
          <input type="date" value={dueOn} min={today} onChange={e => setDueOn(e.target.value)} className={inputCls} />
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <SaveBar onClose={onClose} label="Issue the book" />
      </form>
    </ModalShell>
  );
};

const LoansModal: React.FC<{ bookId: string; onClose: () => void }> = ({ bookId, onClose }) => {
  const { books, students, updateBook } = useInstitute();
  const book = books.find(b => b.id === bookId);
  const today = toLocalISODate();
  if (!book) return null;
  const sorted = [...book.issues].sort((a, b) => Number(!!a.returnedOn) - Number(!!b.returnedOn) || b.issuedOn.localeCompare(a.issuedOn));

  return (
    <ModalShell title={`Loans: ${book.title}`} icon={Library} iconClass="bg-indigo-600" width="lg" onClose={onClose}>
      <div className="p-6">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Nobody has borrowed this book yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Issued</th>
                  <th className="p-3">Return by</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(i => {
                  const late = !i.returnedOn && i.dueOn < today;
                  return (
                    <tr key={i.id}>
                      <td className="p-3 font-medium text-slate-900">{nameOf(students, i.studentId)}</td>
                      <td className="p-3 text-slate-600">{formatDate(i.issuedOn)}</td>
                      <td className="p-3 text-slate-600">{formatDate(i.dueOn)}</td>
                      <td className="p-3">
                        {i.returnedOn ? (
                          <span className="text-emerald-700">Returned {formatDate(i.returnedOn)}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {late && <span className="text-rose-600 font-semibold">Overdue</span>}
                            <button
                              onClick={() => updateBook(book.id, { issues: book.issues.map(x => (x.id === i.id ? { ...x, returnedOn: today } : x)) })}
                              className={`${smallBtn} text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1`}
                            >
                              <Undo2 className="w-3 h-3" />
                              Mark returned
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

const LibraryPanel: React.FC = () => {
  const { books, deleteBook } = useInstitute();
  const today = toLocalISODate();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ book: Book | null } | null>(null);
  const [issuing, setIssuing] = useState<Book | null>(null);
  const [loansFor, setLoansFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);

  const q = search.trim().toLowerCase();
  const shown = books.filter(b => !q || `${b.title} ${b.author} ${b.category}`.toLowerCase().includes(q));
  const copies = books.reduce((n, b) => n + b.copies, 0);
  const onLoan = books.reduce((n, b) => n + activeLoans(b).length, 0);
  const overdue = books.reduce((n, b) => n + activeLoans(b).filter(i => i.dueOn < today).length, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Titles" value={books.length} />
        <Stat label="Copies" value={copies} />
        <Stat label="On loan" value={onLoan} />
        <Stat label="Overdue" value={overdue} tone={overdue > 0 ? 'warn' : 'plain'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, author, subject..." className={`${inputCls} pl-9`} />
        </div>
        <button onClick={() => setEditing({ book: null })} className={`${primaryBtn} self-start`}>
          <Plus className="w-4 h-4" />
          Add book
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {shown.length === 0 ? (
          <div className="py-14 text-center">
            <Library className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">{books.length === 0 ? 'No books yet' : 'No book matches the search'}</p>
            {books.length === 0 && <p className="text-xs text-slate-400 mt-1">Press Add book to start the library list.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Book</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Available</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(b => {
                  const loans = activeLoans(b);
                  const late = loans.filter(i => i.dueOn < today).length;
                  const free = b.copies - loans.length;
                  return (
                    <tr key={b.id} className="align-middle">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{b.title}</div>
                        <div className="text-[11px] text-slate-500">{b.author}</div>
                      </td>
                      <td className="p-3.5 text-slate-600">{b.category}</td>
                      <td className="p-3.5">
                        <span className={`font-mono font-semibold ${free === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {free} of {b.copies}
                        </span>
                        {late > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            {late} overdue
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button disabled={free === 0} onClick={() => setIssuing(b)} className={`${smallBtn} text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40`}>
                            Issue
                          </button>
                          <button onClick={() => setLoansFor(b.id)} className={`${smallBtn} text-slate-700 bg-slate-100 hover:bg-slate-200`}>
                            Loans ({loans.length})
                          </button>
                          <button title="Edit" onClick={() => setEditing({ book: b })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button title="Delete" onClick={() => setDeleteTarget(b)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <BookModal book={editing.book} onClose={() => setEditing(null)} />}
      {issuing && <IssueModal book={issuing} onClose={() => setIssuing(null)} />}
      {loansFor && <LoansModal bookId={loansFor} onClose={() => setLoansFor(null)} />}
      {deleteTarget && (
        <ConfirmDelete
          title="Delete this book?"
          text={
            activeLoans(deleteTarget).length > 0
              ? `${deleteTarget.title} is on loan (${activeLoans(deleteTarget).length}). Deleting it also deletes the loan records.`
              : `${deleteTarget.title} and its loan history are deleted.`
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteBook(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------- shared: the people list of a route or a room

const PeopleList: React.FC<{
  ids: string[];
  students: Student[];
  candidates: Student[];
  full: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ ids, students, candidates, full, onAdd, onRemove }) => {
  const [pick, setPick] = useState('');
  return (
    <div className="mt-3 space-y-2">
      {ids.length === 0 ? (
        <p className="text-[11px] text-slate-400">Nobody yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {ids.map(id => (
            <li key={id} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 rounded-full pl-2.5 pr-1 py-0.5">
              {nameOf(students, id)}
              <button title="Remove" onClick={() => onRemove(id)} className="p-0.5 rounded-full hover:bg-slate-200 text-slate-500">
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-[11px] text-amber-700">Full: no seat or bed is free.</p>
      ) : (
        <div className="flex gap-2">
          <select value={pick} onChange={e => setPick(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
            <option value="">Add a student...</option>
            {candidates.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.rollNo})
              </option>
            ))}
          </select>
          <button
            disabled={!pick}
            onClick={() => {
              onAdd(pick);
              setPick('');
            }}
            className={`${smallBtn} text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40`}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- transport

const RouteModal: React.FC<{ route: TransportRoute | null; onClose: () => void }> = ({ route, onClose }) => {
  const { addTransportRoute, updateTransportRoute, profile } = useInstitute();
  const [form, setForm] = useState({
    name: route?.name ?? '',
    vehicleNo: route?.vehicleNo ?? '',
    driverName: route?.driverName ?? '',
    driverPhone: route?.driverPhone ?? '',
    stops: route?.stops ?? '',
    capacity: String(route?.capacity ?? 30),
    monthlyFee: String(route?.monthlyFee ?? '')
  });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = Math.floor(Number(form.capacity));
    const fee = Number(form.monthlyFee || 0);
    if (!form.name.trim()) return setError('Enter the name of the route.');
    if (!Number.isFinite(capacity) || capacity < 1) return setError('Enter the number of seats.');
    if (route && capacity < route.studentIds.length) return setError(`${route.studentIds.length} students use this route: the seats cannot be fewer.`);
    if (!Number.isFinite(fee) || fee < 0) return setError('The monthly fee cannot be negative.');
    const data = {
      name: form.name.trim(),
      vehicleNo: form.vehicleNo.trim(),
      driverName: form.driverName.trim(),
      driverPhone: form.driverPhone.trim(),
      stops: form.stops.trim(),
      capacity,
      monthlyFee: fee
    };
    if (route) updateTransportRoute(route.id, data);
    else addTransportRoute({ ...data, studentIds: [] });
    onClose();
  };

  return (
    <ModalShell title={route ? 'Edit route' : 'Add a bus route'} icon={Bus} iconClass="bg-emerald-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Route name">
              <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Route 1: Station to Institute" />
            </Field>
          </div>
          <Field label="Vehicle number">
            <input value={form.vehicleNo} onChange={e => setForm({ ...form, vehicleNo: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Seats">
            <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Driver">
            <input value={form.driverName} onChange={e => setForm({ ...form, driverName: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Driver phone">
            <input value={form.driverPhone} onChange={e => setForm({ ...form, driverPhone: e.target.value })} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Stops (in order)">
              <input value={form.stops} onChange={e => setForm({ ...form, stops: e.target.value })} className={inputCls} placeholder="Station, Market, Institute" />
            </Field>
          </div>
          <Field label={`Monthly fee per student (${profile.currencySymbol})`}>
            <input type="number" min="0" value={form.monthlyFee} onChange={e => setForm({ ...form, monthlyFee: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <SaveBar onClose={onClose} />
      </form>
    </ModalShell>
  );
};

const TransportPanel: React.FC = () => {
  const { transportRoutes, students, profile, updateTransportRoute, deleteTransportRoute } = useInstitute();
  const cur = profile.currencySymbol;
  const [editing, setEditing] = useState<{ route: TransportRoute | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransportRoute | null>(null);

  const alive = new Set(students.map(s => s.id));
  const used = new Set(transportRoutes.flatMap(r => r.studentIds));
  const candidates = students.filter(s => s.status !== 'inactive' && !used.has(s.id));
  const riders = transportRoutes.reduce((n, r) => n + r.studentIds.filter(id => alive.has(id)).length, 0);
  const monthly = transportRoutes.reduce((n, r) => n + r.studentIds.filter(id => alive.has(id)).length * r.monthlyFee, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Routes" value={transportRoutes.length} />
        <Stat label="Students using the bus" value={riders} />
        <Stat label="Seats" value={transportRoutes.reduce((n, r) => n + r.capacity, 0)} />
        <Stat
          label="Bus fee every month"
          value={
            <>
              {cur}
              {formatINR(monthly)}
            </>
          }
        />
      </div>

      <div className="flex justify-end">
        <button onClick={() => setEditing({ route: null })} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          Add route
        </button>
      </div>

      {transportRoutes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center shadow-xs">
          <Bus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No bus route yet</p>
          <p className="text-xs text-slate-400 mt-1">Press Add route, then add the students who use it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {transportRoutes.map(r => {
            const ids = r.studentIds.filter(id => alive.has(id));
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{r.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {r.vehicleNo || 'Vehicle number not written'} · {r.driverName || 'Driver not written'}
                      {r.driverPhone ? ` (${r.driverPhone})` : ''}
                    </p>
                    {r.stops && <p className="text-[11px] text-slate-500 mt-0.5">Stops: {r.stops}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button title="Edit" onClick={() => setEditing({ route: r })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button title="Delete" onClick={() => setDeleteTarget(r)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-600 flex gap-4">
                  <span>
                    Seats: <strong className="font-mono">{ids.length}/{r.capacity}</strong>
                  </span>
                  <span>
                    Fee: <strong className="font-mono">{cur}{formatINR(r.monthlyFee)}</strong> a month
                  </span>
                </div>
                <PeopleList
                  ids={ids}
                  students={students}
                  candidates={candidates}
                  full={ids.length >= r.capacity}
                  onAdd={id => updateTransportRoute(r.id, { studentIds: [...r.studentIds, id] })}
                  onRemove={id => updateTransportRoute(r.id, { studentIds: r.studentIds.filter(x => x !== id) })}
                />
              </div>
            );
          })}
        </div>
      )}

      {editing && <RouteModal route={editing.route} onClose={() => setEditing(null)} />}
      {deleteTarget && (
        <ConfirmDelete
          title="Delete this route?"
          text={`${deleteTarget.name} is deleted. The students on it stay in the institute, they just have no bus route.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteTransportRoute(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------- hostel

const RoomModal: React.FC<{ room: HostelRoom | null; onClose: () => void }> = ({ room, onClose }) => {
  const { addHostelRoom, updateHostelRoom, profile } = useInstitute();
  const [form, setForm] = useState({
    name: room?.name ?? '',
    block: room?.block ?? '',
    capacity: String(room?.capacity ?? 3),
    monthlyRent: String(room?.monthlyRent ?? '')
  });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = Math.floor(Number(form.capacity));
    const rent = Number(form.monthlyRent || 0);
    if (!form.name.trim()) return setError('Enter the room number.');
    if (!Number.isFinite(capacity) || capacity < 1) return setError('Enter the number of beds.');
    if (room && capacity < room.studentIds.length) return setError(`${room.studentIds.length} students stay in this room: the beds cannot be fewer.`);
    if (!Number.isFinite(rent) || rent < 0) return setError('The rent cannot be negative.');
    const data = { name: form.name.trim(), block: form.block.trim() || 'Main block', capacity, monthlyRent: rent };
    if (room) updateHostelRoom(room.id, data);
    else addHostelRoom({ ...data, studentIds: [] });
    onClose();
  };

  return (
    <ModalShell title={room ? 'Edit room' : 'Add a hostel room'} icon={BedDouble} iconClass="bg-violet-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Room number">
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="A-101" />
          </Field>
          <Field label="Block">
            <input value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} className={inputCls} placeholder="Boys Block A" />
          </Field>
          <Field label="Beds">
            <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className={inputCls} />
          </Field>
          <Field label={`Monthly rent per bed (${profile.currencySymbol})`}>
            <input type="number" min="0" value={form.monthlyRent} onChange={e => setForm({ ...form, monthlyRent: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <SaveBar onClose={onClose} />
      </form>
    </ModalShell>
  );
};

const HostelPanel: React.FC = () => {
  const { hostelRooms, students, profile, updateHostelRoom, deleteHostelRoom } = useInstitute();
  const cur = profile.currencySymbol;
  const [editing, setEditing] = useState<{ room: HostelRoom | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HostelRoom | null>(null);

  const alive = new Set(students.map(s => s.id));
  const used = new Set(hostelRooms.flatMap(r => r.studentIds));
  const candidates = students.filter(s => s.status !== 'inactive' && !used.has(s.id));
  const beds = hostelRooms.reduce((n, r) => n + r.capacity, 0);
  const taken = hostelRooms.reduce((n, r) => n + r.studentIds.filter(id => alive.has(id)).length, 0);
  const rent = hostelRooms.reduce((n, r) => n + r.studentIds.filter(id => alive.has(id)).length * r.monthlyRent, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Rooms" value={hostelRooms.length} />
        <Stat label="Beds" value={beds} />
        <Stat label="Beds in use" value={`${taken}/${beds}`} />
        <Stat
          label="Rent every month"
          value={
            <>
              {cur}
              {formatINR(rent)}
            </>
          }
        />
      </div>

      <div className="flex justify-end">
        <button onClick={() => setEditing({ room: null })} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          Add room
        </button>
      </div>

      {hostelRooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center shadow-xs">
          <BedDouble className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No hostel room yet</p>
          <p className="text-xs text-slate-400 mt-1">Press Add room, then put the students into it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {hostelRooms.map(r => {
            const ids = r.studentIds.filter(id => alive.has(id));
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Room {r.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.block}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button title="Edit" onClick={() => setEditing({ room: r })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button title="Delete" onClick={() => setDeleteTarget(r)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-600 flex gap-4">
                  <span>
                    Beds: <strong className="font-mono">{ids.length}/{r.capacity}</strong>
                  </span>
                  <span>
                    Rent: <strong className="font-mono">{cur}{formatINR(r.monthlyRent)}</strong> per bed
                  </span>
                </div>
                <PeopleList
                  ids={ids}
                  students={students}
                  candidates={candidates}
                  full={ids.length >= r.capacity}
                  onAdd={id => updateHostelRoom(r.id, { studentIds: [...r.studentIds, id] })}
                  onRemove={id => updateHostelRoom(r.id, { studentIds: r.studentIds.filter(x => x !== id) })}
                />
              </div>
            );
          })}
        </div>
      )}

      {editing && <RoomModal room={editing.room} onClose={() => setEditing(null)} />}
      {deleteTarget && (
        <ConfirmDelete
          title="Delete this room?"
          text={`Room ${deleteTarget.name} is deleted. The students in it stay in the institute, they just have no room.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteHostelRoom(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------- the page

type Tab = 'library' | 'transport' | 'hostel';

export const FacilitiesView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('library');
  const tabs: { id: Tab; label: string; icon: typeof Library }[] = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'transport', label: 'Transport', icon: Bus },
    { id: 'hostel', label: 'Hostel', icon: BedDouble }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">Library, Transport and Hostel</h2>
        <p className="text-xs text-slate-500 mt-1">
          Books and who borrowed them, bus routes with the students who ride, and hostel rooms with the students who stay. Only the principal and the
          front desk see this page.
        </p>
        <div className="mt-4 inline-flex bg-slate-100 rounded-lg p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'library' && <LibraryPanel />}
      {tab === 'transport' && <TransportPanel />}
      {tab === 'hostel' && <HostelPanel />}
    </div>
  );
};
