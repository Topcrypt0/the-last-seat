import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { redis, send } from './_lib.js';
import { drawCertificate, CERT_W, CERT_H } from '../shared/certificate.js';
import { CHAR_IDS } from '../shared/game.js';

// Vercel runs functions from the project root; the dev server sets APP_ROOT
const ROOT = process.env.APP_ROOT || process.cwd();
const file = (...p) => fs.readFileSync(path.join(ROOT, ...p));
let ready;
function setup() {
  ready ||= (async () => {
    const fonts = {
      'Libre Caslon Text': ['LibreCaslonText-Regular.ttf', 'LibreCaslonText-Bold.ttf'],
      'IBM Plex Mono': ['IBMPlexMono-Regular.ttf', 'IBMPlexMono-SemiBold.ttf'],
      'Source Serif 4': ['SourceSerif4-Regular.ttf', 'SourceSerif4-Italic.ttf'],
    };
    for (const [family, files] of Object.entries(fonts)) {
      for (const f of files) GlobalFonts.register(file('fonts', f), family);
    }
    return { medallion: await loadImage(file('public/brand/medallion-384.png')) };
  })();
  return ready;
}

// The certificate for one finished, recorded run, as a PNG.
export default async function handler(req, res) {
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return send(res, 400, { error: 'bad id' });
  const raw = await redis().get(`share:${id}`);
  if (!raw) return send(res, 404, { error: 'not found' });
  const data = JSON.parse(raw);
  const { medallion } = await setup();
  const char = CHAR_IDS.includes(data.char) ? data.char : CHAR_IDS[0];
  const cutout = await loadImage(file('public/cutouts', `${char}.png`));
  const canvas = createCanvas(CERT_W, CERT_H);
  drawCertificate(canvas.getContext('2d'), data, { cutout, medallion });
  const png = await canvas.encode('png');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
  res.end(png);
}
