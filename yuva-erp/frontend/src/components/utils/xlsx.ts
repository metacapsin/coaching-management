// A small Excel file (.xlsx) writer without any library: one sheet with a bold heading row. An .xlsx file is a zip of a few XML files; the zip here
// stores the files without squeezing them. Every letter of every language is kept (the text is UTF-8). It opens in Excel, Google Sheets and
// LibreOffice by a double click (unlike a .csv file, which some computers open with the wrong program).

const encoder = new TextEncoder();

// ---------- the zip ----------

let crcTable: Uint32Array | null = null;
const crc32 = (bytes: Uint8Array): number => {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;
  const push = (chunk: ArrayLike<number>) => {
    parts.push(Uint8Array.from(chunk as ArrayLike<number>));
    offset += chunk.length;
  };
  for (const f of files) {
    const name = encoder.encode(f.name);
    const crc = crc32(f.data);
    const local = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0)];
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
    push(local);
    push(name);
    push(f.data);
  }
  const centralStart = offset;
  push(central);
  push([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(central.length), ...u32(centralStart), ...u16(0)]);
  const out = new Uint8Array(offset);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---------- the sheet ----------

const xml = (value: unknown): string =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const columnName = (index: number): string => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

export interface XlsxOptions {
  /** the name of the brand, the title and the date: the sheet starts with a band like the emails */
  brand?: string;
  title?: string;
  subtitle?: string;
  /** a colour for a cell: 'green', 'red' or 'amber' (the text is bold and coloured), or nothing */
  colorize?: (column: number, value: string | number) => 'green' | 'red' | 'amber' | undefined;
}

// the styles: 0 plain, 1 brand band, 2 title, 3 subtitle, 4 heading, 5 body, 6 body shaded, 7 green, 8 red, 9 amber (the body ones with a thin border)
const STYLE = { plain: 0, brand: 1, title: 2, subtitle: 3, head: 4, body: 5, shaded: 6, green: 7, red: 8, amber: 9 } as const;

/** The bytes of an .xlsx file with one sheet: a band with the brand and the title, a blue heading row, shaded rows, numbers stay numbers. */
export function buildXlsx(sheetName: string, headers: string[], rows: (string | number)[][], widths?: number[], options: XlsxOptions = {}): Uint8Array {
  const cell = (value: string | number, col: number, row: number, style: number): string => {
    const ref = `${columnName(col)}${row}`;
    const s = style ? ` s="${style}"` : '';
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  };
  const last = columnName(headers.length - 1);
  const top: string[] = [];
  const merges: string[] = [];
  let next = 1;
  if (options.brand) {
    top.push(`<row r="${next}" ht="30" customHeight="1">${headers.map((_, c) => cell(c === 0 ? options.brand! : '', c, next, STYLE.brand)).join('')}</row>`);
    merges.push(`A${next}:${last}${next}`);
    next++;
  }
  if (options.title) {
    top.push(`<row r="${next}" ht="26" customHeight="1">${cell(options.title, 0, next, STYLE.title)}</row>`);
    merges.push(`A${next}:${last}${next}`);
    next++;
  }
  if (options.subtitle) {
    top.push(`<row r="${next}">${cell(options.subtitle, 0, next, STYLE.subtitle)}</row>`);
    merges.push(`A${next}:${last}${next}`);
    next++;
  }
  if (top.length) next++; // an empty row between the band and the table
  const headRow = next;
  const head = `<row r="${headRow}" ht="22" customHeight="1">${headers.map((h, c) => cell(h, c, headRow, STYLE.head)).join('')}</row>`;
  const body = rows
    .map((r, i) => {
      const n = headRow + 1 + i;
      return `<row r="${n}">${r
        .map((v, c) => {
          const color = options.colorize?.(c, v);
          return cell(v, c, n, color ? STYLE[color] : i % 2 === 1 ? STYLE.shaded : STYLE.body);
        })
        .join('')}</row>`;
    })
    .join('');
  const lastRow = headRow + rows.length;
  const cols = widths && widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const view = `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  const filter = rows.length ? `<autoFilter ref="A${headRow}:${last}${lastRow}"/>` : '';
  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const font = (extra: string, size: number, color?: string) => `<font>${extra}<sz val="${size}"/>${color ? `<color rgb="FF${color}"/>` : ''}<name val="Calibri"/></font>`;
  const fill = (rgbHex: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgbHex}"/><bgColor indexed="64"/></patternFill></fill>`;
  const edge = (side: string) => `<${side} style="thin"><color rgb="FFE2E8F0"/></${side}>`;
  const xf = (fontId: number, fillId: number, border: number, align = '') =>
    `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${align ? ` applyAlignment="1">${align}</xf>` : '/>'}`;
  const vcenter = '<alignment vertical="center"/>';
  const styles = `${header}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="8">${font('', 11)}${font('<b/>', 18, 'FFFFFF')}${font('<b/>', 15, '0F172A')}${font('', 10, '64748B')}${font('<b/>', 11, 'FFFFFF')}${font('<b/>', 11, '15803D')}${font('<b/>', 11, 'B91C1C')}${font('<b/>', 11, 'B45309')}</fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('0F1B26')}${fill('1565C0')}${fill('F8FAFC')}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${edge('left')}${edge('right')}${edge('top')}${edge('bottom')}<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">${xf(0, 0, 0)}${xf(1, 2, 0, vcenter)}${xf(2, 0, 0, vcenter)}${xf(3, 0, 0)}${xf(4, 3, 1, vcenter)}${xf(0, 0, 1)}${xf(0, 4, 1)}${xf(5, 0, 1)}${xf(6, 0, 1)}${xf(7, 0, 1)}</cellXfs></styleSheet>`;
  const files = [
    {
      name: '[Content_Types].xml',
      text: `${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    },
    {
      name: '_rels/.rels',
      text: `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      text: `${header}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    },
    { name: 'xl/styles.xml', text: styles },
    {
      name: 'xl/worksheets/sheet1.xml',
      text: `${header}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${cols}<sheetData>${top.join('')}${head}${body}</sheetData>${filter}${mergeXml}</worksheet>`
    }
  ];
  return zipStore(files.map(f => ({ name: f.name, data: encoder.encode(f.text) })));
}

/** Saves the table as an Excel file on the computer of the person. */
export function downloadXlsx(filename: string, sheetName: string, headers: string[], rows: (string | number)[][], widths?: number[], options?: XlsxOptions): void {
  const blob = new Blob([buildXlsx(sheetName, headers, rows, widths, options) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
