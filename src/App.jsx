import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { Game } from './game/controller.js';
import { CHAR_LIST, CHARS, FUNDS, sprite } from './game/sprites.js';
import { RemoteRun, LocalRun, api } from './runs.js';
import { walletSignIn, hasWallet } from './wallet.js';
import { CHAR_IDS, ROUNDS } from '../shared/game.js';
import { makeCertificate } from './certificate.js';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;
const PrivySignIn = PRIVY_APP_ID ? lazy(() => import('./privy.jsx')) : null;
const REPO = 'https://github.com/Topcrypt0/the-last-seat';
const AUTHOR = '@UltraICO';
const SITE = typeof location !== 'undefined' ? location.origin : '';

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

function Sprite({ id, scale = 2, bg }) {
  const ref = useRef(null);
  useEffect(() => {
    const s = sprite(id);
    const c = ref.current;
    const pad = 3;
    c.width = (s.w + pad * 2) * scale;
    c.height = (s.h + pad) * scale;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, c.width, c.height);
    }
    g.drawImage(s.whole, pad * scale, pad * scale, s.w * scale, s.h * scale);
  }, [id, scale, bg]);
  return <canvas ref={ref} className="sprite" aria-label={CHARS[id].chair} />;
}

function randomOthers(mine) {
  const pool = CHAR_IDS.filter((c) => c !== mine);
  const out = [];
  while (out.length < 4) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [ui, setUi] = useState({ state: 'menu' });
  const [char, setChar] = useState(() => {
    const c = store.get('tls.char');
    return CHAR_IDS.includes(c) ? c : CHAR_IDS[Math.floor(Math.random() * CHAR_IDS.length)];
  });
  const [session, setSession] = useState(() => store.get('tls.session'));
  const [me, setMe] = useState(null);
  const [board, setBoard] = useState(null);
  const [authMsg, setAuthMsg] = useState('');
  const [muted, setMuted] = useState(() => store.get('tls.muted') === '1');
  const [nameDraft, setNameDraft] = useState('');
  const [cert, setCert] = useState(null);

  // stage
  useEffect(() => {
    const g = new Game(canvasRef.current, (u) => setUi(u));
    gameRef.current = g;
    g.preview(char, randomOthers(char));
    const onResize = () => g.stage.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      g.destroy();
    };
  }, []);

  useEffect(() => {
    gameRef.current?.music.setMuted(muted);
    store.set('tls.muted', muted ? '1' : '0');
  }, [muted]);

  const inGame = ['loading', 'ready', 'music', 'scramble', 'checking', 'survived'].includes(ui.state);

  useEffect(() => {
    store.set('tls.char', char);
    if (!inGame) gameRef.current?.preview(char, randomOthers(char));
  }, [char]);

  // one button: space, enter, or any letter; mouse and touch go through the stage and the big button
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT') return;
      if (e.code === 'Space' || e.code === 'Enter' || /^Key[A-Z]$/.test(e.code) || e.code.startsWith('Arrow')) {
        if (['music', 'scramble'].includes(ui.state)) {
          e.preventDefault();
          gameRef.current.press(e.timeStamp);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.state]);

  const loadBoard = useCallback(async () => {
    try {
      setBoard(await api('/api/leaderboard'));
    } catch {
      setBoard({ board: [], total: 0, offline: true });
    }
  }, []);

  const loadMe = useCallback(async (s = session) => {
    if (!s) return setMe(null);
    try {
      const { user } = await api('/api/me', { session: s });
      setMe(user);
      setNameDraft(user.name || '');
    } catch (e) {
      if (e.status === 401) {
        store.set('tls.session', null);
        setSession(null);
        setMe(null);
      }
    }
  }, [session]);

  useEffect(() => {
    loadBoard();
    loadMe();
  }, []);

  useEffect(() => {
    if (ui.state === 'won' || ui.state === 'lost') {
      loadBoard();
      loadMe();
    }
  }, [ui.state]);

  // the share certificate for a finished run
  useEffect(() => {
    if (ui.state !== 'won' && ui.state !== 'lost') return setCert(null);
    const won = ui.state === 'won';
    const reactions = (ui.log || []).filter((l) => l.survived && l.reaction !== null).map((l) => l.reaction);
    const data = ui.best?.share || {
      name: me?.name || 'A guest shareholder',
      char,
      score: ui.score,
      rounds: won ? ROUNDS : ui.round - 1,
      fastest: reactions.length ? Math.min(...reactions) : null,
      rank: null,
      won,
      falseStart: !!ui.falseStart,
    };
    let url;
    makeCertificate(data)
      .then(({ blob, url: u }) => {
        url = u;
        setCert({ url: u, file: new File([blob], 'the-last-seat.png', { type: 'image/png' }) });
      })
      .catch(() => setCert(null));
    return () => url && URL.revokeObjectURL(url);
  }, [ui.state, ui.best]);

  const onSession = (s, user) => {
    store.set('tls.session', s);
    setSession(s);
    setMe(user);
    setNameDraft(user.name || '');
    setAuthMsg('');
    loadMe(s);
  };

  const signInWallet = async () => {
    setAuthMsg('Waiting for your wallet.');
    try {
      const { session: s, user } = await walletSignIn();
      onSession(s, user);
    } catch (e) {
      setAuthMsg(e.message || 'Wallet sign in failed.');
    }
  };

  const signOut = () => {
    store.set('tls.session', null);
    setSession(null);
    setMe(null);
  };

  const saveName = async (e) => {
    e.preventDefault();
    try {
      const { user } = await api('/api/me', { method: 'POST', body: { name: nameDraft }, session });
      setMe(user);
      setAuthMsg('Name filed.');
      loadBoard();
    } catch (err) {
      setAuthMsg(err.message);
    }
  };

  const start = () => {
    const run = session ? new RemoteRun(session) : new LocalRun();
    gameRef.current.abort();
    gameRef.current.play(run, char);
  };

  const quit = () => {
    gameRef.current.abort();
    gameRef.current.preview(char, randomOthers(char));
    setUi({ state: 'menu' });
  };

  const press = (e) => {
    e.preventDefault();
    gameRef.current.press(e.timeStamp);
  };

  const fund = FUNDS[CHARS[char].fund];
  const over = ui.state === 'won' || ui.state === 'lost';
  const roundsHeld = over ? (ui.state === 'won' ? ROUNDS : ui.round - 1) : 0;
  const shareText = over
    ? ui.state === 'won'
      ? `I took The Last Seat. Four rounds of musical chairs, one chair left, and it is mine. Score ${ui.score}.\n\nA fan game for @themutualfun by ${AUTHOR}`
      : `I held ${roundsHeld} of ${ROUNDS} rounds in The Last Seat before the music caught me. Score ${ui.score}.\n\nA fan game for @themutualfun by ${AUTHOR}`
    : '';
  // a recorded run gets its own link, whose preview on X is the certificate
  const shareLink = ui.best?.shareId ? `${SITE}/s/${ui.best.shareId}` : SITE;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareLink)}`;
  const canShareFiles = cert && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [cert.file] });

  const shareImage = async () => {
    try {
      await navigator.share({ files: [cert.file], text: `${shareText}\n${shareLink}` });
    } catch {}
  };

  return (
    <div className="page">
      <header className="masthead">
        <img src="/brand/medallion-384.png" alt="" className="mark" />
        <div>
          <p className="kicker">A game of musical chairs for shareholders</p>
          <h1>The Last Seat</h1>
          <p className="byline">
            Made by <a href="https://x.com/UltraICO" target="_blank" rel="noreferrer"><strong>Ultra Goat</strong></a> for The Mutual Fun
          </p>
        </div>
        <button className="mute" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </header>

      <main>
        <section className="room">
          <div
            className={`stage ${['music', 'scramble'].includes(ui.state) ? 'live' : ''}`}
            onPointerDown={(e) => ['music', 'scramble'].includes(ui.state) && press(e)}
          >
            <canvas ref={canvasRef} />
          </div>

          {inGame && (
            <div className="controls">
              <div className="status mono">
                <span>Round {ui.round || 1} of {ROUNDS}</span>
                <span>{ui.chairs ? `${ui.chairs + 1} standing, ${ui.chairs} ${ui.chairs === 1 ? 'chair' : 'chairs'}` : ''}</span>
                <span>Score {ui.score || 0}</span>
              </div>
              <button className={`sit ${ui.state}`} onPointerDown={press} disabled={!['music', 'scramble'].includes(ui.state)}>
                {ui.state === 'scramble' ? 'SIT' : ui.state === 'music' ? 'Wait for the silence' : ui.state === 'checking' ? 'Checking the ledger' : 'Stand by'}
              </button>
              <p className="hint">Space, any key, a click or a tap. Only after the music stops.</p>
              <button className="link" onClick={quit}>Leave the room</button>
            </div>
          )}

          {ui.state === 'error' && (
            <div className="card">
              <p className="verdict flagged">Pending</p>
              <p>{ui.error}</p>
              <button className="primary" onClick={quit}>Back to the lobby</button>
            </div>
          )}

          {over && (
            <div className="card result">
              <p className={`verdict ${ui.state === 'won' ? 'admitted' : 'declined'}`}>
                {ui.state === 'won' ? 'Admitted' : ui.falseStart ? 'Flagged' : 'Declined'}
              </p>
              <h2>
                {ui.state === 'won'
                  ? 'You hold the last seat.'
                  : ui.falseStart
                    ? 'You sat down while the music was still playing.'
                    : `Out in round ${ui.round}.`}
              </h2>
              <dl className="figures mono">
                <div>
                  <dt>Score</dt>
                  <dd>{ui.score}</dd>
                </div>
                <div>
                  <dt>Rounds held</dt>
                  <dd>
                    {roundsHeld} / {ROUNDS}
                  </dd>
                </div>
                {ui.best && (
                  <div>
                    <dt>Your best</dt>
                    <dd>
                      {ui.best.best} {ui.best.rank ? `(#${ui.best.rank})` : ''}
                    </dd>
                  </div>
                )}
              </dl>
              {!ui.scored && (
                <p className="warn">Unrecorded run: this score is not on the leaderboard. Sign in from the lobby to be scored.</p>
              )}
              {cert && <img className="cert" src={cert.url} alt="Your certificate of seating" />}
              <div className="row">
                <button className="primary" onClick={start}>Play again</button>
                <a className="button" href={shareUrl} target="_blank" rel="noreferrer">Post it on X</a>
                {cert && (
                  <a className="button" href={cert.url} download="the-last-seat.png">Save image</a>
                )}
                {canShareFiles && <button onClick={shareImage}>Share image</button>}
                <button className="link" onClick={quit}>Lobby</button>
              </div>
              <p className="note">
                {ui.best?.shareId
                  ? 'The X post links to your certificate, so the picture shows up in the post.'
                  : 'Save the image and attach it to your post to show the score.'}
              </p>
            </div>
          )}

          {ui.state === 'menu' && (
            <div className="card lobby">
              <div className="pick-head">
                <div>
                  <p className="label">Your shareholder</p>
                  <h2>{fund.name}</h2>
                  <p className="motto">{fund.motto}</p>
                  <p className="mono small">Usual chair: {CHARS[char].chair}</p>
                </div>
                {session && (
                  <div className="go">
                    <button className="primary big" onClick={start}>Take a seat</button>
                    <p className="mono small">Scored as {me?.name || 'you'}</p>
                  </div>
                )}
              </div>
              <div className="picker" role="listbox" aria-label="Choose a shareholder">
                {CHAR_LIST.map((c) => (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={c.id === char}
                    className={`pick ${c.id === char ? 'on' : ''}`}
                    style={{ '--fund': FUNDS[c.fund].color }}
                    onClick={() => setChar(c.id)}
                    title={`${FUNDS[c.fund].name}, ${c.chair}`}
                  >
                    <Sprite id={c.id} scale={2} />
                  </button>
                ))}
              </div>
              {!session && (
                <div className="gate">
                  <p className="label">Sign in to be scored</p>
                  <div className="row wrap">
                    <button className="primary" onClick={signInWallet}>Wallet on Robinhood Chain</button>
                    {PrivySignIn ? (
                      <Suspense fallback={<><button disabled>Email</button><button disabled>X account</button></>}>
                        <PrivySignIn appId={PRIVY_APP_ID} onSession={onSession} onMessage={setAuthMsg} />
                      </Suspense>
                    ) : (
                      <>
                        <button disabled title="Opens soon">Email</button>
                        <button disabled title="Opens soon">X account</button>
                      </>
                    )}
                  </div>
                  <p className="note">
                    Wallet sign in is one free signed message: no transaction, no gas, no approvals.
                    {!hasWallet() && ' No wallet in this browser: open the page in your wallet app, or use email or X.'}
                  </p>
                  {authMsg && <p className="note">{authMsg}</p>}
                  <div className="guest">
                    <button onClick={start}>Play without signing in</button>
                    <p className="warn">Your result will not be recorded on the leaderboard.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="side">
          <section className="card">
            <p className="label">The register</p>
            {session && me ? (
              <>
                <p>
                  Signed in as <strong>{me.name}</strong> <span className="mono small">{me.label}</span>
                </p>
                <p className="mono small">
                  Best {me.best} {me.rank ? `, rank #${me.rank}` : ''} . Games {me.games} . Wins {me.wins}
                  {me.fastest ? ` . Fastest ${me.fastest} ms` : ''}
                </p>
                <form onSubmit={saveName} className="name-form">
                  <label htmlFor="name">Name on the board (your X handle works)</label>
                  <div className="row">
                    <input id="name" value={nameDraft} maxLength={20} onChange={(e) => setNameDraft(e.target.value)} />
                    <button type="submit">File</button>
                  </div>
                </form>
                <button className="link" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <p>Not signed in. Sign in from the lobby with a wallet, email or X and every run is scored.</p>
            )}
            {session && authMsg && <p className="note">{authMsg}</p>}
          </section>

          <section className="card board">
            <p className="label">The leaderboard</p>
            {!board && <p className="mono small">Fetching the ledger.</p>}
            {board && board.board.length === 0 && <p className="mono small">No scores filed yet. The first seat is open.</p>}
            {board && board.board.length > 0 && (
              <ol>
                {board.board.map((r) => (
                  <li key={r.rank} className={me && me.rank === r.rank ? 'you' : ''}>
                    <span className="rank mono">{r.rank}</span>
                    {r.char && CHARS[r.char] ? <Sprite id={r.char} scale={1} /> : <span className="nochar" />}
                    <span className="who">
                      {r.name}
                      <span className="mono small">
                        {r.rounds}/{ROUNDS} rounds{r.fastest ? ` . ${r.fastest} ms` : ''}
                      </span>
                    </span>
                    <span className="score mono">{r.score}</span>
                  </li>
                ))}
              </ol>
            )}
            {board && board.total > 0 && <p className="mono small">{board.total} shareholders on the ledger</p>}
          </section>

          <section className="card rules">
            <p className="label">House rules</p>
            <ol>
              <li>Five shareholders walk around four chairs while the radio plays.</li>
              <li>When the music stops, sit. Space, any key, a click or a tap.</li>
              <li>The slowest one stays standing and leaves. One chair goes with them.</li>
              <li>Every round the tune is faster and the others are quicker.</li>
              <li>From round two the tune sometimes drops to one held note. That is not the stop. Sit then and you are flagged.</li>
              <li>The final: two shareholders, one chair. Take the last seat.</li>
            </ol>
            <p className="mono small">Score: 1000 x round for each round held, plus up to 800 for speed, plus 3000 for the last seat.</p>
          </section>
        </aside>
      </main>

      <footer>
        <p>
          The Last Seat is a fan game by Ultra Goat (<a href="https://x.com/UltraICO" target="_blank" rel="noreferrer">@UltraICO</a>), made with the UGC kit from{' '}
          <a href="https://themutual.fun" target="_blank" rel="noreferrer">The Mutual Fun</a> (
          <a href="https://x.com/themutualfun" target="_blank" rel="noreferrer">@themutualfun</a>). It is not made, run or endorsed by TMF.
        </p>
        <p>
          Open source: <a href={REPO} target="_blank" rel="noreferrer">read every line on GitHub</a>. No contracts, no approvals, no tokens. Wallet sign in is one free signed message.
        </p>
      </footer>
    </div>
  );
}
