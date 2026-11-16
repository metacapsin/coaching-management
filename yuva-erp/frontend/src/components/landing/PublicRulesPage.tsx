import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { RulesText } from '../views/RulesView';

// The rules and regulations of one coaching, open to anybody (a teacher who wants to join reads them before calling the principal).
export const PublicRulesPage: React.FC<{ orgId: string }> = ({ orgId }) => (
  <div className="min-h-screen bg-slate-50 py-8 px-4">
    <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
      <RulesText publicOrgId={orgId} />
      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-center">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AcademiaOS
        </a>
      </div>
    </div>
  </div>
);
