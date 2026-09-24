## Project

Frontline (Vite + Vue 3, TypeScript, Composition API with `<script setup>`, ESLint + @stylistic + type-aware typescript-eslint via @vue/eslint-config-typescript).

`src/` is layered, and the layers only ever talk downwards:

- `components/screens/` — the routed screens. `lobby_screen.vue` sets operative callsigns and creates matches (PvP or vs Bot); `match_screen.vue` joins matches by code, displays active seats and turn status, coordinates passing turns, and triggers bot moves.
- `game/` — the game domain, as pure TypeScript functions and types. `types.ts` defines `PlayerSeat` (0 | 1), `SessionPhase` (`lobby` | `playing` | `finished`), and `GameSessionState`; `rules.ts` defines player counts (`REQUIRED_PLAYERS = 2`), starting seat, turn advancement (`advanceTurn`), and alternating seat transitions (`nextSeat`).
- `match/` — Firestore, as plain classes and functions. `match_client.ts` is one player's connection to one match under `matches/{code}`, managing transactions and snapshot subscriptions; `match_state.ts` holds the stored shapes (`MatchPlayer`, `MatchState`) and validates them without throwing (`parseMatchState`); `bots.ts` detects automated turns (`isBotTurn`) and executes simulated bot moves; `codes.ts` generates and validates 4-character unambiguous match codes; `firebase.ts` initialises the app, anonymous auth, and Firestore.
- `assets/styles.css` — the global design tokens (tactical palette, font families, radii, transitions) and reset. Everything else is a scoped component style.
- `main.ts` creates the root `app.vue`, installs `router.ts`, and mounts.

## Layering

- **Architecture**: The layers run `components` → `match` → `game`. Nothing under `src/game/` may import Vue or Firebase — the domain logic is strictly pure and framework-free. Nothing under `src/match/` may import Vue. A screen is what joins the UI to the match client and game domain.
- **State**: Authoritative game state is stored in Firestore (`matches/{code}`). Local component state uses Vue 3 Composition API primitives (`ref`, `computed`). Callsigns are persisted in `localStorage` under `frontline.player-name`.

## Reference Docs

- `docs/game.md` — match authority, rules of play, lifecycle, and bots. Read before editing `src/match/` or `src/game/`.
- `docs/typescript.md` — style, naming, imports, comment conventions. Read when editing TypeScript files.

## Workflow

- **After completing code changes**: Run `npm run lint:fix` and fix remaining errors, run `npm run build` (typechecks first) and fix any failures, then run `/delta-review` before responding.
- **No test suite**: This project has no tests by design. TypeScript and the type-aware lint rules are the safety net — do not weaken `strict` or `noUncheckedIndexedAccess`, and do not add `any` to silence an error.
- **Doc Maintenance**: After changes, check if `AGENTS.md`, `docs/game.md`, and `docs/typescript.md` need updating. A rule that changes, or a new one, goes in the file that already holds its section: workflow, layering, tooling and deployment in `AGENTS.md`, match and rules in `docs/game.md`, code conventions in `docs/typescript.md`.

## Tooling

- **TypeScript projects**: `tsconfig.json` only references `tsconfig.app.json` (browser, `src/`, extends `@vue/tsconfig/tsconfig.dom.json`) and `tsconfig.node.json` (`vite.config.ts`, extends `@tsconfig/node24`). An option the two bases don't already cover must be set in both.
- **Fonts**: Fonts come from Google Fonts (`Space Grotesk`, `Plus Jakarta Sans`, `Chivo Mono`), served by its CDN via a `<link>` in `index.html`. No font packages in `package.json` and no font files in the repo.
- **Images**: Import assets from `src/assets/` so Vite fingerprints them; nothing goes in `public/`.

## Deployment

- **Build output**: `npm run build` writes into `../backend/public`, the directory Firebase Hosting serves, and empties it first. Routing is history mode, which relies on the catch-all rewrite in `../backend/firebase.json`, and on the `headers` block beside it: the entry document is served `no-cache` so that a returning visitor does not ask for hashed assets the last deploy removed and get the catch-all's HTML back with a 200, while `/assets/**` is `immutable` because those names are content-hashed. Both deploy scripts build first — `npm run deploy` here, and `../backend/scripts/deploy.sh`, which runs this build before publishing rather than shipping whatever is committed in `backend/public`. Neither deploy script touches Firestore — both pass `--only hosting`.
- **Firebase**: The web config lives in `src/match/firebase.ts` and is public by design — it is a set of identifiers, not a secret, and security rules are the boundary. The project needs both Firestore created *and* the Anonymous sign-in provider enabled; without the second, every write fails with `auth/configuration-not-found`.
