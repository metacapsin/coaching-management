import { useInstitute } from '../../Context/InstituteContext';
import type { Student } from '../../types';
import { emailFeeNotice } from './api';
import { fillTemplate, formatDate, openWhatsApp, payPageLink, withPayLink } from './helpers';

export type NoticeResult = { type: 'success' | 'error'; text: string };

// "Send notice": tells the parent that the fee is not fully paid. It opens ready in WhatsApp, is kept in Parent Broadcasts, and
// goes by email too when the parent has one (with the Pay now link when the coaching wrote its UPI id). The money is not collected
// here: the office writes the payment in the Fees page when it arrives. `show` gets the messages (now, and later for the email).
// `viaEmail`: the notice goes only by EMAIL to the parent (and into the own login of the parent: the bell and the Notice Board). WhatsApp is not opened.
export const useFeeNotice = (options: { viaEmail?: boolean } = {}) => {
  const { profile, templates, batches, sendNotification, notificationLogs } = useInstitute();

  return (s: Student, show: (r: NoticeResult) => void) => {
    if (!options.viaEmail && !s.parentPhone) {
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

    if (options.viaEmail) {
      // the message is kept for the login of the parent (not doubled when one is waiting already), and the email goes at once
      if (!notificationLogs.some(l => l.type === 'fee_due' && l.studentId === s.id && l.status === 'pending')) {
        sendNotification({ type: 'fee_due', channel: 'whatsapp', recipientName: s.parentName, recipientPhone: s.parentPhone, studentName: s.name, studentId: s.id, content: message });
      }
      if (!s.parentEmail) {
        show({ type: 'error', text: `${s.name} has no parent email, so the notice is only in the parent login (bell and Notice Board). Add the email in Edit to send it by email.` });
        return;
      }
      emailFeeNotice(s.id)
        .then(r =>
          show(
            r.notified === 'sent'
              ? { type: 'success', text: `The fee notice for ${s.name} (pending ${profile.currencySymbol}${bal.toLocaleString('en-IN')}) was emailed to ${s.parentEmail} and is in the parent login too.` }
              : { type: 'error', text: `The email for ${s.name} could not be sent. The notice is in the parent login (bell and Notice Board).` }
          )
        )
        .catch(err => show({ type: 'error', text: err instanceof Error ? err.message : 'The notice could not be sent.' }));
      return;
    }

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
