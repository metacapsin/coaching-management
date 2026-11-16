import React from 'react';
import { RulesText } from '../views/RulesView';

// The rules and regulations of one coaching, open to anybody (a teacher who wants to join reads them before calling the principal).
export const PublicRulesPage: React.FC<{ orgId: string }> = ({ orgId }) => (
  <div className="min-h-screen bg-slate-50 py-8 px-4">
    <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
      <RulesText publicOrgId={orgId} />
      <a href="/" className="inline-block mt-6 text-sm text-blue-600 hover:underline">
        Back to the website
      </a>
    </div>
  </div>
);
