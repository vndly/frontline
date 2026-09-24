# Game

## Match

- **Match authority**: Client-side execution synchronises through Cloud Firestore under `matches/{code}`, with state transitions committed through atomic transactions (`runTransaction`). There is no dedicated game server. State changes — match creation, taking a seat, and advancing a turn — are validated transactionally against the current document state. The active player advances the turn via `MatchClient.passTurn`, guarded by optimistic concurrency: the transaction checks `state.turnCount === expectedTurnCount` before writing. A late write from a lagged client or duplicate click is dropped without modifying the turn index or advancing the counter twice. Anonymous authentication (`signInAnonymously`) issues stable player identifiers (`currentPlayerId`) without registration friction, ensuring consistent seat attribution across reconnects.
- **Reading a stored match**: `parseMatchState` in `src/match/match_state.ts` is the boundary between untrusted Firestore payloads and typed application state. Anything that fails structural or semantic validation is refused (returning `null`) rather than repaired, protecting the client from running in an inconsistent state. The parser strictly checks:
  - `phase`: Must be `'lobby'`, `'playing'`, or `'finished'`.
  - `players`: An array of `MatchPlayer` objects, each requiring a non-empty string `uid`, a non-empty string `name`, and a boolean `bot`.
  - Seat count consistency: The `'lobby'` phase requires exactly 1 player; `'playing'` and `'finished'` require exactly 2 players. Any other player count refuses the document.
  - Turn tracking: `turnIndex` is constrained to `0` or `1`, and `turnCount` must be an integer >= 1 (falling back to 1 if missing or non-positive).
  - Snapshot handling: Listeners distinguish cache reads from server confirmations via `!snapshot.metadata.fromCache`. Corrupted or missing documents trigger the `onLost` error handler only once confirmed by the server, preventing transient local cache misses from prematurely tearing down the match.
- **Rules of play**: The game domain lives under `src/game/` as pure, framework-free TypeScript functions and types. Nothing under `src/game/` may import Vue, Firebase, or browser APIs.
  - `REQUIRED_PLAYERS = 2`: Matches are strictly 2-player turn-based engagements.
  - `PlayerSeat`: Zero-indexed seat representation (`0` for Seat 1 / creator, `1` for Seat 2 / opponent).
  - Initial state: Created by `createInitialSessionState()`, starting at `turnIndex = STARTING_SEAT = 0`, `turnCount = 1`, `phase = 'playing'`, and `winner = null`.
  - Turn transition: `advanceTurn(state)` toggles `turnIndex` using `nextSeat(seat)` (mapping `0 -> 1` and `1 -> 0`) and increments `turnCount` by 1. Transitions only apply when `phase === 'playing'`.
- **Match codes**: Match rooms are addressed by 4-character codes generated in `src/match/codes.ts`.
  - Unambiguous character set: The alphabet `ACEFGHJKMNPQRTUVWXY34679` (24 characters) explicitly excludes easily confused glyphs (`O`, `D`, `0`, `I`, `L`, `1`, `S`, `5`, `B`, `8`, `Z`, `2`).
  - Generation and collision handling: `createMatchCode()` generates a random 4-character sequence. `MatchClient.create` performs up to 8 transactional attempts (`CODE_ATTEMPTS`) to claim an unused code; if the document exists, the transaction rolls back and attempts a fresh code.
  - Normalisation: `normaliseMatchCode()` strips whitespace and converts input to uppercase. `isMatchCode()` verifies length and alphabet compliance before querying Firestore.
- **Match lifecycle & matchmaking**:
  - Creation: The creator enters their callsign (persisted in `localStorage['frontline.player-name']`). Creating a PvP match writes the document in the `'lobby'` phase with the creator in Seat 0. Creating a bot match seeds Seat 1 with an automated bot (`Frontline Bot`, `bot: true`) and writes directly into the `'playing'` phase.
  - Joining: Opponents join by entering the 4-character room code or navigating directly to `/match/:code`. If the client has a saved callsign and opens a lobby room, `match_screen.vue` automatically attempts to join. Joining transactionally adds Player 2 to `players`, transitions `phase` from `'lobby'` to `'playing'`, and sets the starting turn.
  - Third-party spectators: If an unseated user navigates to an in-progress match (`phase !== 'lobby'` and not seated), the screen displays an advisory card and prevents actions.
- **Bots**:
  - Automated players: Created with `bot: true` and a generated identifier.
  - Detection: `isBotTurn(state)` checks whether `state.phase === 'playing'` and `state.players[state.turnIndex]?.bot === true`.
  - Execution authority: When playing against a bot, Seat 0 (the human creator) is the sole authority responsible for triggering the bot's turn. This single-coordinator model prevents duplicate transaction submissions across multiple tabs.
  - Move pacing: `scheduleBotTurn` introduces a simulated thinking delay between 800ms (`BOT_MIN_DELAY_MS`) and 1400ms (`BOT_MAX_DELAY_MS`) before committing `client.passTurn(state.turnCount)`, giving the game natural pacing.
