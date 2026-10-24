import React, { useState, useEffect } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { Settings, Building2, Save, Download, Upload, RefreshCw, Check, Database } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    profile, 
    updateProfile, 
    resetToDemoData, 
    exportDatabaseJson, 
    importDatabaseJson 
  } = useInstitute();

  const [formData, setFormData] = useState(profile);

  // Keep the form in step with the saved profile (after a reset or a restore from backup)
  useEffect(() => {
    setFormData(profile);
  }, [profile]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Restoring a backup replaces all current institute records. Continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ok = importDatabaseJson(content);
      if (ok) {
        setImportStatus('Database successfully restored from JSON backup!');
      } else {
        setImportStatus('Failed to import database: Invalid schema format.');
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-slate-800 text-white">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Institute Settings & Data Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure institute profile, official receipt letterhead, academic session, currency symbol, and database backup/restore.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Profile Form */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Institute Profile & Official Voucher Letterhead
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Institute Legal / Trade Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tagline / Mission Statement</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Registration / Accreditation Number</label>
              <input
                type="text"
                value={formData.registrationNo}
                onChange={e => setFormData({ ...formData, registrationNo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Academic Session Year</label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Billing Currency Symbol</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={e => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Signatory Title</label>
              <input
                type="text"
                value={formData.signatoryTitle}
                onChange={e => setFormData({ ...formData, signatoryTitle: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Campus Physical Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Website</label>
              <input
                type="text"
                value={formData.website}
                onChange={e => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Official Front-Desk Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Admissions Inquiries Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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

        {/* Right 1 Col: Backup & Restore */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Data Backup & Portability
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Export your entire coaching institute database including student records, batch schedules, attendance histories, and fee transactions.
            </p>

            <button
              type="button"
              onClick={exportDatabaseJson}
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-blue-600" />
              Download JSON Database Backup
            </button>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Restore from JSON File
              </label>
              <label className="w-full px-3.5 py-2.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-slate-500" />
                Select .json backup file
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {importStatus && (
              <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                {importStatus}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-600 border-b border-slate-100 pb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset Demo Sandbox
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Reset all student enrollments, batches, attendance logs, and fee records to the pristine default demonstration state.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all institute records back to default sample data?')) {
                  resetToDemoData();
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            >
              Reset to Sample Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
