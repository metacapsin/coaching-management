import React from 'react';
import QRCode from 'qrcode';
import { BadgeIndianRupee, Copy, QrCode, Smartphone } from 'lucide-react';
import { isUpiId } from '../utils/helpers';

// The page a parent opens from a fee notice (/pay?pa=<upi id>&pn=<coaching>&am=<amount>&sn=<student>). No sign in: it only
// shows what is to be paid and has one button that opens the UPI app (GPay, PhonePe, Paytm...) with everything written.
// The money goes straight to the coaching; the office writes the payment in the Fees page when it arrives.
// A UPI link only opens on a phone that has a UPI app. A computer has none, so nothing would happen: the page also shows a
// QR code (any UPI app can scan it, from the screen of the computer) and says so when the button did not open an app.
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
  const [qr, setQr] = React.useState('');
  const [noApp, setNoApp] = React.useState(false);

  // the QR code of the same UPI link, made here in the browser (nothing is sent anywhere)
  React.useEffect(() => {
    if (!upiLink) return;
    let alive = true;
    QRCode.toString(upiLink, { type: 'svg', margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(svg => alive && setQr(svg))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [upiLink]);

  // If the page is still in front 1.5 seconds after the button, no UPI app opened (a computer): tell what to do
  const onPay = () => {
    setNoApp(false);
    setTimeout(() => {
      if (document.visibilityState === 'visible') setNoApp(true);
    }, 1500);
  };

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
              onClick={onPay}
              className="mt-6 flex items-center justify-center gap-2 w-full py-3 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <Smartphone className="w-5 h-5" />
              Pay ₹{amount.toLocaleString('en-IN')} now
            </a>
            <p className="text-xs text-slate-500 mt-3">Opens your UPI app (GPay, PhonePe, Paytm...) with the amount already filled.</p>
            {noApp && (
              <p role="status" className="mt-3 p-2.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg text-left">
                No UPI app opened. This is normal on a computer. Scan the QR code below with the UPI app of your phone, or open this page on your phone.
              </p>
            )}
            {qr && (
              <div className="mt-5">
                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                  <QrCode className="w-3.5 h-3.5" />
                  Or scan this with any UPI app (GPay, PhonePe, Paytm...)
                </p>
                <div
                  className="mx-auto mt-2 w-44 h-44 p-2 bg-white rounded-lg border border-slate-200 [&>svg]:w-full [&>svg]:h-full"
                  aria-label="QR code of the payment"
                  role="img"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              </div>
            )}
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
