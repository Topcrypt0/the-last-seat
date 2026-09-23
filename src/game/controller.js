import { Stage } from './engine.js';
import { Music } from './audio.js';
import { ROUNDS } from '../../shared/game.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OX = '#7A2E2E';
const GREEN = '#2F6B3D';

// Runs one game: music, the scramble for chairs, and talking to the run (local or server).
export class Game {
  constructor(canvas, onUi) {
    this.stage = new Stage(canvas);
    this.music = new Music();
    this.onUi = onUi;
    this.phase = 'idle';
    this.token = 0;
  }

  destroy() {
    this.token++;
    this.music.stopNow();
    this.stage.destroy();
  }

  preview(char, others) {
    const cast = [{ id: 'you', char, you: true }, ...others.map((c) => ({ id: c, char: c }))];
    this.stage.setCast(cast, cast.length - 1);
  }

  // The one button: keyboard, mouse or finger. `ts` is the event timestamp.
  press(ts = performance.now()) {
    if (this.phase === 'music') {
      if (ts >= this.stopPerf) return this._sit(ts);
      return this._falseStart();
    }
    if (this.phase === 'scramble') return this._sit(ts);
  }

  _sit(ts) {
    if (this.reaction !== undefined) return;
    this.reaction = Math.max(0, ts - this.stopPerf);
    this.stage.claim('you');
    this.music.thump();
    this._checkFull();
  }

  _falseStart() {
    if (this.reaction !== undefined) return;
    this.reaction = null;
    this.music.stopNow();
    this.stage.freeze();
    this.phase = 'scramble';
    this.stopPerf = performance.now();
    // everyone else takes a seat while you stand there
    this.botTimers.forEach(clearTimeout);
    Object.keys(this.params.botReactions).forEach((id, i) => setTimeout(() => this.stage.claim(id), 150 + i * 90));
    setTimeout(() => this._finishScramble(), 150 + Object.keys(this.params.botReactions).length * 90 + 300);
  }

  _checkFull() {
    const taken = this.stage.chairs.filter((c) => c.by).length;
    if (taken >= this.stage.chairs.length) this._finishScramble();
  }

  _finishScramble() {
    if (this.phase !== 'scramble' && this.phase !== 'music') return;
    this.phase = 'settle';
    if (this.reaction === undefined) this.reaction = Math.round(performance.now() - this.stopPerf);
    this.botTimers.forEach(clearTimeout);
    this.resolveRound?.();
  }

  async play(run, char) {
    const my = ++this.token;
    this.music.unlock();
    this.onUi({ state: 'loading' });
    let deal;
    try {
      deal = await run.start(char);
    } catch (e) {
      this.onUi({ state: 'error', error: e.message });
      return;
    }
    if (my !== this.token) return;
    const cast = [{ id: 'you', char, you: true }, ...deal.bots.map((c) => ({ id: c, char: c }))];
    this.stage.setCast(cast, deal.params.chairs);
    let params = deal.params;
    let score = 0;
    const log = [];

    for (let round = 1; round <= ROUNDS; round++) {
      this.params = params;
      const players = params.chairs + 1;
      this.onUi({ state: 'ready', round, players, chairs: params.chairs, score });
      this.stage.caption = `Round ${round} of ${ROUNDS}. ${players} shareholders, ${params.chairs} ${params.chairs === 1 ? 'chair' : 'chairs'}.`;
      await wait(1700);
      if (my !== this.token) return;
      this.stage.caption = null;

      // music
      this.reaction = undefined;
      const { startPerf, stopPerf } = this.music.playRound(params, round);
      this.stopPerf = stopPerf;
      this.stage.startMusic({ ...params, startPerf, stopPerf });
      this.phase = 'music';
      this.onUi({ state: 'music', round, players, chairs: params.chairs, score });

      const done = new Promise((r) => (this.resolveRound = r));
      this.botTimers = [];
      const toStop = stopPerf - performance.now();
      this.botTimers.push(
        setTimeout(() => {
          if (this.phase !== 'music') return;
          this.phase = 'scramble';
          this.stage.freeze();
          this.onUi({ state: 'scramble', round, players, chairs: params.chairs, score });
        }, toStop),
      );
      for (const [id, ms] of Object.entries(params.botReactions)) {
        this.botTimers.push(
          setTimeout(() => {
            if (this.phase !== 'scramble' && this.phase !== 'music') return;
            this.stage.claim(id);
            this._checkFull();
          }, toStop + ms),
        );
      }
      // nobody presses: the round still ends
      this.botTimers.push(setTimeout(() => this._finishScramble(), toStop + 3200));
      await done;
      if (my !== this.token) return;

      this.onUi({ state: 'checking', round, players, chairs: params.chairs, score });
      let res;
      try {
        res = await run.report(round, this.reaction);
      } catch (e) {
        this.onUi({ state: 'error', error: e.message });
        return;
      }
      if (my !== this.token) return;
      await wait(350);
      score = res.score;
      log.push({ round, reaction: this.reaction, survived: res.result.survived });

      if (res.result.survived) {
        this.stage.eliminate(res.result.out);
        const last = round === ROUNDS;
        if (last) {
          this.stage.stamp('ADMITTED', GREEN, 'THE LAST SEAT IS YOURS');
          this.music.win();
        } else {
          this.stage.stamp('ADMITTED', GREEN, `${Math.round(this.reaction)} MS  +${res.result.points}`);
          this.music.stamp();
        }
        this.onUi({ state: last ? 'won' : 'survived', round, score, reaction: this.reaction, best: res.best, log, scored: run.scored });
        if (last) return;
        await wait(1900);
        if (my !== this.token) return;
        const alive = [{ id: 'you' }, ...Object.keys(res.next.botReactions).map((id) => ({ id }))];
        this.stage.regroup(alive, res.next.chairs);
        params = res.next;
        await wait(700);
      } else {
        this.stage.eliminate('you');
        if (res.result.falseStart) {
          this.stage.stamp('FLAGGED', OX, res.flagged ? 'TIMING DID NOT CHECK OUT' : 'SAT BEFORE THE MUSIC STOPPED');
        } else {
          this.stage.stamp('DECLINED', OX, `${Math.round(this.reaction)} MS, THE SLOWEST IN THE ROOM`);
        }
        this.music.out();
        this.onUi({ state: 'lost', round, score, reaction: this.reaction, best: res.best, log, scored: run.scored, falseStart: res.result.falseStart });
        return;
      }
    }
  }

  abort() {
    this.token++;
    this.phase = 'idle';
    this.music.stopNow();
    this.stage.freeze();
    this.stage.clearStamps();
    this.stage.caption = null;
    this.botTimers?.forEach(clearTimeout);
  }
}
