import { redis, send, token, limit, clientIp, method } from '../_lib.js';

// A one time nonce for "sign in with your wallet". Valid for 5 minutes.
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!(await limit(`nonce:${clientIp(req)}`, 30, 60))) return send(res, 429, { error: 'slow down' });
  const nonce = token().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  await redis().set(`nonce:${nonce}`, '1', 'EX', 300);
  send(res, 200, { nonce });
}
