import { redis } from './_lib.js';

const SITE = 'https://the-last-seat.vercel.app';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// /s/:id : a page whose link preview is that run's certificate. People are sent on to the game.
export default async function handler(req, res) {
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
  const raw = /^[A-Za-z0-9_-]{8,40}$/.test(id) ? await redis().get(`share:${id}`) : null;
  const d = raw ? JSON.parse(raw) : null;
  const title = d
    ? d.won
      ? `${d.name} took The Last Seat`
      : `${d.name} held ${d.rounds} of 4 rounds in The Last Seat`
    : 'The Last Seat';
  const desc = d ? `Score ${d.score}. Musical chairs for The Mutual Fun shareholders.` : 'Musical chairs for The Mutual Fun shareholders.';
  const image = d ? `${SITE}/api/card?id=${id}` : `${SITE}/og.png`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.end(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${SITE}/s/${esc(id)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${image}" />
<meta http-equiv="refresh" content="0; url=${SITE}/" />
</head><body style="background:#F6EFE3;font-family:Georgia,serif">
<p><a href="${SITE}/">Take a seat</a></p>
</body></html>`);
}
