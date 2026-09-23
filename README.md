# The Last Seat

Musical chairs for shareholders of [The Mutual Fun](https://themutual.fun). A fan game by **Ultra Goat** ([@UltraICO](https://x.com/UltraICO)).

Five shareholders walk around four chairs while the radio plays. When the music stops, sit. The slowest one stays standing and leaves, and a chair goes with them. Four rounds, each one faster, until two shareholders are left with one chair. Whoever sits first holds the last seat.

## How to play

- Pick a shareholder. There are 23 of them, from all five funds.
- Press **Space** (or any key), **click**, or **tap** the big button the moment the music stops.
- Press while the music is still playing and you are **Flagged**. From round two the tune sometimes drops to one held note. That is not the stop.
- Each round the tempo goes up and the other shareholders react faster. The last opponent sits in about a third of a second.

### Score

| | |
| --- | --- |
| Each round you hold | 1000 x the round number |
| Speed bonus per round | up to 800 (800 minus your reaction in ms) |
| Taking the last seat | 3000 |

## Is it safe to connect a wallet

Yes, and you do not have to connect anything to play. You can play without signing in; the game warns you that such a run is not recorded on the leaderboard.

To go on the leaderboard you sign in one of three ways:

- **Wallet on Robinhood Chain.** The game asks your wallet to switch to Robinhood Chain (chain id 4663) and to sign one plain text message that contains a one time nonce. That is all. **No transaction, no gas, no token approval, no contract.** You can read the exact message in [`src/wallet.js`](src/wallet.js) and the server check in [`api/auth/wallet.js`](api/auth/wallet.js).
- **Email** or **X account** through [Privy](https://privy.io). The server only checks Privy's signed tokens ([`api/auth/privy.js`](api/auth/privy.js)). Emails are never shown, only a masked label. With X, your handle becomes your name on the board.

The whole thing is in this repository. There is nothing else.

## Share your score

Every finished run makes a certificate of seating: your shareholder, score, rounds held, fastest reaction and the verdict stamp. Save it or share it from the result card. A signed in run also gets its own link (`/s/<id>`) whose preview on X is that certificate, drawn on the server by the same code ([`shared/certificate.js`](shared/certificate.js), [`api/card.js`](api/card.js)).

## Fair scores

The server deals the rounds. It holds the random seed, sends one round at a time, and replays each round with the same rules the browser uses ([`shared/game.js`](shared/game.js)). A reaction reported before the music could possibly have stopped is treated as a false start. Reactions under 100 ms are clamped, since no person is that fast.

## Stack

- Vite + React for the page, a canvas for the room. The pixel art is drawn 1:1 from the TMF kit, no smoothing.
- The music ("Quarterly Shuffle") is an original chiptune synthesized live with the Web Audio API. There are no audio files.
- Vercel functions in [`api/`](api) and Redis for the leaderboard.

## Run it yourself

```bash
npm install
echo "REDIS_URL=redis://..." > .env.local
# optional, enables email sign in
echo "VITE_PRIVY_APP_ID=..." >> .env.local
npm run dev
```

## Credits and terms

Characters, the house mark and the palette come from The Mutual Fun UGC kit, used under its terms: make things, do not mint or sell them, and do not suggest TMF has endorsed you. **This game is not made, run or endorsed by The Mutual Fun.** The characters were lifted out of their chairs for walking; the pixels themselves are unchanged.

Code: MIT. Made by Ultra Goat ([@UltraICO](https://x.com/UltraICO)).
