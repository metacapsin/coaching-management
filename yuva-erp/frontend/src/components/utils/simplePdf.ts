// A small PDF writer without any library: a title and a table (landscape A4, several pages when the list is long). Only the Latin letters
// can be written (the standard font of the PDF); any other letter becomes a "?". It is meant for lists of names, numbers and dates.

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 30;
const FONT = 8;
const ROW_H = 16;

// the text in the file: the characters that the font has (Latin-1), the others become "?"; ( ) \ are escaped
const clean = (value: unknown): string =>
  String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

const escapePdf = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** The table as the bytes of a PDF file. `weights` say how wide each column is (compared with the others). */
export function buildTablePdf(title: string, subtitle: string, headers: string[], rows: (string | number)[][], weights?: number[]): Uint8Array {
  const usable = PAGE_W - MARGIN * 2;
  const w = weights && weights.length === headers.length ? weights : headers.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const widths = w.map(x => (x / total) * usable);
  const fit = (text: string, width: number): string => {
    const max = Math.max(3, Math.floor((width - 6) / (FONT * 0.52)));
    return text.length > max ? text.slice(0, max - 3) + '...' : text;
  };

  // the pages: each page is a list of drawing commands
  const pages: string[][] = [];
  let cmds: string[] = [];
  let y = PAGE_H - MARGIN;
  const text = (s: string, x: number, yy: number, bold = false, size = FONT) => cmds.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${escapePdf(clean(s))}) Tj ET`);
  const newPage = (first: boolean) => {
    if (cmds.length) pages.push(cmds);
    cmds = [];
    y = PAGE_H - MARGIN;
    if (first) {
      text(title, MARGIN, y - 12, true, 16);
      text(subtitle, MARGIN, y - 28, false, 9);
      y -= 46;
    }
    // the headings of the table, with a line under them
    let x = MARGIN;
    headers.forEach((h, i) => {
      text(fit(clean(h), widths[i]), x + 3, y - 11, true);
      x += widths[i];
    });
    cmds.push(`0.6 w ${MARGIN} ${y - 15} m ${PAGE_W - MARGIN} ${y - 15} l S`);
    y -= ROW_H + 2;
  };
  newPage(true);
  for (const row of rows) {
    if (y < MARGIN + ROW_H) newPage(false);
    let x = MARGIN;
    row.forEach((cell, i) => {
      text(fit(clean(cell), widths[i]), x + 3, y - 11);
      x += widths[i];
    });
    cmds.push(`0.2 w 0.8 G ${MARGIN} ${y - 14} m ${PAGE_W - MARGIN} ${y - 14} l S 0 G`);
    y -= ROW_H;
  }
  pages.push(cmds);

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

/** Saves the table as a PDF file on the computer of the person. */
export function downloadTablePdf(filename: string, title: string, subtitle: string, headers: string[], rows: (string | number)[][], weights?: number[]): void {
  const blob = new Blob([buildTablePdf(title, subtitle, headers, rows, weights) as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
