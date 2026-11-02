"""The look of the emails of AcademiaOS: one clean card (HTML with inline CSS, because email programs ignore most other CSS)
and the same words as plain text for programs that cannot show HTML."""

from html import escape

BLUE = '#1565c0'
GREEN = '#15803d'
RED = '#b91c1c'


def render(heading, lines, details=None, button=None, code=None, accent=BLUE, note=None, name=None, preview=None):
    """Returns (text, html).

    heading  the big title of the email
    lines    paragraphs under the title
    details  [(label, value)] shown in a small table (who asked, which coaching...)
    button   (label, url) a big button
    code     a short code shown in a big box (password reset)
    accent   the colour of the top line, the button and the title mark
    note     a small grey sentence at the end
    preview  the grey line that the inbox shows next to the subject (default: the first paragraph)
    name     "Hello <name>," at the start
    """
    details = [(k, v) for k, v in (details or []) if v]

    # ---- plain text
    text = []
    if name:
        text.append(f'Hello {name},')
    text.append(heading)
    text.extend(lines)
    if code:
        text.append(f'Your code: {code}')
    if details:
        text.append('\n'.join(f'{k}: {v}' for k, v in details))
    if button:
        text.append(f'{button[0]}: {button[1]}')
    if note:
        text.append(note)
    text.append('AcademiaOS')
    plain = '\n\n'.join(text)

    # ---- HTML
    p = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;'
    body = []
    if name:
        body.append(f'<p style="{p}">Hello {escape(name)},</p>')
    for line in lines:
        body.append(f'<p style="{p}">{escape(line)}</p>')
    if code:
        body.append(
            '<div style="margin:18px 0;padding:16px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;'
            f'text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:{BLUE};font-family:Consolas,Menlo,monospace;">'
            f'{escape(code)}</div>'
        )
    if details:
        rows = ''.join(
            '<tr>'
            f'<td style="padding:8px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;white-space:nowrap;">{escape(k)}</td>'
            f'<td style="padding:8px 12px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;font-weight:600;">{escape(v)}</td>'
            '</tr>'
            for k, v in details
        )
        body.append(
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="margin:6px 0 18px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;border-collapse:separate;">{rows}</table>'
        )
    if button:
        body.append(
            '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr>'
            f'<td style="border-radius:8px;background:{accent};">'
            f'<a href="{escape(button[1], quote=True)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;'
            f'color:#ffffff;text-decoration:none;border-radius:8px;">{escape(button[0])}</a>'
            '</td></tr></table>'
        )
    if button:
        body.append(
            '<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">'
            f'The button does not open? Copy this link into your browser:<br><a href="{escape(button[1], quote=True)}" '
            f'style="color:{BLUE};word-break:break-all;">{escape(button[1])}</a></p>'
        )
    if note:
        body.append(f'<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">{escape(note)}</p>')
    hidden = escape(preview or (lines[0] if lines else heading))

    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f5f9;">{hidden}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="background:#0f1b26;padding:20px 28px;border-bottom:4px solid {accent};">
      <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:8px;background:{BLUE};color:#ffffff;font-size:18px;font-weight:700;vertical-align:middle;">A</span>
      <span style="font-size:20px;font-weight:700;color:#ffffff;vertical-align:middle;margin-left:10px;letter-spacing:-0.3px;">AcademiaOS</span>
    </td></tr>
    <tr><td style="padding:30px 28px 26px;">
      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a;">{escape(heading)}</h1>
      {''.join(body)}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      Coaching institute management &middot; this email was sent by AcademiaOS
    </td></tr>
  </table>
</td></tr></table>
</body></html>'''
    return plain, html
