import CHARACTERS from '../data/characters.json';

const KEY = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LEGS = 9; // rows at the bottom that swing when walking

export const CHARS = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
export const CHAR_LIST = CHARACTERS;

export const FUNDS = {
  ARGON: { name: 'The Argon Fund', color: '#49698C', motto: 'Noble, inert, and unmoved by the news.' },
  BOGLE: { name: 'The Bogle Fund', color: '#4E8A5A', motto: 'Buys the whole haystack.' },
  SMAUG: { name: 'The Smaug Fund', color: '#9C5248', motto: 'Sleeps on the pile and knows every coin in it.' },
  MIDAS: { name: 'The Midas Fund', color: '#B9902F', motto: 'Everything it touches, marked to gold.' },
  VLADD: { name: 'The Vladd Fund', color: '#6E5D8C', motto: 'Buys when there is blood in the streets.' },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Pixel rows of a character, drawn 1:1 into a canvas; x0/x1 crop horizontally.
function paint(ch, rowFrom, rowTo, x0 = 0, x1 = ch.w) {
  const c = canvas(ch.w, rowTo - rowFrom);
  const g = c.getContext('2d');
  for (let y = rowFrom; y < rowTo; y++) {
    const row = ch.rows[y];
    for (let x = x0; x < x1; x++) {
      const k = row[x];
      if (k === '.') continue;
      g.fillStyle = ch.pal[KEY.indexOf(k)];
      g.fillRect(x, y - rowFrom, 1, 1);
    }
  }
  return c;
}

const cache = {};
export function sprite(id) {
  if (cache[id]) return cache[id];
  const ch = CHARS[id];
  const mid = Math.floor(ch.w / 2);
  cache[id] = {
    w: ch.w,
    h: ch.h,
    whole: paint(ch, 0, ch.h),
    body: paint(ch, 0, ch.h - LEGS),
    legL: paint(ch, ch.h - LEGS, ch.h, 0, mid),
    legR: paint(ch, ch.h - LEGS, ch.h, mid, ch.w),
    mid,
  };
  return cache[id];
}

// An oxblood wingback, drawn here in the house palette (32 x 44).
let chairCache;
export function chairSprite() {
  if (chairCache) return chairCache;
  const c = canvas(32, 44);
  const g = c.getContext('2d');
  const R = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const line = '#2a1512';
  const ox = '#7A2E2E';
  const deep = '#5E2222';
  const hi = '#9C4A45';
  const gold = '#D4AF37';
  const wood = '#6B4423';
  const woodD = '#46291a';
  // back
  R(5, 0, 22, 29, line);
  R(6, 1, 20, 27, ox);
  R(6, 1, 20, 2, hi);
  R(6, 1, 2, 27, hi);
  R(24, 3, 2, 25, deep);
  for (let y = 6; y < 26; y += 6)
    for (let x = 9 + ((y / 6) % 2) * 3; x < 24; x += 6) {
      R(x, y, 1, 1, gold);
      R(x + 1, y + 1, 1, 1, deep);
    }
  // arms
  R(0, 19, 7, 17, line);
  R(25, 19, 7, 17, line);
  R(1, 20, 5, 15, ox);
  R(26, 20, 5, 15, ox);
  R(1, 20, 5, 2, hi);
  R(26, 20, 5, 2, hi);
  R(4, 22, 2, 13, deep);
  R(29, 22, 2, 13, deep);
  R(2, 23, 1, 1, gold);
  R(27, 23, 1, 1, gold);
  // seat and skirt
  R(6, 28, 20, 9, line);
  R(7, 29, 18, 7, ox);
  R(7, 29, 18, 2, hi);
  R(0, 36, 32, 2, line);
  R(1, 36, 30, 1, deep);
  // legs
  R(2, 38, 3, 6, woodD);
  R(2, 38, 2, 5, wood);
  R(27, 38, 3, 6, woodD);
  R(27, 38, 2, 5, wood);
  R(14, 38, 4, 3, woodD);
  chairCache = c;
  return c;
}

const imgCache = {};
export function image(src) {
  if (!imgCache[src]) {
    const i = new Image();
    i.src = src;
    imgCache[src] = i;
  }
  return imgCache[src];
}
