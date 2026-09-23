// The share image: a certificate of seating, 1200 x 630.
// Drawn with the 2D canvas API so the browser (download, share) and the
// server (the link preview on X) produce the same picture.
import { fundOfChar } from './funds.js';
import { ROUNDS } from './game.js';

export const CERT_W = 1200;
export const CERT_H = 630;

const PAPER = '#F6EFE3';
const RAISED = '#FDF8EE';
const INK = '#211B14';
const MUTED = '#6B5F4E';
const RULE = '#D8CCB4';
const OX = '#7A2E2E';
const GREEN = '#2F6B3D';
const GOLD = '#B08A3C';
const WOOD = '#46291a';

const DISPLAY = '"Libre Caslon Text", Georgia, serif';
const BODY = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", Menlo, monospace';

// data: { name, char, score, rounds, fastest, rank, won, falseStart }
// art: { cutout, medallion } images already loaded
export function drawCertificate(g, data, art) {
  const fund = fundOfChar(data.char);
  g.save();
  g.imageSmoothingEnabled = false;
  g.textBaseline = 'alphabetic';

  // paper and the engraved border
  g.fillStyle = PAPER;
  g.fillRect(0, 0, CERT_W, CERT_H);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.strokeRect(22, 22, CERT_W - 44, CERT_H - 44);
  g.lineWidth = 1;
  g.strokeRect(30, 30, CERT_W - 60, CERT_H - 60);
  g.fillStyle = GOLD;
  for (const [x, y] of [[30, 30], [CERT_W - 30, 30], [30, CERT_H - 30], [CERT_W - 30, CERT_H - 30]]) {
    g.fillRect(x - 5, y - 5, 10, 10);
  }

  // the shareholder on the fund's wall
  const px = 62;
  const py = 62;
  const pw = 400;
  const ph = 506;
  g.fillStyle = WOOD;
  g.fillRect(px - 6, py - 6, pw + 12, ph + 12);
  g.fillStyle = fund.color;
  g.fillRect(px, py, pw, ph);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = px + 10; x < px + pw; x += 20) g.fillRect(x, py, 2, ph - 70);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(px, py + ph - 70, pw, 70);
  if (art.cutout) {
    // 16 source pixels per art pixel, drawn at 7 per art pixel: whole pixels, no smoothing
    const cw = (art.cutout.width / 16) * 7;
    const ch = (art.cutout.height / 16) * 7;
    g.drawImage(art.cutout, Math.round(px + (pw - cw) / 2), Math.round(py + ph - 44 - ch), Math.round(cw), Math.round(ch));
  }
  g.fillStyle = RAISED;
  g.font = `600 17px ${MONO}`;
  g.textAlign = 'center';
  g.fillText(fund.name.toUpperCase(), px + pw / 2, py + ph - 16);

  // the text side
  const x0 = 510;
  g.textAlign = 'left';
  g.fillStyle = OX;
  g.font = `600 17px ${MONO}`;
  spaced(g, 'CERTIFICATE OF SEATING', x0, 96, 3);
  g.fillStyle = INK;
  g.font = `700 60px ${DISPLAY}`;
  g.fillText('The Last Seat', x0, 158);
  g.fillStyle = RULE;
  g.fillRect(x0, 180, 630, 1);
  g.fillRect(x0, 184, 630, 1);

  g.fillStyle = MUTED;
  g.font = `italic 22px ${BODY}`;
  g.fillText('This certifies that', x0, 226);
  g.fillStyle = INK;
  g.font = `400 ${fit(g, data.name, 52, 600, DISPLAY)}px ${DISPLAY}`;
  g.fillText(data.name, x0, 284);
  g.font = `400 24px ${BODY}`;
  g.fillStyle = INK;
  const line = data.won
    ? 'took the last seat in a game of musical chairs.'
    : data.falseStart
      ? `sat down while the music was still playing, in round ${data.rounds + 1}.`
      : `held ${data.rounds} of ${ROUNDS} rounds before the music caught them.`;
  g.fillText(line, x0, 322);

  // figures
  const figs = [
    ['SCORE', String(data.score)],
    ['ROUNDS', `${data.rounds}/${ROUNDS}`],
    ['FASTEST', data.fastest ? `${Math.round(data.fastest)} ms` : 'n/a'],
  ];
  if (data.rank) figs.push(['RANK', `#${data.rank}`]);
  let fx = x0;
  for (const [label, value] of figs) {
    g.fillStyle = MUTED;
    g.font = `400 15px ${MONO}`;
    spaced(g, label, fx, 378, 1.5);
    g.fillStyle = INK;
    g.font = `600 36px ${MONO}`;
    g.fillText(value, fx, 420);
    fx += Math.max(130, g.measureText(value).width + 36);
  }

  // footer
  g.fillStyle = RULE;
  g.fillRect(x0, 470, 630, 1);
  if (art.medallion) {
    g.imageSmoothingEnabled = true;
    g.drawImage(art.medallion, x0, 490, 64, 64);
    g.imageSmoothingEnabled = false;
  }
  g.fillStyle = INK;
  g.font = `600 22px ${MONO}`;
  g.fillText('the-last-seat.vercel.app', x0 + 80, 516);
  g.fillStyle = MUTED;
  g.font = `400 19px ${BODY}`;
  g.fillText('A fan game by @UltraICO for @themutualfun', x0 + 80, 546);

  // the verdict, stamped
  const verdict = data.won ? 'ADMITTED' : data.falseStart ? 'FLAGGED' : 'DECLINED';
  const col = data.won ? GREEN : OX;
  g.save();
  g.translate(1030, 118);
  g.rotate(-0.16);
  g.globalAlpha = 0.9;
  g.font = `700 34px ${DISPLAY}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(verdict).width + 36;
  g.strokeStyle = col;
  g.lineWidth = 4;
  g.strokeRect(-w / 2, -30, w, 60);
  g.lineWidth = 1.5;
  g.strokeRect(-w / 2 + 6, -24, w - 12, 48);
  g.fillStyle = col;
  g.fillText(verdict, 0, 2);
  g.restore();

  g.restore();
}

function spaced(g, text, x, y, gap) {
  let cx = x;
  for (const ch of text) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + gap;
  }
}

function fit(g, text, size, maxW, family) {
  let s = size;
  g.font = `400 ${s}px ${family}`;
  while (s > 24 && g.measureText(text).width > maxW) {
    s -= 2;
    g.font = `400 ${s}px ${family}`;
  }
  return s;
}
