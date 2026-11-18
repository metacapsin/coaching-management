import React from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';

// The signature of the principal on a receipt, an admit card or a result sheet: the NAME written as text in a handwriting style, with the title under it
// (no pen is needed). The name is the one in the Institute Profile ("Signature name"); when it is empty, the name of the principal who made the document.
export const useSignatoryName = (issuedBy?: string): string => {
  const { profile } = useInstitute();
  const { user } = useAuth();
  return (profile.signatoryName || '').trim() || (issuedBy || '').trim() || (user?.role === 'admin' ? user.name : '');
};

const HAND = "'Segoe Script','Lucida Handwriting','Brush Script MT','Apple Chancery',cursive";

export const TypedSignature: React.FC<{ name: string; title: string; institute?: string; className?: string }> = ({ name, title, institute, className = '' }) => (
  <div className={`inline-block text-center min-w-[10rem] ${className}`}>
    <div style={{ fontFamily: HAND }} className="text-xl text-slate-800 leading-tight px-2 pb-1 border-b border-slate-400 min-h-[2rem]">
      {name}
    </div>
    <p className="mt-1 text-[11px] font-semibold text-slate-900">{title}</p>
    {institute && <p className="text-[11px] text-slate-400">{institute}</p>}
  </div>
);
