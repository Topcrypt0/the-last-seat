import { redis, send, readBody, sessionUser, token, limit, method } from '../_lib.js';
import { CHAR_IDS, newSeed, pickBots, roundParams } from '../../shared/game.js';

// Start a scored run. The server keeps the seed and hands out one round at a time.
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const userId = await sessionUser(req);
  if (!userId) return send(res, 401, { error: 'sign in to record a score' });
  if (!(await limit(`start:${userId}`, 12, 60))) return send(res, 429, { error: 'slow down' });

  let body = {};
  try {
    body = await readBody(req);
  } catch {}
  const char = CHAR_IDS.includes(body.char) ? body.char : CHAR_IDS[0];
  const seed = newSeed();
  const bots = pickBots(seed, char);
  const params = roundParams(seed, 1, bots);
  const runId = token();
  const run = { userId, char, seed, round: 1, bots, score: 0, params, sentAt: Date.now(), reactions: [] };
  await redis().set(`run:${runId}`, JSON.stringify(run), 'EX', 1800);
  await redis().hset(`user:${userId}`, 'char', char);
  send(res, 200, { runId, bots, params });
}
