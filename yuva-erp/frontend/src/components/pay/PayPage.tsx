import React from 'react';
import { BadgeIndianRupee, Copy, Smartphone } from 'lucide-react';
import { isUpiId } from '../utils/helpers';

// The page a parent opens from a fee notice (/pay?pa=<upi id>&pn=<coaching>&am=<amount>&sn=<student>). No sign in: it only
// shows what is to be paid and has one button that opens the UPI app (GPay, PhonePe, Paytm...) with everything written.
// The money goes straight to the coaching; the office writes the payment in the Fees page when it arrives.
export const PayPage: React.FC = () => {
  const q = new URLSearchParams(window.location.search);
  const pa = (q.get('pa') || '').trim();
  const pn = (q.get('pn') || '').trim();
  const amount = Number(q.get('am'));
  const student = (q.get('sn') || '').trim();
  const valid = isUpiId(pa) && Number.isFinite(amount) && amount > 0 && amount < 10_000_000;
  const upiLink = valid
    ? `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Fee ${student}`.trim())}`
    : '';
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the id stays visible to copy by hand */
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
          <BadgeIndianRupee className="w-6 h-6" />
        </div>
        {valid ? (
          <>
            <h1 className="text-lg font-bold text-slate-900 mt-4">{pn || 'Fee payment'}</h1>
            {student && <p className="text-sm text-slate-500 mt-1">Fee of {student}</p>}
            <p className="text-4xl font-extrabold text-slate-900 mt-5">₹{amount.toLocaleString('en-IN')}</p>
            <a
              href={upiLink}
              className="mt-6 flex items-center justify-center gap-2 w-full py-3 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <Smartphone className="w-5 h-5" />
              Pay ₹{amount.toLocaleString('en-IN')} now
            </a>
            <p className="text-xs text-slate-500 mt-3">Opens your UPI app (GPay, PhonePe, Paytm...) with the amount already filled.</p>
            <div className="mt-5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-left">
              <p className="text-[11px] text-slate-500">Pay by hand to this UPI id</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="font-mono text-sm text-slate-900 break-all">{pa}</span>
                <button type="button" onClick={copy} className="shrink-0 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md flex items-center gap-1">
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">Open this page on your phone. After you pay, the office writes your payment and gives you a receipt.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900 mt-4">This payment link is not complete</h1>
            <p className="text-sm text-slate-500 mt-2">Please ask the office to send the fee notice again.</p>
          </>
        )}
      </div>
    </div>
  );
};
