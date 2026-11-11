// The look of the emails of AcademiaOS: one clean card (HTML with inline CSS, because email programs ignore most other CSS)
// and the same words as plain text for programs that cannot show HTML.

const BLUE = '#1565c0';
export const GREEN = '#15803d';
export const RED = '#b91c1c';

const escapeHtml = (s: any, quote = false): string => {
  const out = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return quote ? out.replace(/"/g, '&quot;').replace(/'/g, '&#x27;') : out;
};
const esc = (s: any) => escapeHtml(s, true);

export interface RenderOptions {
  details?: [string, any][]; // shown in a small table (who asked, which coaching...)
  button?: [string, string]; // (label, url) a big button
  code?: string; // a short code shown in a big box (password reset)
  accent?: string; // the colour of the top line, the button and the title mark
  note?: string; // a small grey sentence at the end
  name?: string; // "Hello <name>," at the start
  preview?: string; // the grey line that the inbox shows next to the subject (default: the first paragraph)
  from?: { name: string; email?: string }; // the person who sends it: shown in the email, and Reply writes to the email
}

/** Returns [plain text, html]. */
export function render(heading: string, lines: string[], opts: RenderOptions = {}): [string, string] {
  const { button, code, note, name, preview, from } = opts;
  const accent = opts.accent ?? BLUE;
  const details = (opts.details ?? []).filter(([, v]) => v);

  // ---- plain text
  const parts: string[] = [];
  if (name) parts.push(`Hello ${name},`);
  parts.push(heading);
  if (from) parts.push(`From: ${from.name}${from.email ? ` <${from.email}>` : ''}${from.email ? ' (press Reply to write to this person)' : ''}`);
  parts.push(...lines);
  if (code) parts.push(`Your code: ${code}`);
  if (details.length) parts.push(details.map(([k, v]) => `${k}: ${v}`).join('\n'));
  if (button) parts.push(`${button[0]}: ${button[1]}`);
  if (note) parts.push(note);
  parts.push('AcademiaOS');
  const plain = parts.join('\n\n');

  // ---- HTML
  const p = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;';
  const body: string[] = [];
  if (from) {
    body.push(
      '<p style="margin:0 0 16px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;line-height:1.5;color:#475569;">' +
        `From <b style="color:#0f172a;">${esc(from.name)}</b>${from.email ? ` &lt;${esc(from.email)}&gt;<br>Press Reply to write to this person.` : ''}</p>`,
    );
  }
  if (name) body.push(`<p style="${p}">Hello ${esc(name)},</p>`);
  for (const line of lines) body.push(`<p style="${p}">${esc(line)}</p>`);
  if (code) {
    body.push(
      '<div style="margin:18px 0;padding:16px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;' +
        `text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:${BLUE};font-family:Consolas,Menlo,monospace;">` +
        `${esc(code)}</div>`,
    );
  }
  if (details.length) {
    const rows = details
      .map(
        ([k, v]) =>
          '<tr>' +
          `<td style="padding:8px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(k)}</td>` +
          `<td style="padding:8px 12px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;font-weight:600;">${esc(v)}</td>` +
          '</tr>',
      )
      .join('');
    body.push(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
        `style="margin:6px 0 18px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;border-collapse:separate;">${rows}</table>`,
    );
  }
  if (button) {
    body.push(
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr>' +
        `<td style="border-radius:8px;background:${accent};">` +
        `<a href="${esc(button[1])}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;` +
        `color:#ffffff;text-decoration:none;border-radius:8px;">${esc(button[0])}</a>` +
        '</td></tr></table>',
    );
    body.push(
      '<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">' +
        `The button does not open? Copy this link into your browser:<br><a href="${esc(button[1])}" ` +
        `style="color:${BLUE};word-break:break-all;">${esc(button[1])}</a></p>`,
    );
  }
  if (note) body.push(`<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">${esc(note)}</p>`);
  const hidden = esc(preview || (lines.length ? lines[0] : heading));

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f5f9;">${hidden}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="background:#0f1b26;padding:20px 28px;border-bottom:4px solid ${accent};">
      <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:8px;background:${BLUE};color:#ffffff;font-size:18px;font-weight:700;vertical-align:middle;">A</span>
      <span style="font-size:20px;font-weight:700;color:#ffffff;vertical-align:middle;margin-left:10px;letter-spacing:-0.3px;">AcademiaOS</span>
    </td></tr>
    <tr><td style="padding:30px 28px 26px;">
      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a;">${esc(heading)}</h1>
      ${body.join('')}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      Coaching institute management &middot; this email was sent by AcademiaOS
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return [plain, html];
}
