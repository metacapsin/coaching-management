import React, { useCallback, useEffect, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import {
  ApiError,
  createBackup,
  downloadFromServer,
  listBackups,
  refreshNow,
  restoreBackupFile,
  restoreStoredBackup
} from '../utils/api';
import type { StoredBackup } from '../utils/api';
import { formatDateTime } from '../utils/helpers';
import { resizeLogoToDataUrl } from '../utils/Imageutils';
import { Settings, Building2, Save, Download, Upload, RefreshCw, Check, Database, Trash2, History, AlertTriangle } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const PROFILE_FIELDS: { key: string; label: string; mono?: boolean; wide?: boolean; type?: string }[] = [
  { key: 'name', label: 'Institute Legal / Trade Name' },
  { key: 'tagline', label: 'Tagline / Mission Statement' },
  { key: 'registrationNo', label: 'Registration / Accreditation Number', mono: true },
  { key: 'academicYear', label: 'Academic Session Year' },
  { key: 'currencySymbol', label: 'Billing Currency Symbol', mono: true },
  { key: 'signatoryTitle', label: 'Signatory Title' },
  { key: 'address', label: 'Campus Physical Address', wide: true },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Official Front-Desk Phone' },
  { key: 'email', label: 'Admissions Inquiries Email', type: 'email' },
  { key: 'upiId', label: 'UPI ID to receive fees (the "Pay now" button of fee notices pays here)', mono: true, wide: true }
];

const formatSize = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const SettingsView: React.FC = () => {
  const { profile, updateProfile, resetToDemoData, clearAllData } = useInstitute();

  const [formData, setFormData] = useState(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<StoredBackup[]>([]);
  const [restoreFile, setRestoreFile] = useState<{ name: string; data: unknown } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ id?: string; label: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Keep the form in step with the saved profile (after a reset or a restore from backup)
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const flash = (type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await listBackups());
    } catch {
      /* the list stays empty; actions show their own errors */
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const run = async (job: () => Promise<void>, failText: string) => {
    setBusy(true);
    try {
      await job();
    } catch (err) {
      flash('error', err instanceof ApiError ? err.message : failText);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDownload = () =>
    run(async () => {
      await downloadFromServer('/backup', 'academiaos-backup.json');
      flash('ok', 'Backup file downloaded. It contains student data and accounts, so keep it safe.');
    }, 'Could not download the backup.');

  const handleBackupNow = () =>
    run(async () => {
      await createBackup('manual');
      await loadBackups();
      flash('ok', 'A backup was stored on the server.');
    }, 'Could not create the backup.');

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(String(ev.target?.result || ''));
        if (!data || typeof data !== 'object') throw new Error('bad');
        setRestoreFile({ name: file.name, data });
        setRestoreTarget({ label: file.name });
        setConfirmText('');
      } catch {
        flash('error', 'This file is not a valid AcademiaOS backup (.json).');
      }
    };
    reader.readAsText(file);
  };

  const doRestore = () => {
    if (!restoreTarget || confirmText !== 'RESTORE') return;
    const target = restoreTarget;
    const file = restoreFile;
    setRestoreTarget(null);
    setRestoreFile(null);
    void run(async () => {
      if (target.id) await restoreStoredBackup(target.id);
      else if (file) await restoreBackupFile(file.data);
      await refreshNow(true);
      await loadBackups();
      flash('ok', 'Backup restored. A safety copy of the previous data was stored first.');
    }, 'Could not restore the backup.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Institute Settings & Data Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Institute profile, receipt letterhead, academic session, currency and database backup / restore.
          </p>
        </div>

        <button
          onClick={handleSaveProfile}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          {saveSuccess ? 'Saved Changes!' : 'Save Configuration'}
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {message.type === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile form */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5 self-start">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Institute Profile & Official Voucher Letterhead
          </h3>

          <div className="flex items-center gap-4 p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60">
            {formData.logo ? (
              <img src={formData.logo} alt="Logo" className="w-16 h-16 object-contain bg-white rounded-lg border border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center text-2xl font-bold">
                {formData.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700">Logo of the coaching</p>
              <p className="text-[11px] text-slate-500">Shown in the side menu, on fee receipts and on report cards. Press Save after choosing it.</p>
              <div className="mt-2 flex gap-2">
                <label className="px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer">
                  {formData.logo ? 'Change logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) return flash('error', 'The picture is too big. Choose one below 3 MB.');
                      try {
                        setFormData({ ...formData, logo: await resizeLogoToDataUrl(file) });
                      } catch {
                        flash('error', 'This picture could not be read.');
                      }
                    }}
                  />
                </label>
                {formData.logo && (
                  <button type="button" onClick={() => setFormData({ ...formData, logo: undefined })} className="px-3 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer p-3 rounded-lg border border-slate-200 bg-slate-50/60">
            <input
              type="checkbox"
              checked={!!formData.autoFeeReminders}
              onChange={e => setFormData({ ...formData, autoFeeReminders: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <strong>Queue fee reminders by itself, once a day.</strong> When you open the app, a reminder for every fee that is past its due date
              goes to Parent Broadcasts, "Waiting to be sent". You press Send now on each one. Press Save after changing this.
            </span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROFILE_FIELDS.map(f => (
              <div key={f.key} className={f.wide ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-700 mb-1">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={(formData as unknown as Record<string, string>)[f.key] ?? ''}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  className={`${inputCls} ${f.mono ? 'font-mono' : ''}`}
                />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Update Institute Profile
            </button>
          </div>
        </form>

        {/* Backup & data */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Data Backup & Restore
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Everything (students, fees, attendance, exams, photos and login accounts) is saved as one file. The server also
              stores a backup automatically every day (last 14 are kept).
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={handleDownload}
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-blue-600" />
              Download Backup File
            </button>

            <label className="w-full px-3.5 py-2.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-slate-500" />
              Restore from backup file...
              <input type="file" accept=".json,application/json" onChange={handleFilePick} className="hidden" />
            </label>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Backups on the server
              </h3>
              <button
                type="button"
                disabled={busy}
                onClick={handleBackupNow}
                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 rounded-md transition-colors"
              >
                Backup now
              </button>
            </div>
            {backups.length === 0 ? (
              <p className="text-xs text-slate-400">No stored backup yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {backups.map(b => (
                  <li key={b.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-800">{formatDateTime(b.createdAt)}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {b.label || 'backup'} · {formatSize(b.size)}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        title="Download this backup"
                        onClick={() => run(() => downloadFromServer(`/backups/${b.id}`, `backup-${b.id}.json`), 'Download failed.')}
                        className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRestoreFile(null);
                          setRestoreTarget({ id: b.id, label: formatDateTime(b.createdAt) });
                          setConfirmText('');
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md"
                      >
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-rose-100 p-6 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-600 border-b border-slate-100 pb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Sample data & clean start
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fill the institute with demonstration data, or delete every student, fee, exam and message to start with an empty institute.
              Login accounts are not removed.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Replace all institute records with the default sample data?')) resetToDemoData();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
              >
                Reset to Sample Data
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClear(true);
                  setConfirmText('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete all data
              </button>
            </div>
          </div>
        </div>
      </div>

      {(restoreTarget || confirmClear) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-900">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              {confirmClear ? 'Delete all data?' : 'Restore this backup?'}
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              {confirmClear
                ? 'Every student, fee record, exam, attendance entry and message will be deleted. Download a backup first if you may need them.'
                : `All current records will be replaced with the backup "${restoreTarget?.label}". A safety copy of the current data is stored first.`}
            </p>
            <label className="block text-xs font-medium text-slate-700 mt-4 mb-1">
              Type <strong className="font-mono">{confirmClear ? 'DELETE' : 'RESTORE'}</strong> to continue
            </label>
            <input autoFocus value={confirmText} onChange={e => setConfirmText(e.target.value)} className={`${inputCls} font-mono`} />
            <div className="pt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRestoreTarget(null);
                  setRestoreFile(null);
                  setConfirmClear(false);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={confirmText !== (confirmClear ? 'DELETE' : 'RESTORE')}
                onClick={() => {
                  if (confirmClear) {
                    clearAllData();
                    setConfirmClear(false);
                    flash('ok', 'All institute data was deleted.');
                  } else doRestore();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-lg transition-colors"
              >
                {confirmClear ? 'Delete everything' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
