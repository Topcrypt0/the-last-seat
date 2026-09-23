import { newSeed, pickBots, roundParams, settleRound, ROUNDS } from '../shared/game.js';

export async function api(path, { method = 'GET', body, session } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// A scored run: the server holds the seed and deals one round at a time.
export class RemoteRun {
  constructor(session) {
    this.session = session;
    this.scored = true;
  }
  async start(char) {
    const r = await api('/api/run/start', { method: 'POST', body: { char }, session: this.session });
    this.runId = r.runId;
    return r;
  }
  report(round, reaction) {
    return api('/api/run/round', {
      method: 'POST',
      body: { runId: this.runId, round, reaction },
      session: this.session,
    });
  }
}

// A practice run in the browser. Same rules, nothing recorded.
export class LocalRun {
  constructor() {
    this.scored = false;
  }
  async start(char) {
    this.seed = newSeed();
    this.bots = pickBots(this.seed, char);
    this.round = 1;
    this.score = 0;
    this.params = roundParams(this.seed, 1, this.bots);
    return { bots: this.bots, params: this.params };
  }
  async report(round, reaction) {
    const result = settleRound(this.params, reaction);
    this.score += result.points;
    let next = null;
    const done = !result.survived || round >= ROUNDS;
    if (!done) {
      this.bots = this.bots.filter((b) => b !== result.out);
      this.round += 1;
      this.params = roundParams(this.seed, this.round, this.bots);
      next = this.params;
    }
    return { result, score: this.score, next, done, best: null, flagged: false };
  }
}
