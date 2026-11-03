import React from 'react';

// Shown at the top of a form that cannot work yet because something it needs has not been written down
export const NeedFirst: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{children}</p>
  </div>
);
