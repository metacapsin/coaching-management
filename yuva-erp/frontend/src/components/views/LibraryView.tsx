import { Select } from '../ui/Pickers';
import React, { useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { canManageInstitute } from '../../Context/Access';
import type { Book } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { Library, Plus, Pencil, Trash2, Check, Search, ExternalLink, BookOpen } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

// Only normal web links open (never javascript: or data: addresses)
const isWebLink = (url: string) => /^https?:\/\/\S+$/i.test(url.trim());

const BookModal: React.FC<{ book: Book | null; onClose: () => void }> = ({ book, onClose }) => {
  const { addBook, updateBook } = useInstitute();
  const [form, setForm] = useState({
    title: book?.title ?? '',
    author: book?.author ?? '',
    category: book?.category ?? '',
    description: book?.description ?? '',
    url: book?.url ?? ''
  });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Enter the title of the book.');
    if (!isWebLink(form.url)) return setError('Enter the link where the book can be read (it starts with https://).');
    const data = {
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category.trim() || 'General',
      description: form.description.trim() || undefined,
      url: form.url.trim()
    };
    if (book) updateBook(book.id, data);
    else addBook(data);
    onClose();
  };

  return (
    <ModalShell title={book ? 'Edit book' : 'Add a book'} icon={Library} iconClass="bg-indigo-600" width="md" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
            <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Author</label>
            <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject / category</label>
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} placeholder="Physics" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Link to read it (PDF, Google Drive, website)</label>
            <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputCls} placeholder="https://..." />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">About the book (optional)</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </div>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

// The library: books the institute shares to read online. Everybody reads; the principal adds and removes.
export const LibraryView: React.FC = () => {
  const { books, deleteBook } = useInstitute();
  const { user } = useAuth();
  const canManage = canManageInstitute(user?.role);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<{ book: Book | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);

  const categories = [...new Set(books.map(b => b.category).filter(Boolean))].sort();
  const q = search.trim().toLowerCase();
  const shown = books.filter(b => (!category || b.category === category) && (!q || `${b.title} ${b.author} ${b.category}`.toLowerCase().includes(q)));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Library className="w-5 h-5 text-indigo-600" />
            Library
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {canManage ? 'Add books with a link; students and teachers can open and read them online.' : 'Books shared by your institute. Press Read to open one.'}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setEditing({ book: null })}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 self-start"
          >
            <Plus className="w-4 h-4" />
            Add book
          </button>
        )}
      </div>

      {books.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, author, subject..." className={`${inputCls} pl-9`} />
          </div>
          <Select value={category} onChange={e => setCategory(e.target.value)} className={`${inputCls} bg-white sm:w-56`}>
            <option value="">All subjects</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center shadow-xs">
          <Library className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">{books.length === 0 ? 'No books yet' : 'No book matches the search'}</p>
          {books.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">{canManage ? 'Press Add book to share the first one.' : 'Your institute has not added any book yet.'}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(b => (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{b.title}</h3>
                  {b.author && <p className="text-[11px] text-slate-500 mt-0.5">{b.author}</p>}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded shrink-0">{b.category}</span>
              </div>
              {b.description && <p className="text-xs text-slate-600 mt-3 line-clamp-3">{b.description}</p>}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                {b.url && isWebLink(b.url) ? (
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                ) : canManage ? (
                  <button
                    onClick={() => setEditing({ book: b })}
                    title="This book has no link yet: add the link to let everybody read it"
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add link to read
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">No link added</span>
                )}
                {canManage && (
                  <div className="flex gap-1.5">
                    <button title="Edit" onClick={() => setEditing({ book: b })} className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button title="Delete" onClick={() => setDeleteTarget(b)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <BookModal book={editing.book} onClose={() => setEditing(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold">Delete this book?</h2>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{deleteTarget.title}</strong> is removed from the library. The students cannot open it anymore.
            </p>
            <div className="pt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteBook(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
