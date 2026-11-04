import { useInstitute } from '../../Context/InstituteContext';
import type { Student } from '../../types';
import { emailFeeNotice } from './api';
import { fillTemplate, formatDate, openWhatsApp, payPageLink, withPayLink } from './helpers';

export type NoticeResult = { type: 'success' | 'error'; text: string };

// "Send notice": tells the parent that the fee is not fully paid. It opens ready in WhatsApp, is kept in Parent Broadcasts, and
// goes by email too when the parent has one (with the Pay now link when the coaching wrote its UPI id). The money is not collected
// here: the office writes the payment in the Fees page when it arrives. `show` gets the messages (now, and later for the email).
export const useFeeNotice = () => {
  const { profile, templates, batches, sendNotification } = useInstitute();

  return (s: Student, show: (r: NoticeResult) => void) => {
    if (!s.parentPhone) {
      show({ type: 'error', text: `There is no parent number for ${s.name}. Add it in Edit first.` });
      return;
    }
    const net = Math.max(0, s.totalFees - s.discount);
    const bal = Math.max(0, net - s.feePaid);
    const template = templates.find(t => t.type === 'fee_due');
    const payLink = payPageLink(profile, s.name, bal);
    const base = template
      ? fillTemplate(template.templateBody, {
          parent_name: s.parentName,
          student_name: s.name,
          currency: profile.currencySymbol,
          due_amount: bal.toLocaleString('en-IN'),
          due_date: s.nextDueDate ? formatDate(s.nextDueDate) : 'at the earliest',
          batch_name: batches.find(b => b.id === s.batchId)?.name || 'Class'
        })
      : `Hello ${s.parentName} ji, the fee of ${s.name} (${s.rollNo}) at ${profile.name} is not fully paid. Pending: ${profile.currencySymbol}${bal.toLocaleString('en-IN')}. Please pay it at the earliest.`;
    const message = withPayLink(base, payLink);

    sendNotification({
      type: 'fee_due',
      channel: 'whatsapp',
      recipientName: s.parentName,
      recipientPhone: s.parentPhone,
      studentName: s.name,
      studentId: s.id,
      content: message
    });
    openWhatsApp(s.parentPhone, message);
    const payNote = payLink ? ' It has a Pay now link.' : ' Write the UPI id in Institute Profile to add a Pay now link.';
    show({ type: 'success', text: `Fee notice for ${s.name} is ready in WhatsApp (pending ${profile.currencySymbol}${bal.toLocaleString('en-IN')}). Press Send there.${payNote}` });
    if (s.parentEmail) {
      emailFeeNotice(s.id)
        .then(r => {
          if (r.notified === 'sent') show({ type: 'success', text: `Fee notice for ${s.name} was also emailed to ${s.parentEmail}.${payNote}` });
        })
        .catch(() => undefined);
    }
  };
};
