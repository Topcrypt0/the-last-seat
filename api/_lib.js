import Redis from 'ioredis';
import crypto from 'node:crypto';

let client;
export function redis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      enableAutoPipelining: true,
    });
  }
  return client;
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 16_000) throw new Error('body too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

export function token() {
  return crypto.randomBytes(24).toString('base64url');
}

const SESSION_TTL = 60 * 60 * 24 * 30;

export async function createSession(userId) {
  const t = token();
  await redis().set(`sess:${t}`, userId, 'EX', SESSION_TTL);
  return t;
}

export async function sessionUser(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t || t.length > 64) return null;
  return redis().get(`sess:${t}`);
}

// Display names are shown to everyone: keep them short and plain.
export function cleanName(s) {
  const raw = String(s || '').trim();
  const at = raw.startsWith('@') ? '@' : '';
  const n = raw.replace(/[^A-Za-z0-9_. -]/g, '').trim().slice(0, 20);
  return n.length >= 2 ? at + n : null;
}

export async function ensureUser(userId, defaults) {
  const key = `user:${userId}`;
  const r = redis();
  const exists = await r.exists(key);
  if (!exists) await r.hset(key, { created: Date.now(), games: 0, ...defaults });
  return r.hgetall(key);
}

// Fixed window rate limit. Returns true when allowed.
export async function limit(key, max, windowSec) {
  const r = redis();
  const n = await r.incr(`rl:${key}`);
  if (n === 1) await r.expire(`rl:${key}`, windowSec);
  return n <= max;
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export function method(req, res, m) {
  if (req.method !== m) {
    send(res, 405, { error: 'method not allowed' });
    return false;
  }
  return true;
}
