// "Quarterly Shuffle", an original chiptune written for this game.
// Everything is synthesized with Web Audio, no files. A whole round is
// scheduled ahead of time so the stop lands on an exact sample.

const MELODY_A = [
  [72, 76, 79, 76, 74, 76, 72, null],
  [69, 72, 76, 72, 71, 72, 69, null],
  [65, 69, 72, 77, 76, 74, 72, 69],
  [67, 71, 74, 79, 77, 76, 74, 71],
];
const MELODY_B = [
  [79, null, 79, 77, 76, null, 72, null],
  [76, null, 76, 74, 72, null, 69, null],
  [77, 76, 74, 72, 74, 76, 77, 79],
  [79, 77, 76, 74, 71, null, 67, null],
];
const CHORDS = [
  [48, 55, [60, 64, 67]], // C
  [45, 52, [57, 60, 64]], // Am
  [41, 48, [57, 60, 65]], // F
  [43, 50, [59, 62, 67]], // G
];

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const pulse = (duty) => {
        const n = 32;
        const re = new Float32Array(n);
        const im = new Float32Array(n);
        for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
        return this.ctx.createPeriodicWave(re, im);
      };
      this.waves = { lead: pulse(0.25), stab: pulse(0.125) };
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.gain.value = m ? 0 : 1;
  }

  _note(bus, wave, freq, t, dur, vol, type) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    if (type) o.type = type;
    else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + Math.max(0.005, dur - 0.02));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  _hat(bus, t, vol, len = 0.03) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.3, len + 0.01);
  }

  _kick(bus, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.13);
  }

  // Schedule one round. Returns the performance.now() time the music stops.
  playRound({ bpm, duration, fakeouts, fakeoutMs }, variant = 0) {
    const ctx = this.unlock();
    this.stopNow();
    const bus = ctx.createGain();
    bus.gain.value = this.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    bus.connect(comp).connect(ctx.destination);
    this.bus = bus;

    const t0 = ctx.currentTime + 0.12;
    const end = t0 + duration / 1000;
    const eighth = 60 / bpm / 2;
    const swing = eighth * 0.16;
    const windows = fakeouts.map((f) => [t0 + f / 1000, t0 + (f + fakeoutMs) / 1000]);
    const inFake = (t) => windows.some(([a, b]) => t >= a - 0.005 && t < b);
    const melody = variant % 2 ? [...MELODY_B, ...MELODY_A] : [...MELODY_A, ...MELODY_B];

    let step = 0;
    for (let t = t0; t < end - 0.01; t += eighth, step++) {
      const st = step % 2 ? t + swing : t; // a little shuffle
      if (inFake(st)) continue;
      const bar = Math.floor(step / 8) % 8;
      const i = step % 8;
      const chord = CHORDS[bar % 4];
      const room = end - st;
      const n = melody[bar][i];
      if (n !== null) this._note(bus, this.waves.lead, hz(n), st, Math.min(eighth * 0.9, room), 0.09);
      if (i % 2 === 0) {
        const bassN = i % 4 === 0 ? chord[0] : chord[1];
        this._note(bus, null, hz(bassN), st, Math.min(eighth * 1.6, room), 0.22, 'triangle');
      } else {
        for (const c of chord[2]) this._note(bus, this.waves.stab, hz(c), st, Math.min(eighth * 0.35, room), 0.025);
      }
      if (i % 4 === 0) this._kick(bus, st);
      if (i % 4 === 2) this._hat(bus, st, 0.18, 0.09);
      this._hat(bus, st, 0.05);
    }
    // the fake stop: everything drops out but one held low note
    for (const [a, b] of windows) {
      this._note(bus, null, hz(43), a, b - a, 0.16, 'triangle');
    }
    // hard stop at `end`
    bus.gain.setValueAtTime(this.muted ? 0 : 1, end - 0.001);
    bus.gain.setValueAtTime(0, end);

    const latency = (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
    const now = performance.now();
    return {
      startPerf: now + (t0 - ctx.currentTime) * 1000 + latency,
      stopPerf: now + (end - ctx.currentTime) * 1000 + latency,
    };
  }

  stopNow() {
    if (this.bus) {
      try {
        this.bus.gain.cancelScheduledValues(0);
        this.bus.gain.value = 0;
        this.bus.disconnect();
      } catch {}
      this.bus = null;
    }
  }

  _sfxBus() {
    const ctx = this.unlock();
    const g = ctx.createGain();
    g.gain.value = this.muted ? 0 : 1;
    g.connect(ctx.destination);
    return g;
  }

  thump() {
    const bus = this._sfxBus();
    const t = this.ctx.currentTime;
    this._kick(bus, t);
    this._note(bus, null, hz(40), t, 0.08, 0.2, 'square');
  }

  stamp() {
    const bus = this._sfxBus();
    const t = this.ctx.currentTime;
    this._kick(bus, t);
    this._hat(bus, t, 0.4, 0.12);
  }

  out() {
    const bus = this._sfxBus();
    const t = this.ctx.currentTime;
    [60, 59, 58, 55].forEach((m, i) => this._note(bus, null, hz(m), t + i * 0.22, i === 3 ? 0.6 : 0.2, 0.12, 'square'));
  }

  win() {
    const bus = this._sfxBus();
    const t = this.ctx.currentTime;
    [72, 76, 79, 84, 79, 84].forEach((m, i) =>
      this._note(bus, this.waves.lead, hz(m), t + i * 0.12, i === 5 ? 0.7 : 0.11, 0.12),
    );
    [48, 55, 60].forEach((m) => this._note(bus, null, hz(m), t + 0.6, 0.8, 0.15, 'triangle'));
  }
}
