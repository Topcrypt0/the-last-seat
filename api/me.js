import { redis, send, readBody, sessionUser, cleanName, limit } from './_lib.js';
import { CHAR_IDS } from '../shared/game.js';

// GET: your profile and rank. POST: change display name or character.
export default async function handler(req, res) {
  const userId = await sessionUser(req);
  if (!userId) return send(res, 401, { error: 'not signed in' });
  const r = redis();
  const key = `user:${userId}`;

  if (req.method === 'POST') {
    if (!(await limit(`me:${userId}`, 20, 60))) return send(res, 429, { error: 'slow down' });
    let body = {};
    try {
      body = await readBody(req);
    } catch {}
    const patch = {};
    if (body.name !== undefined) {
      const n = cleanName(body.name);
      if (!n) return send(res, 400, { error: 'name: 2 to 20 letters, digits, _ . -' });
      patch.name = n;
    }
    if (body.char !== undefined && CHAR_IDS.includes(body.char)) patch.char = body.char;
    if (Object.keys(patch).length) await r.hset(key, patch);
  }

  const u = await r.hgetall(key);
  const score = await r.zscore('lb', userId);
  const rank = await r.zrevrank('lb', userId);
  send(res, 200, {
    user: {
      id: userId,
      name: u.name,
      label: u.label,
      char: u.char || null,
      games: Number(u.games || 0),
      wins: Number(u.wins || 0),
      fastest: u.fastest ? Number(u.fastest) : null,
      best: score ? Number(score) : 0,
      rank: rank === null ? null : rank + 1,
    },
  });
}
