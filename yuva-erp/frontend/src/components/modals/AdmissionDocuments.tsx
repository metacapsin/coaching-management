import React, { useEffect, useRef, useState } from 'react';
import { FileText, Check, Plus, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { smallImage } from '../utils/smallImage';
import { addStudentDocument, flushPending, listStudentDocuments } from '../utils/api';
import type { StudentDocument } from '../utils/api';

// The documents a student who has passed the 10th class brings. Each one is a picture (a photo or a scan) that is made small before it is sent.
export const DOCUMENT_ROWS: { kind: string; label: string }[] = [
  { kind: 'aadhaar', label: 'Aadhaar card' },
  { kind: 'tc', label: 'Transfer certificate (TC)' },
  { kind: 'character', label: 'Character certificate' },
  { kind: 'migration', label: 'Migration certificate' },
  { kind: 'marksheet', label: '10th marksheet' }
];

// the classes whose students have passed the 10th class: they bring the documents
export const needsDocuments = (grade: string) => /^(Class 1[1-2]|Dropper)/i.test(grade.trim());

export interface PickedDocument {
  kind: string;
  label: string;
  image: string; // the small picture as a data address
  fileName: string;
}

export interface AdmissionDocumentsValue {
  fixed: Record<string, PickedDocument>;
  others: { id: number; label: string; doc?: PickedDocument }[];
}

export const noDocuments = (): AdmissionDocumentsValue => ({ fixed: {}, others: [] });

// Every student gives the Aadhaar card (a proof of identity, at any class). A student who has passed the 10th class brings the other documents too.
export const pickedDocuments = (v: AdmissionDocumentsValue, grade: string): PickedDocument[] => {
  const all = needsDocuments(grade);
  return [
    ...Object.values(v.fixed).filter(d => all || d.kind === 'aadhaar'),
    ...v.others.filter(o => o.doc).map(o => ({ ...(o.doc as PickedDocument), label: o.label.trim() || 'Other document' })) // (any class can add other documents, for example the leaving certificate of the old school)
  ];
};

// Sends the chosen documents once the student is saved on the server (the record may need a moment to arrive there).
export async function uploadAdmissionDocuments(studentId: string, docs: PickedDocument[]): Promise<{ saved: number; failed: string[] }> {
  let saved = 0;
  const failed: string[] = [];
  for (const d of docs) {
    let ok = false;
    for (let i = 0; i < 6 && !ok; i++) {
      try {
        await addStudentDocument(studentId, d.kind, d.image, d.label);
        ok = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (!/not found/i.test(message)) break; // another error: waiting does not help
        await flushPending();
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (ok) saved += 1;
    else failed.push(d.label);
  }
  return { saved, failed };
}

const pickBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg cursor-pointer transition-colors';

const FileButton: React.FC<{ label: string; onPick: (file: File) => void }> = ({ label, onPick }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className={pickBtn}>
        <Plus className="w-3.5 h-3.5" />
        {label}
      </button>
    </>
  );
};

const Picked: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 text-emerald-700 truncate max-w-[10rem]">
    <Check className="w-3.5 h-3.5 shrink-0" />
    <span className="truncate">{name}</span>
  </span>
);

// The form part: one row for each document and a way to add another one.
export const AdmissionDocuments: React.FC<{ value: AdmissionDocumentsValue; onChange: (v: AdmissionDocumentsValue) => void; grade: string }> = ({ value, onChange, grade }) => {
  const [error, setError] = useState('');
  const all = needsDocuments(grade); // (Class 9 and 10: the Aadhaar card and any other document that the student has)
  const rows = all ? DOCUMENT_ROWS : DOCUMENT_ROWS.filter(r => r.kind === 'aadhaar');

  const pick = async (file: File, make: (image: string) => AdmissionDocumentsValue) => {
    try {
      const image = await smallImage(file);
      setError('');
      onChange(make(image));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This picture could not be used.');
    }
  };

  return (
    <div className="md:col-span-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-slate-800">Documents of the student</p>
          <p className="text-[11px] text-slate-500">
            {all
              ? 'A student who has passed the 10th class brings these. Add a photo or a scan of each one (all are optional; they can be added later too). Only the principal can see them.'
              : 'Every student gives the Aadhaar card as a proof. A student from another school can add the transfer or leaving certificate, or any other document, with Add another document. Everything is optional and can be added later too. Only the principal can see them.'}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(row => {
          const doc = value.fixed[row.kind];
          return (
            <div key={row.kind} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-700 font-medium">{row.label}</span>
              <span className="flex items-center gap-2 min-w-0">
                {doc ? (
                  <>
                    <Picked name={doc.fileName} />
                    <button
                      type="button"
                      aria-label={`Remove ${row.label}`}
                      onClick={() => {
                        const fixed = { ...value.fixed };
                        delete fixed[row.kind];
                        onChange({ ...value, fixed });
                      }}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <FileButton
                    label="Upload"
                    onPick={f => void pick(f, image => ({ ...value, fixed: { ...value.fixed, [row.kind]: { kind: row.kind, label: row.label, image, fileName: f.name } } }))}
                  />
                )}
              </span>
            </div>
          );
        })}

        {value.others.map(o => (
          <div key={o.id} className="flex items-center justify-between gap-3 text-xs">
            <input
              value={o.label}
              onChange={e => onChange({ ...value, others: value.others.map(x => (x.id === o.id ? { ...x, label: e.target.value.slice(0, 60) } : x)) })}
              placeholder="Name of the document"
              className="w-44 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="flex items-center gap-2 min-w-0">
              {o.doc ? (
                <Picked name={o.doc.fileName} />
              ) : (
                <FileButton
                  label="Upload"
                  onPick={f =>
                    void pick(f, image => ({
                      ...value,
                      others: value.others.map(x => (x.id === o.id ? { ...x, doc: { kind: 'other', label: x.label, image, fileName: f.name } } : x))
                    }))
                  }
                />
              )}
              <button
                type="button"
                aria-label="Remove this document"
                onClick={() => onChange({ ...value, others: value.others.filter(x => x.id !== o.id) })}
                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...value, others: [...value.others, { id: Date.now(), label: '' }] })}
        className="mt-3 text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add another document
      </button>
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
    </div>
  );
};

// The saved documents of one student, for the principal (the Details window of the student).
export const StudentDocumentsList: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [docs, setDocs] = useState<StudentDocument[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    listStudentDocuments(studentId)
      .then(d => alive && setDocs(d))
      .catch(() => alive && setError('The documents could not be loaded.'));
    return () => {
      alive = false;
    };
  }, [studentId]);
  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!docs) {
    return (
      <p className="text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading the documents...
      </p>
    );
  }
  if (docs.length === 0) return <p className="text-xs text-slate-400">No document is added.</p>;
  return (
    <ul className="space-y-1.5">
      {docs.map(d => (
        <li key={d.url} className="flex items-center justify-between text-xs">
          <span className="text-slate-700">{d.label}</span>
          <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
            View
            <ExternalLink className="w-3 h-3" />
          </a>
        </li>
      ))}
    </ul>
  );
};
