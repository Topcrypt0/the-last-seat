import { redis, send } from './_lib.js';

// Top 100. Cached at the edge for a few seconds.
export default async function handler(req, res) {
  const r = redis();
  const flat = await r.zrevrange('lb', 0, 99, 'WITHSCORES');
  const rows = [];
  for (let i = 0; i < flat.length; i += 2) rows.push({ id: flat[i], score: Number(flat[i + 1]) });
  const pipe = r.pipeline();
  rows.forEach((row) => pipe.hmget(`user:${row.id}`, 'name', 'bestChar', 'bestRounds', 'fastest', 'wins', 'kind'));
  const users = rows.length ? await pipe.exec() : [];
  const total = await r.zcard('lb');
  const board = rows.map((row, i) => {
    const [name, char, rounds, fastest, wins, kind] = users[i][1] || [];
    return {
      rank: i + 1,
      name: name || 'anonymous',
      char,
      score: row.score,
      rounds: Number(rounds || 0),
      fastest: fastest ? Number(fastest) : null,
      wins: Number(wins || 0),
      kind,
    };
  });
  send(res, 200, { board, total }, { 'Cache-Control': 's-maxage=5, stale-while-revalidate=20' });
}
