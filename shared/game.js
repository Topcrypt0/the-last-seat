// Game rules shared by the browser and the API.
// The server replays every round with these same functions, so a score
// on the leaderboard is only what these rules allow.

export const PLAYERS = 5;
export const ROUNDS = PLAYERS - 1; // 5 players/4 chairs ... 2 players/1 chair
export const MIN_HUMAN_MS = 100; // faster than this is not a person
export const NO_PRESS_MS = 3000; // never pressed: counted as this slow

// Difficulty per round (index 0 = round 1).
const TABLE = [
  { bpm: 112, dur: [6000, 10000], fakeouts: 0, bot: [760, 150] },
  { bpm: 126, dur: [5000, 11000], fakeouts: 1, bot: [580, 110] },
  { bpm: 140, dur: [4000, 12000], fakeouts: 2, bot: [450, 80] },
  { bpm: 156, dur: [3000, 13000], fakeouts: 3, bot: [345, 50] },
];

// mulberry32, seeded per run and round
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Parameters of one round. `bots` are the bot ids still standing.
export function roundParams(seed, round, bots) {
  const t = TABLE[round - 1];
  const r = rng((seed ^ Math.imul(round, 0x9e3779b1)) >>> 0);
  const duration = Math.round(t.dur[0] + r() * (t.dur[1] - t.dur[0]));
  const fakeouts = [];
  // fake stops: the tune drops to a single held note, then carries on
  for (let i = 0; i < t.fakeouts; i++) {
    const at = Math.round(1500 + r() * Math.max(0, duration - 3000));
    if (fakeouts.every((f) => Math.abs(f - at) > 1400) && at < duration - 1300) fakeouts.push(at);
  }
  fakeouts.sort((a, b) => a - b);
  const botReactions = {};
  for (const id of bots) {
    botReactions[id] = Math.max(190, Math.round(t.bot[0] + gauss(r) * t.bot[1]));
  }
  return { round, bpm: t.bpm, duration, fakeouts, fakeoutMs: 650, botReactions, chairs: bots.length };
}

// Settle a round. reaction: ms after the music stopped, or null for a false start.
// Returns who is out and the points earned by the player.
export function settleRound(params, reaction) {
  const falseStart = reaction === null;
  const mine = falseStart ? Infinity : Math.min(NO_PRESS_MS, Math.max(MIN_HUMAN_MS, reaction));
  const times = Object.entries(params.botReactions).map(([id, ms]) => ({ id, ms }));
  times.push({ id: 'you', ms: mine });
  // slowest is out; ties go against the player
  times.sort((a, b) => a.ms - b.ms || (a.id === 'you' ? 1 : b.id === 'you' ? -1 : 0));
  const out = times[times.length - 1].id;
  const survived = out !== 'you';
  let points = 0;
  if (survived) {
    points = 1000 * params.round + Math.max(0, 800 - mine);
    if (params.round === ROUNDS) points += 3000; // took the last seat
  }
  return { out, order: times.map((t) => t.id), survived, points, falseStart };
}

export function newSeed() {
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

export const MAX_SCORE_HINT = 1000 * (1 + 2 + 3 + 4) + 700 * 4 + 3000;

// The 23 shareholders who can walk without their chair.
export const CHAR_IDS = [
  'argon-01', 'argon-02', 'argon-03', 'argon-04', 'argon-05',
  'bogle-01', 'bogle-02', 'bogle-03', 'bogle-04', 'bogle-05',
  'smaug-01', 'smaug-03', 'smaug-04', 'smaug-05',
  'midas-01', 'midas-02', 'midas-03', 'midas-05',
  'vladd-01', 'vladd-02', 'vladd-03', 'vladd-04', 'vladd-05',
];

export function pickBots(seed, mine) {
  const r = rng(seed ^ 0x51ed270b);
  const pool = CHAR_IDS.filter((c) => c !== mine);
  const bots = [];
  while (bots.length < PLAYERS - 1) {
    const c = pool.splice(Math.floor(r() * pool.length), 1)[0];
    bots.push(c);
  }
  return bots;
}
