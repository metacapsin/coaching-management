// A small PDF writer without any library: a branded report (the logo and the name of AcademiaOS on top like the emails, a line of summary boxes,
// a table with a coloured heading and every second row shaded, and a footer with the page number). Landscape A4, several pages when the list
// is long. Only the Latin letters can be written (the standard font of the PDF); any other letter becomes a "?".

import { saveBlobAs } from './saveFile';

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 30;
const FONT = 8;
const ROW_H = 18;
const HEAD_H = 20;
const BAND_H = 62;

// the colours of AcademiaOS (the same as in the emails), as "r g b" for the PDF
const rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(((n >> 16) & 255) / 255).toFixed(3)} ${(((n >> 8) & 255) / 255).toFixed(3)} ${((n & 255) / 255).toFixed(3)}`;
};
export const PDF_COLORS = {
  ink: '#0f172a',
  dark: '#080f1e',
  blue: '#f97316',
  green: '#15803d',
  red: '#b91c1c',
  amber: '#b45309',
  grey: '#64748b',
  light: '#94a3b8',
  line: '#e2e8f0',
  soft: '#f8fafc'
};

// the text in the file: the characters that the font has (Latin-1), the others become "?"
const clean = (value: unknown): string =>
  String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

const escapePdf = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export interface PdfTable {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  /** how wide each column is, compared with the others */
  weights?: number[];
  /** boxes above the table: { label: 'Coachings', value: 3 } */
  summary?: { label: string; value: string | number }[];
  /** the name next to the logo, and the words on the right of the band */
  brand?: { name: string; tagline: string };
  /** a colour (#rrggbb) for a cell, or nothing */
  colorize?: (column: number, value: string | number) => string | undefined;
  footer?: string;
}

/** The table as the bytes of a PDF file. */
export function buildTablePdf(t: PdfTable): Uint8Array {
  const { title, subtitle, headers, rows } = t;
  const brand = t.brand ?? { name: 'AcademiaOS', tagline: 'Coaching institute management' };
  const usable = PAGE_W - MARGIN * 2;
  const w = t.weights && t.weights.length === headers.length ? t.weights : headers.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const widths = w.map(x => (x / total) * usable);
  const fit = (text: string, width: number, size = FONT): string => {
    const max = Math.max(3, Math.floor((width - 12) / (size * 0.52)));
    return text.length > max ? text.slice(0, max - 3) + '...' : text;
  };
  const textWidth = (s: string, size: number) => s.length * size * 0.52;

  const pages: string[][] = [];
  let cmds: string[] = [];
  let y = 0;

  const text = (s: string, x: number, yy: number, o: { bold?: boolean; size?: number; color?: string } = {}) =>
    cmds.push(`BT /${o.bold ? 'F2' : 'F1'} ${o.size ?? FONT} Tf ${rgb(o.color ?? PDF_COLORS.ink)} rg ${x.toFixed(1)} ${yy.toFixed(1)} Td (${escapePdf(clean(s))}) Tj ET`);
  const rect = (x: number, yy: number, ww: number, hh: number, fill: string) => cmds.push(`${rgb(fill)} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${ww.toFixed(1)} ${hh.toFixed(1)} re f`);
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width = 0.5) => cmds.push(`${rgb(color)} RG ${width} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  // a rounded square (the logo)
  const rounded = (x: number, yy: number, size: number, r: number, fill: string) => {
    const k = r * 0.5523;
    const x2 = x + size;
    const y2 = yy + size;
    cmds.push(
      `${rgb(fill)} rg ${x + r} ${yy} m ${x2 - r} ${yy} l ${x2 - r + k} ${yy} ${x2} ${yy + r - k} ${x2} ${yy + r} c ${x2} ${y2 - r} l ${x2} ${y2 - r + k} ${x2 - r + k} ${y2} ${x2 - r} ${y2} c ${x + r} ${y2} l ${x + r - k} ${y2} ${x} ${y2 - r + k} ${x} ${y2 - r} c ${x} ${yy + r} l ${x} ${yy + r - k} ${x + r - k} ${yy} ${x + r} ${yy} c f`
    );
  };

  const band = () => {
    rect(0, PAGE_H - BAND_H, PAGE_W, BAND_H, PDF_COLORS.dark);
    rect(0, PAGE_H - BAND_H, PAGE_W, 3, PDF_COLORS.blue); // the line under the band, like the emails
    rounded(MARGIN, PAGE_H - BAND_H + 17, 30, 7, PDF_COLORS.blue);
    text('A', MARGIN + 10.2, PAGE_H - BAND_H + 25.5, { bold: true, size: 17, color: '#ffffff' });
    text(brand.name, MARGIN + 42, PAGE_H - BAND_H + 24, { bold: true, size: 20, color: '#ffffff' });
    const right = brand.tagline;
    text(right, PAGE_W - MARGIN - textWidth(right, 9), PAGE_H - BAND_H + 26, { size: 9, color: PDF_COLORS.light });
  };

  const newPage = (first: boolean) => {
    if (cmds.length) pages.push(cmds);
    cmds = [];
    band();
    y = PAGE_H - BAND_H - 26;
    if (first) {
      text(title, MARGIN, y, { bold: true, size: 20 });
      text(subtitle, MARGIN, y - 16, { size: 9, color: PDF_COLORS.grey });
      y -= 30;
      if (t.summary?.length) {
        const gap = 10;
        const bw = (usable - gap * (t.summary.length - 1)) / t.summary.length;
        t.summary.forEach((s, i) => {
          const x = MARGIN + i * (bw + gap);
          rect(x, y - 44, bw, 44, PDF_COLORS.soft);
          line(x, y - 44, x + bw, y - 44, PDF_COLORS.line, 0.8);
          rect(x, y - 44, 3, 44, PDF_COLORS.blue);
          text(s.label.toUpperCase(), x + 12, y - 15, { size: 7, bold: true, color: PDF_COLORS.grey });
          text(String(s.value), x + 12, y - 36, { bold: true, size: 17 });
        });
        y -= 58;
      }
    }
    // the heading of the table: a blue bar with white words
    rect(MARGIN, y - HEAD_H, usable, HEAD_H, PDF_COLORS.blue);
    let x = MARGIN;
    headers.forEach((h, i) => {
      text(fit(clean(h), widths[i]), x + 6, y - 13.5, { bold: true, color: '#ffffff' });
      x += widths[i];
    });
    y -= HEAD_H;
  };
  newPage(true);
  rows.forEach((row, n) => {
    if (y < MARGIN + 24 + ROW_H) newPage(false);
    if (n % 2 === 1) rect(MARGIN, y - ROW_H, usable, ROW_H, PDF_COLORS.soft); // every second row is shaded
    let x = MARGIN;
    row.forEach((cell, i) => {
      const color = t.colorize?.(i, cell);
      text(fit(clean(cell), widths[i]), x + 6, y - 12, { bold: Boolean(color), color });
      x += widths[i];
    });
    line(MARGIN, y - ROW_H, PAGE_W - MARGIN, y - ROW_H, PDF_COLORS.line, 0.4);
    y -= ROW_H;
  });
  pages.push(cmds);

  // the footer of every page: a line, the words on the left and the page number on the right
  const footer = t.footer ?? `${brand.name} - ${brand.tagline}`;
  pages.forEach((p, i) => {
    cmds = p;
    line(MARGIN, 34, PAGE_W - MARGIN, 34, PDF_COLORS.line, 0.6);
    text(footer, MARGIN, 20, { size: 8, color: PDF_COLORS.light });
    const label = `Page ${i + 1} of ${pages.length}`;
    text(label, PAGE_W - MARGIN - textWidth(label, 8), 20, { size: 8, color: PDF_COLORS.light });
  });

  // the objects: 1 catalog, 2 pages, 3 font, 4 bold font, then for each page a content stream and a page
  const objects: string[] = [];
  const kids: number[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((p, i) => {
    const content = 5 + i * 2;
    const page = content + 1;
    const stream = p.join('\n');
    objects[content] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[page] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${content} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    kids.push(page);
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // every character is one byte (Latin-1)
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** Asks where to save (the "Save as" window), then saves the table as a PDF file. */
export function downloadTablePdf(filename: string, table: PdfTable): Promise<boolean> {
  return saveBlobAs(filename, new Blob([buildTablePdf(table) as BlobPart], { type: 'application/pdf' }), 'PDF document', '.pdf');
}
