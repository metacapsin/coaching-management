import { describe, expect, it } from 'vitest';
import { buildTablePdf } from '../components/utils/simplePdf';

const BS = String.fromCharCode(92); // a backslash
const asText = (bytes: Uint8Array) => Array.from(bytes, b => String.fromCharCode(b)).join('');

describe('the PDF of a table', () => {
  it('is a real PDF: header, the text, a correct table of positions and the end mark', () => {
    const pdf = asText(buildTablePdf({ title: 'Coachings', subtitle: 'The list', headers: ['Coaching', 'Students'], rows: [['Apex (Demo)', 4], ['Improve ' + BS + ' Centre', 2]], summary: [{ label: 'Coachings', value: 2 }] }));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('(Coachings) Tj');
    expect(pdf).toContain('(AcademiaOS) Tj'); // the name of the brand on the band
    expect(pdf).toContain('(Page 1 of 1) Tj'); // the footer
    expect(pdf).toContain('(Apex ' + BS + '(Demo' + BS + ')) Tj'); // brackets and the backslash are escaped
    expect(pdf).toContain('(Improve ' + BS + BS + ' Centre) Tj');
    // every position of the table points at its object
    const start = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    const lines = pdf.slice(start).split('\n');
    const count = Number(lines[1].split(' ')[1]);
    for (let i = 1; i < count; i++) {
      const offset = Number(lines[2 + i].slice(0, 10));
      expect(pdf.slice(offset, offset + `${i} 0 obj`.length)).toBe(`${i} 0 obj`);
    }
  });

  it('goes on a new page when the list is long, and shows a letter it cannot write as ?', () => {
    const rows = Array.from({ length: 80 }, (_, i) => [`Coaching ${i}`, i]);
    const pdf = asText(buildTablePdf({ title: 'T', subtitle: 'S', headers: ['A', 'B'], rows }));
    expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBeGreaterThan(2);
    const hindi = asText(buildTablePdf({ title: 'T', subtitle: 'S', headers: ['A'], rows: [['राहुल']] }));
    expect(hindi).toContain('(?????) Tj');
  });
});
