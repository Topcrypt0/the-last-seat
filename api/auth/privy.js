import { createRemoteJWKSet, jwtVerify } from 'jose';
import { send, readBody, createSession, ensureUser, method } from '../_lib.js';

// Sign in by email through Privy. The browser sends the Privy access token,
// we check it against Privy's public keys for this app id.
let jwks;

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const appId = process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID;
  if (!appId) return send(res, 501, { error: 'email sign in is not configured' });
  jwks ||= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad body' });
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(String(body.accessToken || ''), jwks, { issuer: 'privy.io', audience: appId }));
  } catch {
    return send(res, 401, { error: 'invalid privy token' });
  }
  const userId = `privy:${payload.sub}`;
  // the email is only used for a masked label, it is never shown in full
  const email = String(body.email || '');
  const label = email.includes('@') ? `${email.slice(0, 2)}***@${email.split('@')[1]}` : 'email';
  const user = await ensureUser(userId, { name: `seat${payload.sub.slice(-5)}`, kind: 'email', label });
  const session = await createSession(userId);
  send(res, 200, { session, user: { id: userId, name: user.name, char: user.char || null, label: user.label } });
}
