import { describe, expect, it } from 'vitest';
import { buildXlsx } from '../components/utils/xlsx';

const latin = (bytes: Uint8Array) => Array.from(bytes, b => String.fromCharCode(b)).join('');

describe('the Excel file of a table', () => {
  it('is a zip with the files of a workbook, and keeps numbers, Hindi and & < >', () => {
    const bytes = buildXlsx('Coachings', ['Coaching', 'Students'], [['Apex & <Demo>', 4], ['राहुल', 2]], [30, 10], { brand: 'AcademiaOS', title: 'Coachings', subtitle: 'The list' });
    // a zip: it starts with PK, and the end mark says how many files it has
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const end = bytes.length - 22;
    expect(new DataView(bytes.buffer).getUint32(end, true)).toBe(0x06054b50);
    expect(new DataView(bytes.buffer).getUint16(end + 10, true)).toBe(6);
    const text = latin(bytes);
    for (const name of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) expect(text).toContain(name);
    const utf8 = new TextDecoder().decode(bytes);
    expect(utf8).toContain('Apex &amp; &lt;Demo&gt;');
    expect(utf8).toContain('राहुल');
    expect(utf8).toContain('AcademiaOS'); // the band with the brand
    expect(utf8).toContain('<mergeCell ref="A1:B1"/>');
    expect(utf8).toMatch(/<c r="B6"[^>]*><v>4<\/v><\/c>/); // a number stays a number
  });
});
