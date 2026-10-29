import { describe, expect, it } from 'vitest';
import { csvCell, daysBetween, fillTemplate, nextBirthdays, normalizePhone, rankOf, timesOverlap, toWhatsAppNumber } from '../components/utils/helpers';

describe('helpers', () => {
  it('shares a rank between equal marks (1, 2, 2, 4)', () => {
    const scores = [90, 80, 80, 60];
    expect(scores.map(s => rankOf(s, scores))).toEqual([1, 2, 2, 4]);
  });

  it('fills the {{tags}} of a message', () => {
    expect(fillTemplate('Dear {{parent_name}}, {{student_name}} owes {{due_amount}}', { parent_name: 'Mr Rao', student_name: 'Asha', due_amount: '5,000' })).toBe(
      'Dear Mr Rao, Asha owes 5,000'
    );
  });

  it('writes a phone number in one format', () => {
    expect(normalizePhone('9876543210')).toBe('+91 98765 43210');
    expect(normalizePhone('+91 98765 43210')).toBe('+91 98765 43210');
  });

  it('adds the country code for WhatsApp', () => {
    expect(toWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(toWhatsAppNumber('09876543210')).toBe('919876543210');
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-11')).toBe(10);
    expect(daysBetween('2026-10-11', '2026-10-01')).toBe(-10);
  });

  it('keeps numbers as numbers and quotes text with commas in a CSV', () => {
    expect(csvCell(1500)).toBe('1500');
    expect(csvCell('Sharma, Aryan')).toBe('"Sharma, Aryan"');
  });

  it('finds class times that overlap', () => {
    expect(timesOverlap('09:00 AM', '10:00 AM', '09:30 AM', '10:30 AM')).toBe(true);
    expect(timesOverlap('09:00 AM', '10:00 AM', '10:00 AM', '11:00 AM')).toBe(false);
  });
});

describe('birthdays', () => {
  const people = [
    { name: 'today', dateOfBirth: '2010-10-29' },
    { name: 'in 3 days', dateOfBirth: '2009-11-01' },
    { name: 'far', dateOfBirth: '2008-12-25' },
    { name: 'yesterday', dateOfBirth: '2011-10-28' },
    { name: 'no date' }
  ];

  it('lists today and the next 7 days, soonest first', () => {
    const list = nextBirthdays(people, '2026-10-29');
    expect(list.map(b => [b.student.name, b.days])).toEqual([['today', 0], ['in 3 days', 3]]);
  });

  it('counts across the new year', () => {
    const list = nextBirthdays([{ dateOfBirth: '2010-01-02' }], '2026-12-30');
    expect(list.map(b => b.days)).toEqual([3]);
  });
});
