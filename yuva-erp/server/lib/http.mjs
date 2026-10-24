// Small helpers for the plain Node http server (no packages needed).

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const sendJson = (res, status, body) => {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
};

export const readJson = (req, limitBytes) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        const parsed = JSON.parse(text);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });

export const bearerToken = req => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const stripV6Prefix = address => address.replace(/^::ffff:/, '');
const isLoopback = address => address === '127.0.0.1' || address === '::1';

// Address of the caller. Behind a proxy on this same computer the proxy's own address would be the same
// for everybody, so the address it forwards is used (only trusted when the proxy is local).
export const clientIp = req => {
  const peer = stripV6Prefix(req.socket?.remoteAddress || 'unknown');
  if (isLoopback(peer)) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return stripV6Prefix(forwarded).slice(0, 64);
  }
  return peer;
};
