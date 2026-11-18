import { buildTablePdf, type PdfTable } from './simplePdf';
import { formatDate } from './helpers';
import type { FeeTransaction, PaymentMethod, Student } from '../../types';

// How the parent paid the fee: online (UPI, bank transfer, card) or offline (cash, cheque). The words that the principal and the parent read.
export const PAYMENT_MODES: { value: PaymentMethod; label: string; online: boolean }[] = [
  { value: 'UPI', label: 'Online - UPI (GPay / PhonePe / Paytm)', online: true },
  { value: 'Bank Transfer', label: 'Online - Bank transfer / NEFT / IMPS', online: true },
  { value: 'Card', label: 'Online - Debit / Credit card', online: true },
  { value: 'Cash', label: 'Offline - Cash (at the counter)', online: false },
  { value: 'Cheque', label: 'Offline - Cheque', online: false }
];

export const modeText = (method: PaymentMethod): string => {
  const m = PAYMENT_MODES.find(x => x.value === method);
  return m ? `${method} (${m.online ? 'online' : 'offline'})` : String(method);
};

// The receipt as a PDF: the same branded page as the reports (the logo and the name of AcademiaOS on top). Only the Latin letters can be written in this PDF,
// so the rupee sign is written "Rs.".
export function receiptTable(tx: FeeTransaction, student: Student | undefined, coaching: string, balanceDue: number, signatory?: { name: string; title: string }): PdfTable {
  const rs = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
  const net = student ? Math.max(0, student.totalFees - student.discount) : 0;
  const rows: (string | number)[][] = [
    ['Receipt no', tx.receiptNo],
    ['Date received', formatDate(tx.date)],
    ['Student', `${tx.studentName} (roll no ${tx.studentRollNo})`],
    ['Batch', tx.batchName || '-'],
    ['Paid by (parent)', student?.parentName || '-'],
    ['Payment mode', modeText(tx.paymentMethod)],
    ['Reference', tx.referenceNo || '-'],
    ['Installment', `#${tx.installmentNo}`],
    ...(tx.notes ? ([['Notes', tx.notes]] as (string | number)[][]) : []),
    ['Total net fee', rs(net)],
    ['Balance due after this payment', rs(balanceDue)],
    ...(signatory?.name ? ([['Signed by', `${signatory.name}${signatory.title ? `, ${signatory.title}` : ''}`]] as (string | number)[][]) : [])
  ];
  return {
    title: `Fee receipt ${tx.receiptNo}`,
    subtitle: `${coaching} - ${formatDate(tx.date)}`,
    headers: ['Detail', 'Value'],
    rows,
    weights: [1, 2.4],
    summary: [
      { label: 'Amount received', value: rs(tx.amount) },
      { label: 'Paid by', value: modeText(tx.paymentMethod) },
      { label: 'Balance due', value: rs(balanceDue) }
    ],
    footer: `Thank you. This receipt is for the fee received by ${coaching}.`
  };
}

export const receiptPdfBytes = (tx: FeeTransaction, student: Student | undefined, coaching: string, balanceDue: number, signatory?: { name: string; title: string }): Uint8Array =>
  buildTablePdf(receiptTable(tx, student, coaching, balanceDue, signatory));

// The receipt as a WhatsApp message (the details in words; the PDF can be attached by hand)
export const receiptWhatsAppMessage = (tx: FeeTransaction, studentRoll: string, coaching: string, currency: string, balanceDue: number): string =>
  `Official Fee Receipt: ${coaching}\nReceipt No: ${tx.receiptNo}\nDate: ${tx.date}\nStudent: ${tx.studentName} (${studentRoll})\nBatch: ${tx.batchName}\nAmount Paid: ${currency}${tx.amount.toLocaleString()} via ${tx.paymentMethod}\nOutstanding Balance: ${currency}${balanceDue.toLocaleString()}\nThank you for choosing ${coaching}.`;

// The bytes of the PDF as base64 text (to send them to the server)
export const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
};
