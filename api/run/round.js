import { redis, send, readBody, sessionUser, method, token } from '../_lib.js';
import { ROUNDS, MIN_HUMAN_MS, NO_PRESS_MS, roundParams, settleRound } from '../../shared/game.js';

// Clock slack for a client whose timer runs a little fast.
const SLACK_MS = 400;

// Report one round: reaction in ms after the music stopped, or null for a false start.
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  const userId = await sessionUser(req);
  if (!userId) return send(res, 401, { error: 'not signed in' });
  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad body' });
  }
  const runId = String(body.runId || '');
  const key = `run:${runId}`;
  const r = redis();
  const raw = await r.get(key);
  if (!raw) return send(res, 404, { error: 'run expired' });
  const run = JSON.parse(raw);
  if (run.userId !== userId || run.done) return send(res, 409, { error: 'run closed' });
  if (body.round !== run.round) return send(res, 409, { error: 'wrong round' });

  let reaction = body.reaction;
  if (reaction !== null) {
    reaction = Number(reaction);
    if (!Number.isFinite(reaction)) return send(res, 400, { error: 'bad reaction' });
    reaction = Math.min(NO_PRESS_MS, Math.max(MIN_HUMAN_MS, Math.round(reaction)));
  }

  // The music could not have stopped before its duration ran out.
  const elapsed = Date.now() - run.sentAt;
  const p = run.params;
  const earliest = reaction === null ? 0 : p.duration + reaction - SLACK_MS;
  let flagged = false;
  if (elapsed < earliest) {
    flagged = true;
    reaction = null; // treated as a false start
  }

  const result = settleRound(p, reaction);
  run.reactions.push(reaction);
  run.score += result.points;

  let next = null;
  if (result.survived && run.round < ROUNDS) {
    run.bots = run.bots.filter((b) => b !== result.out);
    run.round += 1;
    run.params = roundParams(run.seed, run.round, run.bots);
    run.sentAt = Date.now();
    next = run.params;
  } else {
    run.done = true;
  }
  await r.set(key, JSON.stringify(run), 'EX', 1800);

  let best = null;
  if (run.done) best = await record(userId, run, result.survived);
  send(res, 200, { result, flagged, score: run.score, next, done: run.done, best });
}

async function record(userId, run, won) {
  const r = redis();
  const rounds = run.reactions.length - (won ? 0 : 1);
  const fastest = Math.min(...run.reactions.filter((x) => x !== null));
  const ukey = `user:${userId}`;
  const prev = Number((await r.zscore('lb', userId)) || 0);
  const tx = r.multi();
  tx.hincrby(ukey, 'games', 1);
  if (won) tx.hincrby(ukey, 'wins', 1);
  if (run.score > prev) {
    tx.zadd('lb', run.score, userId);
    tx.hset(ukey, { bestRounds: rounds, bestChar: run.char, bestAt: Date.now() });
  }
  if (Number.isFinite(fastest)) {
    const cur = Number((await r.hget(ukey, 'fastest')) || Infinity);
    if (fastest < cur) tx.hset(ukey, 'fastest', fastest);
  }
  await tx.exec();
  const best = Math.max(prev, run.score);
  const rankIdx = await r.zrevrank('lb', userId);
  const rank = rankIdx === null ? null : rankIdx + 1;
  // a frozen record of this run for the share certificate
  const shareId = token().slice(0, 16);
  const name = (await r.hget(ukey, 'name')) || 'A shareholder';
  const share = {
    name,
    char: run.char,
    score: run.score,
    rounds,
    fastest: Number.isFinite(fastest) ? fastest : null,
    rank: run.score >= prev ? rank : null,
    won,
    falseStart: run.reactions[run.reactions.length - 1] === null,
    at: Date.now(),
  };
  await r.set(`share:${shareId}`, JSON.stringify(share), 'EX', 60 * 60 * 24 * 365);
  return { best, rank, shareId, share };
}
