import { sprite, chairSprite, image, LEGS, CHARS, FUNDS } from './sprites.js';

export const W = 360;
export const H = 240;
const CX = 180;
const CY = 160;
const WALK = { rx: 138, ry: 56 };
const RING = { rx: 66, ry: 22 };
const DASH_MS = 260;

const INK = '#211B14';
const OX = '#7A2E2E';

function ease(t) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

// Draws the room and the shareholders. Knows nothing about rules or scores.
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.actors = [];
    this.chairs = [];
    this.walking = false;
    this.phase = 0;
    this.speed = 0.55;
    this.stamps = [];
    this.notes = [];
    this.music = null; // { startPerf, stopPerf, fakeouts, fakeoutMs, bpm }
    this.caption = null;
    this.scale = 1;
    this.last = performance.now();
    this.portraits = [image('/portraits/argon-04.png'), image('/portraits/midas-05.png')];
    this.medallion = image('/brand/medallion-384.png');
    this.resize();
    this._raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // CSS size fills the box; the backing store is a whole multiple of the pixel art
    const fit = Math.max(0.5, Math.min((box.width - 2) / W, (window.innerHeight * 0.62) / H));
    const k = Math.max(1, Math.ceil(fit * dpr));
    this.scale = k;
    this.canvas.width = W * k;
    this.canvas.height = H * k;
    this.canvas.style.width = `${Math.floor(W * fit)}px`;
    this.canvas.style.height = `${Math.floor(H * fit)}px`;
  }

  // cast: [{ id, char, you }]
  setCast(cast, chairs) {
    this.actors = cast.map((c, i) => ({
      ...c,
      state: 'walk',
      angle: Math.PI / 2 + (i * 2 * Math.PI) / cast.length,
      x: 0,
      y: 0,
      chair: -1,
      step: 0,
      alpha: 1,
    }));
    this.actors.forEach((a) => this._placeOnRing(a));
    this.setChairs(chairs);
  }

  setChairs(n) {
    this.chairs = [];
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n;
      const r = n === 1 ? 0 : 1;
      this.chairs.push({ x: CX + Math.cos(ang) * RING.rx * r, y: CY + Math.sin(ang) * RING.ry * r + 4, by: null });
    }
  }

  _placeOnRing(a) {
    a.x = CX + Math.cos(a.angle) * WALK.rx;
    a.y = CY + Math.sin(a.angle) * WALK.ry;
  }

  // Everyone stands up and spreads around the ring.
  regroup(cast, chairs) {
    const alive = this.actors.filter((a) => cast.some((c) => c.id === a.id));
    alive.forEach((a, i) => {
      a.fromX = a.x;
      a.fromY = a.y;
      a.angle = Math.PI / 2 + (i * 2 * Math.PI) / alive.length;
      a.state = 'return';
      a.t0 = performance.now();
      a.chair = -1;
    });
    this.actors = alive;
    this.setChairs(chairs);
    this.stamps = [];
  }

  startMusic(m) {
    this.music = m;
    this.walking = true;
  }

  freeze() {
    this.walking = false;
    this.music = null;
  }

  // Send an actor to the nearest free chair. Returns false if none is left.
  claim(id) {
    const a = this.actors.find((x) => x.id === id);
    if (!a || a.state === 'dash' || a.state === 'seated') return true;
    let best = -1;
    let bd = Infinity;
    this.chairs.forEach((c, i) => {
      if (c.by) return;
      const d = Math.hypot(c.x - a.x, (c.y - a.y) * 2);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) return false;
    this.chairs[best].by = id;
    a.chair = best;
    a.state = 'dash';
    a.fromX = a.x;
    a.fromY = a.y;
    a.t0 = performance.now();
    return true;
  }

  eliminate(id) {
    const a = this.actors.find((x) => x.id === id);
    if (a) a.state = 'out';
  }

  stamp(text, color = OX, sub = '') {
    this.stamps.push({ text, color, sub, t0: performance.now() });
  }

  clearStamps() {
    this.stamps = [];
  }

  frame = (now) => {
    const dt = Math.min(50, now - this.last);
    this.last = now;
    this.update(now, dt);
    this.draw(now);
    this._raf = requestAnimationFrame(this.frame);
  };

  update(now, dt) {
    const m = this.music;
    const playing = m && now >= m.startPerf && now < m.stopPerf;
    let moving = this.walking && playing;
    for (const a of this.actors) {
      if (a.state === 'walk') {
        if (moving) {
          const sp = this.speed * (m.bpm / 112);
          a.angle -= (sp * dt) / 1000;
          a.step += (dt / 1000) * (m.bpm / 60) * 2;
          this._placeOnRing(a);
        }
      } else if (a.state === 'return') {
        const t = ease((now - a.t0) / 700);
        const tx = CX + Math.cos(a.angle) * WALK.rx;
        const ty = CY + Math.sin(a.angle) * WALK.ry;
        a.x = a.fromX + (tx - a.fromX) * t;
        a.y = a.fromY + (ty - a.fromY) * t;
        a.step += dt / 90;
        if (t >= 1) {
          a.state = 'walk';
          a.step = 0;
        }
      } else if (a.state === 'dash') {
        const c = this.chairs[a.chair];
        const t = ease((now - a.t0) / DASH_MS);
        a.x = a.fromX + (c.x - a.fromX) * t;
        a.y = a.fromY + (c.y - a.fromY) * t;
        a.step += dt / 40;
        if (t >= 1) a.state = 'seated';
      } else if (a.state === 'out') {
        a.alpha = Math.max(0.35, a.alpha - dt / 2000);
      }
    }
    // floating notes from the radio while the tune plays
    if (playing) {
      const t = now - m.startPerf;
      const fake = m.fakeouts.some((f) => t >= f && t < f + m.fakeoutMs);
      if (!fake && Math.random() < dt / 260) this.notes.push({ x: 318, y: 60, vx: -4 - Math.random() * 8, t0: now });
    }
    this.notes = this.notes.filter((n) => now - n.t0 < 1600);
  }

  draw(now) {
    const g = this.ctx;
    const k = this.scale;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.imageSmoothingEnabled = false;
    this.drawRoom(g, now);

    // chairs and people, back to front
    const items = [];
    this.chairs.forEach((c) => items.push({ y: c.y, draw: () => this.drawChair(g, c) }));
    for (const a of this.actors) {
      items.push({ y: a.state === 'seated' ? this.chairs[a.chair].y + 0.5 : a.y, draw: () => this.drawActor(g, a, now) });
    }
    items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());

    for (const a of this.actors) if (a.you && a.state !== 'gone') this.drawYouTag(g, a, now);
    this.drawNotes(g, now);
    this.drawStamps(g, now);
    if (this.caption) this.drawCaption(g, this.caption);
  }

  drawRoom(g, now) {
    // wall
    g.fillStyle = '#F6EFE3';
    g.fillRect(0, 0, W, 82);
    g.fillStyle = '#EDE3CF';
    for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 1, 74);
    // wainscot and skirting
    g.fillStyle = '#7A2E2E';
    g.fillRect(0, 74, W, 6);
    g.fillStyle = '#5E2222';
    g.fillRect(0, 79, W, 2);
    g.fillStyle = '#B08A3C';
    g.fillRect(0, 74, W, 1);
    // floor, a warm carpet
    g.fillStyle = '#E4D6BA';
    g.fillRect(0, 81, W, H - 81);
    g.fillStyle = '#D8CCB4';
    for (let y = 84; y < H; y += 5) for (let x = (y % 10) * 0.6; x < W; x += 6) g.fillRect(x, y, 1, 1);
    // rug under the chairs
    g.fillStyle = '#B08A3C';
    this.ellipse(g, CX, CY + 6, 104, 38);
    g.fillStyle = '#7A2E2E';
    this.ellipse(g, CX, CY + 6, 101, 36);
    g.fillStyle = '#5E2222';
    this.ellipse(g, CX, CY + 6, 90, 31);
    g.fillStyle = '#7A2E2E';
    this.ellipse(g, CX, CY + 6, 88, 30);

    // two portraits and the house mark on the wall
    const frame = (x, y, s) => {
      g.fillStyle = '#46291a';
      g.fillRect(x - 2, y - 2, s + 4, s + 4);
    };
    const [p1, p2] = this.portraits;
    frame(26, 6, 48);
    if (p1.complete) g.drawImage(p1, 26, 6, 48, 48);
    frame(W - 74, 6, 48);
    if (p2.complete) g.drawImage(p2, W - 74, 6, 48, 48);
    if (this.medallion.complete) {
      g.imageSmoothingEnabled = true;
      g.drawImage(this.medallion, CX - 22, 8, 44, 44);
      g.imageSmoothingEnabled = false;
    }
    // clock
    g.fillStyle = '#211B14';
    g.fillRect(CX - 70, 16, 18, 18);
    g.fillStyle = '#FDF8EE';
    g.fillRect(CX - 69, 17, 16, 16);
    g.fillStyle = '#211B14';
    const sec = (now / 1000) % 60;
    const ang = (sec / 60) * Math.PI * 2 - Math.PI / 2;
    this.pixLine(g, CX - 61, 25, CX - 61 + Math.cos(ang) * 6, 25 + Math.sin(ang) * 6);
    this.pixLine(g, CX - 61, 25, CX - 61, 20);
    // the radio on a side table
    g.fillStyle = '#46291a';
    g.fillRect(300, 70, 36, 3);
    g.fillRect(304, 73, 3, 18);
    g.fillRect(329, 73, 3, 18);
    g.fillStyle = '#6B4423';
    g.fillRect(304, 56, 28, 14);
    g.fillStyle = '#EDE3CF';
    g.fillRect(307, 59, 12, 8);
    g.fillStyle = '#B08A3C';
    g.fillRect(322, 59, 3, 3);
    g.fillRect(326, 59, 3, 3);
    g.fillStyle = '#D8CCB4';
    for (let y = 60; y < 67; y += 2) g.fillRect(308, y, 10, 1);
  }

  ellipse(g, cx, cy, rx, ry) {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
      g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }

  pixLine(g, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  }

  drawChair(g, c) {
    const s = chairSprite();
    g.drawImage(s, Math.round(c.x - 16), Math.round(c.y - 44));
  }

  drawActor(g, a, now) {
    if (a.state === 'gone') return;
    const sp = sprite(a.char);
    g.globalAlpha = a.alpha;
    let x;
    let y;
    if (a.state === 'seated') {
      const c = this.chairs[a.chair];
      x = Math.round(c.x - sp.w / 2);
      y = Math.round(c.y - sp.h);
      g.drawImage(sp.whole, x, y);
    } else {
      x = Math.round(a.x - sp.w / 2);
      y = Math.round(a.y - sp.h);
      const moving = a.state === 'dash' || a.state === 'return' || (a.state === 'walk' && this.walking && this.music);
      const f = moving ? Math.floor(a.step) % 2 : -1;
      const hop = a.state === 'dash' ? -Math.round(Math.sin(Math.min(1, (now - a.t0) / DASH_MS) * Math.PI) * 5) : 0;
      const bob = f === 1 ? -1 : 0;
      // shadow
      g.fillStyle = 'rgba(33,27,20,0.18)';
      g.fillRect(x + 2, Math.round(a.y) - 1, sp.w - 4, 2);
      g.drawImage(sp.body, x, y + bob + hop);
      g.drawImage(sp.legL, x, y + sp.h - LEGS + hop + (f === 0 ? -1 : 0));
      g.drawImage(sp.legR, x + sp.mid, y + sp.h - LEGS + hop + (f === 1 ? -1 : 0));
    }
    g.globalAlpha = 1;
    if (a.state === 'out') {
      g.fillStyle = OX;
      g.font = `bold 7px "IBM Plex Mono", monospace`;
      g.textAlign = 'center';
      g.fillText('NO SEAT', x + sp.w / 2, y - 4);
    }
  }

  drawYouTag(g, a, now) {
    const sp = sprite(a.char);
    let x = a.x;
    let y = a.y - sp.h;
    if (a.state === 'seated') {
      const c = this.chairs[a.chair];
      x = c.x;
      y = c.y - sp.h;
    }
    const bounce = Math.floor(now / 300) % 2;
    x = Math.round(x);
    y = Math.round(y) - 6 - bounce;
    g.fillStyle = OX;
    g.fillRect(x - 3, y, 7, 1);
    g.fillRect(x - 2, y + 1, 5, 1);
    g.fillRect(x - 1, y + 2, 3, 1);
    g.fillRect(x, y + 3, 1, 1);
    g.font = `bold 7px "IBM Plex Mono", monospace`;
    g.textAlign = 'center';
    g.fillText('YOU', x + 0.5, y - 2);
  }

  drawNotes(g, now) {
    g.fillStyle = INK;
    for (const n of this.notes) {
      const t = (now - n.t0) / 1000;
      const x = Math.round(n.x + n.vx * t * 3);
      const y = Math.round(n.y - t * 22);
      g.globalAlpha = Math.max(0, 1 - t / 1.6);
      g.fillRect(x, y, 1, 5);
      g.fillRect(x - 2, y + 4, 2, 2);
      g.fillRect(x + 1, y, 2, 1);
    }
    g.globalAlpha = 1;
  }

  drawStamps(g, now) {
    for (const s of this.stamps) {
      const t = Math.min(1, (now - s.t0) / 180);
      const sc = 1.6 - 0.6 * t;
      g.save();
      g.translate(CX, 112);
      g.rotate(-0.12);
      g.scale(sc, sc);
      g.globalAlpha = 0.92 * t;
      g.font = `700 26px "Libre Caslon Text", Georgia, serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const w = g.measureText(s.text).width + 22;
      g.strokeStyle = s.color;
      g.lineWidth = 2.5;
      g.strokeRect(-w / 2, -20, w, 40);
      g.lineWidth = 1;
      g.strokeRect(-w / 2 + 4, -16, w - 8, 32);
      g.fillStyle = s.color;
      g.fillText(s.text, 0, 1);
      if (s.sub) {
        g.font = `600 8px "IBM Plex Mono", monospace`;
        g.fillText(s.sub, 0, 30);
      }
      g.restore();
    }
  }

  drawCaption(g, text) {
    g.save();
    g.font = `600 11px "Libre Caslon Text", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = g.measureText(text).width + 20;
    g.fillStyle = 'rgba(253,248,238,0.94)';
    g.fillRect(CX - w / 2, 88, w, 20);
    g.strokeStyle = INK;
    g.lineWidth = 0.5;
    g.strokeRect(CX - w / 2 + 0.5, 88.5, w - 1, 19);
    g.fillStyle = INK;
    g.fillText(text, CX, 98.5);
    g.restore();
  }
}

export function fundOf(charId) {
  return FUNDS[CHARS[charId].fund];
}
