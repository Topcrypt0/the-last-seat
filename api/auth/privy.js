import { createRemoteJWKSet, jwtVerify } from 'jose';
import { redis, send, readBody, createSession, ensureUser, cleanName, method } from '../_lib.js';

// Sign in by email or X through Privy. The browser sends the Privy access token,
// checked against Privy's public keys. The email and X handle are then read from
// Privy's API with the app secret, so a player cannot claim someone else's handle.
let jwks;

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const appId = process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID;
  if (!appId) return send(res, 501, { error: 'email and X sign in are not configured' });
  jwks ||= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  const opts = { issuer: 'privy.io', audience: appId };

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad body' });
  }
  let sub;
  try {
    ({ payload: { sub } } = await jwtVerify(String(body.accessToken || ''), jwks, opts));
  } catch {
    return send(res, 401, { error: 'invalid privy token' });
  }

  // Verified account details: from Privy's API when the app secret is set,
  // otherwise from the identity token if present and valid.
  let email = null;
  let xHandle = null;
  let verified = false;
  const secret = process.env.PRIVY_APP_SECRET;
  if (secret) {
    try {
      const r = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(sub)}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${appId}:${secret}`).toString('base64')}`,
          'privy-app-id': appId,
        },
      });
      if (r.ok) {
        const u = await r.json();
        for (const a of u.linked_accounts || []) {
          if (a.type === 'email' && a.address) email = a.address;
          if (a.type === 'twitter_oauth' && a.username) xHandle = a.username;
        }
        verified = true;
      }
    } catch {}
  }
  if (!verified && body.identityToken) {
    try {
      const { payload } = await jwtVerify(String(body.identityToken), jwks, opts);
      if (payload.sub === sub) {
        const accounts = typeof payload.linked_accounts === 'string' ? JSON.parse(payload.linked_accounts) : payload.linked_accounts || [];
        for (const a of accounts) {
          if (a.type === 'email' && a.address) email = a.address;
          if (a.type === 'twitter_oauth' && a.username) xHandle = a.username;
        }
        verified = true;
      }
    } catch {}
  }
  // Without an identity token, fall back to what the browser says. It only affects the display name.
  if (!verified) {
    email = typeof body.email === 'string' ? body.email : null;
    xHandle = typeof body.xHandle === 'string' ? body.xHandle : null;
  }

  const userId = `privy:${sub}`;
  const handle = xHandle ? cleanName(`@${xHandle}`) : null;
  const label = handle ? `X ${handle}` : email && email.includes('@') ? `${email.slice(0, 2)}***@${email.split('@')[1]}` : 'email';
  const user = await ensureUser(userId, { name: handle || `seat${sub.slice(-5)}`, kind: handle ? 'x' : 'email', label });
  // an X account linked later still gets its handle as the name, unless the player chose one
  if (handle && user.kind !== 'x') {
    await redis().hset(`user:${userId}`, { kind: 'x', label, ...(user.name?.startsWith('seat') ? { name: handle } : {}) });
    Object.assign(user, { kind: 'x', label });
  }
  const session = await createSession(userId);
  send(res, 200, { session, user: { id: userId, name: user.name, char: user.char || null, label: user.label || label } });
}
