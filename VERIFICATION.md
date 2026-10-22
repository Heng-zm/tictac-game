# Verification Report

**Project:** Tic Tac Toe — Telegram Mini App
**Date:** 2026-10-22
**Repository:** https://github.com/Heng-zm/tictac-game
**Report scope:** local implementation verification, PostgreSQL integration, production-mode smoke test, and explicit list of what remains unverified.

## Verdict

The application is **functionally complete for local and PostgreSQL-backed operation**. All automated tests pass, the production build succeeds, Prisma migrations apply to a real PostgreSQL 17.11 server, and a production-mode smoke test verified Telegram-style authentication, secure sessions, Socket.IO authentication, matchmaking, a full online game, and rating persistence.

It is **not yet verified against a real Telegram client or a live Supabase project**, because no real bot token, Mini App HTTPS deployment, or Supabase credentials were available. Those items are listed under [Unverified](#unverified).

## Environment used

| Item | Value |
| --- | --- |
| OS | Windows (win32) |
| Node.js | v26.10.0 |
| npm | 11.19.1 |
| PostgreSQL | 17.11 (local Windows service) |
| Database | `tictactoe_test` for the opt-in integration suite; the disposable `tictactoe_ui_verify` database used for the earlier production smoke run was dropped after verification |
| Telegram credentials | Synthetic, format-valid test bot token only |
| Supabase credentials | None |
| HTTPS deployment | None; production mode ran locally on HTTP port 3200 |

No real secrets were committed or used. The automated checks and PostgreSQL migration run were repeated on 2026-10-22 after the active-game navigation, invitation-flow, and game-motion changes; the production-mode smoke tests below were run on 2026-10-21.

## Automated checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed (server, client, and tests via `tsconfig.test.json`) |
| `npm run lint` | Passed |
| `npm test` without `TEST_DATABASE_URL` | 197 passed, 10 skipped (PostgreSQL suite skipped cleanly) |
| `npm test` with `TEST_DATABASE_URL` | **207 passed / 207** across 22 test files |
| `npm run test:coverage` with PostgreSQL | Passed; **88.61% statements**, 81.78% branches, 90.78% functions |
| Prisma repository coverage | **91.40% statements** (up from 5.13% before integration tests) |
| Telegram bot controller coverage | **76.38% statements** (up from 5.12% before the fake Bot API suite) |
| `npm run build` | Passed; client emitted to `dist/client`, server to `dist/server` |
| `npm run start:prod` | Applied migrations, then started the production server |
| `npm run db:migrate` | Applied all four migrations through `20261022000000_turn_notifications` to a fresh PostgreSQL 17.11 database |
| `npm run db:migrate` again | “No pending migrations to apply” |
| `npm run db:migrate` with only `DATABASE_URL` | Passed; wrapper correctly falls back when `DIRECT_URL` is absent |
| Render Blueprint schema | `render.yaml` and `render.postgres.yaml` valid against Render's published schema |

The bot-controller suite runs the real grammY client against a local fake Telegram Bot API. It verifies outgoing message payloads, permanent versus transient delivery responses, bot command/menu/webhook registration, startup resilience when Telegram metadata or webhook registration fails, webhook secret rejection, and the `/help` and `/start` handlers without contacting Telegram.

The client component suite exercises the active-game bar's turn, waiting, paused, reconnecting, and bot states, including its live clock, screen-reader label, and resume action. It also covers the invitation handoff from Quick Match and the invite screen's active-game copy, including the distinction between an accepted friend game and an unrelated bot or random game. Board coverage asserts that a resolved winning row renders one settling beam and no endless highlighted pulse.

The PostgreSQL integration suite covers:

- Telegram user upsert, profile updates, preferences (including durable `turnNotifications`), stats and `lastSeenAt`.
- Match creation with transactional player reservations and rollback on conflict.
- Move recording, duplicate action IDs, stale-version rejection, and sparse JSON board persistence.
- Rated finalization: outcomes, rating deltas, stats, history and leaderboard.
- AI statistics without affecting the rated leaderboard.
- Match abandonment and reservation release.
- Stable history pagination.
- Invitation creation, preview, cancellation, one-time acceptance, expiry and host release.
- Maintenance of expired invitations, stale matches, stale waiting invitations and orphaned reservations.
- Durable move lookup (`hasProcessedAction`) used for restart-safe idempotency.

## Production-mode smoke test

The built server was started with `NODE_ENV=production`, `npm run start:prod`, PostgreSQL, a format-valid test bot token, and Render-style environment derivation (`RENDER=true`, `RENDER_EXTERNAL_URL` set, no explicit `MINI_APP_URL` or `CORS_ORIGINS`).

| Check | Result |
| --- | --- |
| Startup migrations | `npm run start:prod` applied migrations, then booted the server |
| Render-derived Mini App URL | `https://tictac-smoke.onrender.com` |
| Render-derived Telegram webhook | `https://tictac-smoke.onrender.com/api/telegram/webhook` |
| `GET /health` | `200`, status `ok` |
| `GET /ready` | `200`, database `ok` |
| `GET /` | `200`, built client HTML served |
| HSTS | Present in production |
| `POST /api/auth/dev` | `403 DEV_AUTH_DISABLED` |
| `POST /api/auth/telegram` with a correctly HMAC-signed synthetic `initData` | `200`, user created in PostgreSQL |
| Session cookie | `HttpOnly; Secure; SameSite=None; Path=/` |
| `GET /api/me` with session cookie | `200`, correct profile and default stats |
| Socket.IO handshake with session cookie | Connected; `session:ready` received |
| Two-client random matchmaking | Both clients received the same `match:found` |
| Full online game | Five server-validated moves; both clients received `match:finished` with `X_WINS` |
| Rating persistence | Winner stats updated to `gamesPlayed=1`, `wins=1`, `rating=1020` |
| Invalid Telegram bot token | Expected `401` from Telegram; server logged the bot failure and continued serving |
| Invalid/tampered `initData` | Rejected by unit tests and HTTP validation paths |

The production smoke test used synthetic Telegram users in the local test database. No real Telegram account was involved.

### Render zero-config demo smoke test

The server was also started with `NODE_ENV=production`, `RENDER=true`, and a simulated `RENDER_EXTERNAL_URL`, with no database, no Telegram token, no session secret, and no Mini App URL configured.

| Check | Result |
| --- | --- |
| Automatic configuration | `DB_MODE=memory`, `DEMO_MODE=true`, `DEV_AUTH_ENABLED=true`, derived Mini App URL/CORS, generated session secret |
| Startup warnings | Logged generated secret, demo mode, and in-memory data warnings |
| `GET /health` | `200` |
| `GET /ready` | `200` |
| `GET /api/config` | `demoMode=true`, `devAuthEnabled=true`, production environment |
| `POST /api/auth/dev` | `200`, guest user created in memory |
| Guest session cookie | `HttpOnly; Secure; SameSite=None` |
| `GET /api/me` | `200` |

This verifies that a first Render deployment starts without dashboard configuration. It is a guest demo only; data is lost on restart.

### Production deployment scaffolding

- `render.yaml` deploys the web service with Supabase PostgreSQL. It sets `DEMO_MODE=false`, `DB_MODE=postgres`, `DEV_AUTH_ENABLED=false`, generates a persistent session secret, derives a Telegram-safe webhook secret, applies migrations before startup, and uses `/health` as the Render health check.
- `render.postgres.yaml` is the alternative one-click path that provisions Render Postgres and requires only the Telegram bot token and username.
- `npm start` and `npm run start:prod` run `prisma migrate deploy` through `DIRECT_URL` (falling back to `DATABASE_URL`) before importing the built server; memory/demo deployments skip migrations when no database URL is set.
- `npm run check:prod -- https://...` verifies HTTPS, `/health`, `/ready`, `demoMode=false`, production environment, disabled dev auth, Telegram bot configuration, HSTS, and rejection of `POST /api/auth/dev`.
- `.github/workflows/ci.yml` runs typecheck, lint, PostgreSQL integration tests, and the production build; the Blueprint waits for checks before auto-deploying.
- The app derives the Telegram webhook URL from the public Render/custom Mini App origin and registers it at startup. Webhook registration failure is logged but does not prevent the game server from booting.
- Render startup tolerates dashboard variables that are present but empty, and normalizes a Render-generated base64 webhook secret to Telegram's `A-Za-z0-9_-` alphabet before registering it.

### Same-origin LAN/custom-domain smoke test

The built server was started with `CORS_ORIGINS=http://localhost:5173` and no LAN origin in the allowlist. Requests were sent with `Host: 192.168.18.11:3210`.

| Check | Result |
| --- | --- |
| `GET /assets/index-*.css` with `Origin: http://192.168.18.11:3210` | `200`, `text/css` |
| `GET /api/config` with the same origin | `200` |
| `GET /assets/index-*.css` with `Origin: http://evil.example` | `403`, `ORIGIN_NOT_ALLOWED` |

This verifies that module assets and API calls work when the app is opened through a LAN IP or custom domain, while cross-origin requests remain blocked. Socket.IO uses the same same-host check for handshakes.

## Verified behavior

### Authentication and sessions

- Telegram `initData` is validated server-side with the documented HMAC-SHA256 construction.
- Data-check fields are sorted deterministically by code unit, not locale-dependent `localeCompare`.
- Expired, future-dated, malformed, duplicate-field, oversized, and tampered payloads are rejected.
- Bot accounts are rejected; display names are normalized.
- The bot token is never sent to the browser.
- Sessions are signed with `SESSION_SECRET`, stored in an HttpOnly cookie, and expire after 7 days.
- Production cookies use `Secure` and `SameSite=None` for Telegram Web iframe compatibility; local development uses `SameSite=Lax`.
- Development authentication is rejected in production unless explicit `DEMO_MODE=true` is active.
- Render zero-config demo mode enables guest authentication and in-memory data when no database or Telegram bot is configured; it logs warnings and shows a demo banner in the client.
- HTTP and Socket.IO authentication both re-check the user and Telegram ID against the database.

### Online play and match lifecycle

- Random matchmaking is server-authoritative and creates a single reserved match for both players.
- Socket actions verify the authenticated participant and match room.
- Moves are validated for turn, cell bounds, occupancy, and game state.
- Move action IDs are idempotent in memory, across duplicate repository calls, and across a simulated service restart for the finishing move.
- Reconnect grace prevents immediate loss on disconnect; E2E tests cover reconnect and grace expiry.
- Finished games emit a final state to both participants; rematch and leave flows are covered by tests.
- Invitations are single-use, expiring, hashed at rest, and protected against self-acceptance and busy acceptors.
- Opening the invite screen from Quick Match leaves the queue before generating a link, preventing a random match from taking over while an invitation is being prepared.
- Creating or accepting an invitation clears the client's local queue state as well as the server queue, so a later visit to Quick Match cannot show a phantom search.
- The invite screen distinguishes an accepted friend game from an unrelated active bot or random match instead of always claiming a friend joined.
- Maintenance closes expired invitations and pending invitations attached to abandoned/stale waiting matches.

### Turn notifications

- Notifications are opt-in per user, default to disabled, and survive profile upserts.
- Telegram write access is requested only when the player enables the setting.
- The server sends at most one notification per turn, only to an offline human participant in an active non-AI match.
- Notification failures are logged asynchronously and never block move processing.
- Permanent Telegram delivery failures, such as a blocked bot or deactivated recipient, disable the preference to prevent repeated failed sends; transient failures leave it enabled.
- Error classification keeps rate limits and server errors retryable while treating blocked or unreachable recipients as permanent.
- Settings offers an authenticated test-notification action, limited to three sends per user per minute, with distinct unavailable, disabled, blocked and transient-failure responses.
- A blocked test notification disables the preference and refreshes the client setting; transient failures can be retried.
- Buttons deep-link back into the active Mini App match through `startapp=game_<uuid>`.
- Unit, HTTP, match-service and repository tests cover the preference, offline gating, deep-link URL and delivery-failure paths.
- The real bot controller is exercised against a local fake Bot API: turn notifications use the expected message payload and Mini App/URL button, permanent failures map to `blocked`, transient failures map to `failed`, startup continues when metadata or webhook registration fails, and command/menu/webhook setup plus signed webhook dispatch are covered.

### Client UI and active-game navigation

- The responsive client was inspected at a `390x844` CSS viewport with 2x device-pixel ratio in headless Chrome: Home, Quick Match queue, an active bot board, Profile Stats, Settings, Leaderboard, invite waiting, and the scrolled bottom of long pages.
- Profile and Leaderboard keep an active match reachable through a compact resume bar above the bottom navigation. It shows your-turn, waiting, paused, or reconnecting status, the opponent name, an optional live countdown, and a labelled one-tap return to the board.
- The bar is intentionally not duplicated on Home, which retains its full active-game card, and disappears when the match finishes.
- Bottom-page clearance and raised toast placement account for both the bar and the bottom navigation, so long pages can scroll fully clear of the fixed controls.
- Safe-area padding and fixed navigation were checked at the target mobile viewport; no horizontal overflow appeared in the inspected screens.
- Gameplay motion is client-only and uses short, one-shot transitions: stones pop and draw once, the winning row settles with a single beam, the camera follow duration scales with pan distance, HUD colors and turn copy transition, and the result icon pops on entry.
- The resolved board no longer runs endless pulse loops on winning cells or the last-move dot, and per-stone `drop-shadow` filters were removed to reduce paint and compositor work while panning.
- `Board` is memoized and receives a stable move callback, so 500ms turn-clock updates no longer reconcile every stone. Board and HUD motion inherit the global `prefers-reduced-motion` override, and JavaScript camera motion also checks the reduced-motion preference.

### AI

- Easy, Medium, and Hard difficulties are implemented server-side.
- Hard uses a one-ply heuristic that prioritizes immediate wins and blocks immediate threats; tests cover winning and blocking.
- AI statistics are tracked without changing the human leaderboard.

### Security and operations

- Helmet CSP allows Telegram framing while restricting other origins.
- HSTS is enabled in production and disabled in development.
- CORS uses an explicit allowlist; wildcard origins are rejected in production.
- Same-host requests are always allowed so LAN IPs and custom domains can load module assets; cross-origin requests remain restricted.
- API mutations and Socket.IO handshakes reject disallowed `Origin` headers.
- Rate limits cover auth, HTTP APIs, and socket events.
- Request bodies and socket buffers are size-limited.
- Health and readiness endpoints are available.
- Graceful shutdown handles signals and repository cleanup.
- Structured logging avoids logging raw `initData`, bot tokens, or session tokens.
- The in-memory repository is refused in production; production requires `DATABASE_URL`.

### Supabase compatibility

- Prisma uses standard PostgreSQL and applies the committed migration successfully to PostgreSQL 17.11.
- `DATABASE_URL` is the runtime connection; `DIRECT_URL` is used by the migration wrapper for Supabase's session-pooler connection. On Render, use the session pooler (`aws-<index>-<region>.pooler.supabase.com:5432`), not the IPv6-only direct host.
- The documented Supabase setup uses the transaction pooler with `pgbouncer=true` for runtime and port 5432 for migrations.
- A dedicated migration enables RLS on every game table and revokes Data API grants from Supabase's `anon`/`authenticated` roles. The server's owner role bypasses RLS, so server queries are unaffected.
- No Supabase-specific client code or service-role key is used in the browser.

## Unverified

These items could not be verified in this environment and must be checked during deployment:

1. **Real Telegram Mini App launch.** No real BotFather token, bot username, or HTTPS Mini App URL was available. Synthetic `initData` proves the HMAC and session flow, but not Telegram client behavior.
2. **Real Telegram Web / mobile iframe cookies.** `SameSite=None; Secure` is configured and was observed in the smoke test, but browser third-party-cookie behavior inside Telegram Web was not exercised.
3. **Live Supabase project.** No Supabase URL or credentials were available. PostgreSQL 17.11 compatibility and the migration were verified locally; Supabase's pooler, TLS termination, and network path were not.
4. **Telegram bot commands, webhook delivery and turn notifications.** Bot command handlers, menu/webhook registration, webhook secret rejection, message payloads, invitation deep links and delivery-error mapping were exercised against a local fake Bot API. Delivery of real webhook updates from Telegram, menu-button rendering in a real client, and notification delivery to a real Telegram account were not exercised against Telegram.
5. **HTTPS deployment.** TLS, reverse proxy, `TRUST_PROXY`, domain configuration, and Telegram's HTTPS requirement were not deployed or tested. The production Blueprints were schema-validated locally but have not been executed in a live Render account.
6. **Real Telegram WebView visual verification.** The responsive client was inspected in headless Chrome at a `390x844` mobile viewport, including the active-game bar and safe-area layout. It was not opened inside a real Telegram iOS, Android, or Web client, so Telegram iframe chrome, dynamic viewport changes, theme transitions, swipe-to-close suppression, on-device animation smoothness, battery impact, and font rendering remain unverified.
7. **Load, concurrency, and multi-instance behavior.** The app is intentionally single-instance for in-memory queues and Socket.IO rooms. No Redis adapter or distributed queue was tested.
8. **Real user data and moderation.** No production user data, abuse testing, or Telegram rate-limit behavior was exercised.

## Deployment checklist

Before calling the deployment production-verified:

- [ ] Create the Supabase project and copy `DATABASE_URL` (transaction pooler) and `DIRECT_URL` (session pooler), or choose the Render Postgres Blueprint. Direct `db.<project-ref>.supabase.co` URLs are IPv6-only and fail on Render.
- [ ] Deploy `render.yaml` or `render.postgres.yaml`; Render generates `SESSION_SECRET` and `TELEGRAM_WEBHOOK_SECRET` and applies migrations during startup.
- [ ] Provide a real `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in the Render dashboard. Never send them in chat or commit them.
- [ ] Confirm the Render service is healthy and `npm run check:prod -- https://your-service` passes.
- [ ] Configure the BotFather Mini App/menu button URL to the deployed origin; confirm the webhook was registered.
- [ ] Open the Mini App from a real Telegram account on mobile and Telegram Web.
- [ ] Play one random game and one invitation game between two real accounts.
- [ ] Verify reconnect behavior by backgrounding/killing the Telegram WebView.
- [ ] Verify leaderboard, history, and profile persistence against Supabase/Render Postgres.
- [ ] Confirm logs contain no tokens, `initData`, or session cookies.

## Known limitations

- Matchmaking queues, Socket.IO rooms, and AI timers are process-local; run one application instance unless a shared adapter and queue are added.
- Supabase RLS is enabled by migration and Data API grants are revoked because Prisma connects as the database owner and the server is the sole writer. Do not expose the database or a service-role key to the browser. If you add a Supabase client, add explicit RLS policies and grants first.
- The in-memory repository is for development and explicit temporary demos (`DB_MODE=memory`) only; it loses all data on restart and must not be used for real production data.
- Render auto-enables a guest demo when neither `DATABASE_URL` nor `TELEGRAM_BOT_TOKEN` is configured. Set `DEMO_MODE=false` to disable this fallback and require real production configuration.
- No spectator, tournament, payment, or moderation features are included.
