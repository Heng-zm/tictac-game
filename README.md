# Tic Tac Toe — Telegram Mini App

A production-oriented, real-time Tic Tac Toe game that runs as a Telegram Mini App. One Node.js server serves the React client, the HTTP API, Socket.IO, and the Telegram bot webhook from a single origin.

![Stack](https://img.shields.io/badge/React%2019-TypeScript-3178C6) ![Server](https://img.shields.io/badge/Node.js-Express%205%20%2B%20Socket.IO%204-339933) ![Database](https://img.shields.io/badge/PostgreSQL-Prisma%206-4169E1)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Heng-zm/tictac-game)

## Features

- **Three game modes**
  - Random online matchmaking with an optional AI fallback while waiting.
  - Private friend invitations via `https://t.me/<BOT_USERNAME>?startapp=invite_<TOKEN>`.
  - AI opponent with Easy, Medium, and **unbeatable Hard** (alpha–beta minimax).
- **Server-authoritative play** — moves, turns, results, ratings, and AI decisions are validated and computed on the server. The client cannot set a board state.
- **Telegram-native authentication** — `initData` is verified with Telegram's documented HMAC-SHA256 scheme, then exchanged for a signed, HttpOnly session cookie. Bot tokens never reach the browser.
- **Resilient real-time sessions** — Socket.IO rooms, participant authorization, reconnect grace, turn timers (optional), and idempotent move action IDs.
- **Persistence** — PostgreSQL through Prisma, with transactional matchmaking reservations, invitation acceptance, move recording, and rating updates.
- **Full UI** — home, matchmaking, invite waiting/accepting, live game, result/rematch, profile and match history, leaderboard, reconnect and expired-invite states. Hash routing works inside Telegram WebViews, with Telegram BackButton and theme support.
- **Operational basics** — health/readiness endpoints, rate limits, CORS allowlist, CSP, graceful shutdown, stale-match maintenance, structured logging.

## Tech stack

| Layer | Technology |
| --- | --- |
| Client | React 19, TypeScript, Vite 7, Tailwind CSS 3 |
| Server | Node.js 20+, Express 5, Socket.IO 4 |
| Data | PostgreSQL, Prisma 6 |
| Telegram | grammY, Telegram Mini Apps SDK |
| Validation | Zod |
| Tests | Vitest, Supertest, Socket.IO client |

## Requirements

- Node.js **20.19+** (22 LTS recommended)
- PostgreSQL **14+** for persistent mode
- A Telegram bot created with [@BotFather](https://t.me/BotFather)
- An HTTPS public URL for the deployed Mini App (Telegram requires HTTPS)

## Quick start (local development)

```bash
npm install
cp .env.example .env
npm run db:generate
```

Without `DATABASE_URL`, development uses an in-memory repository. Data is lost on restart. `DEV_AUTH_ENABLED=true` (the development default) shows a guest sign-in path so the UI can be tested outside Telegram.

```bash
npm run dev
```

- Client: http://localhost:5173
- API/socket server: http://localhost:3000

Vite proxies `/api` and `/socket.io` to the server.

### Testing on a phone or inside Telegram

Telegram Mini Apps require HTTPS (localhost is the exception). A plain HTTP LAN address such as `http://192.168.18.11:3000` is not a trustworthy origin: browsers ignore COOP there, and Telegram-specific features may fail.

For phone testing, expose the local server over HTTPS with a tunnel:

```bash
# Terminal 1: build and run the production server on port 3000
npm run build
npm start

# Terminal 2: create an HTTPS tunnel
cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

Set the tunnel URL in the server environment, then restart:

```dotenv
MINI_APP_URL=https://your-tunnel-host.example
CORS_ORIGINS=https://your-tunnel-host.example
TRUST_PROXY=1
```

Same-host LAN requests are allowed for ordinary browser testing, but use HTTPS for Telegram. See [Telegram setup](#telegram-setup) for the bot configuration.

### With PostgreSQL

```bash
# Create a database, then set DATABASE_URL in .env, for example:
# postgresql://postgres:postgres@localhost:5432/tictactoe?schema=public
# Set DIRECT_URL to the same local URL (Prisma uses it for migrations).

npm run db:migrate:dev   # create/apply migrations in development
# or, for an existing deployment:
npm run db:migrate       # prisma migrate deploy

npm run dev
```

Useful scripts:

```bash
npm run db:generate   # generate Prisma Client
npm run db:migrate    # apply committed migrations (deploy)
npm run db:studio     # inspect data
npm run db:cleanup    # run a maintenance pass once
```

### With Supabase

Supabase is hosted PostgreSQL, so no application code changes are needed. Use the connection strings from **Supabase Dashboard → Project Settings → Database**.

> **Do not use `SUPABASE_URL`, `SUPABASE_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` for this app.** Those are Supabase Data API/Auth keys, not PostgreSQL credentials. This server connects directly to the database with Prisma and does not use the Data API or Supabase Auth.

```dotenv
# Runtime: transaction pooler (IPv4-compatible, good for a long-running Node server)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require

# Migrations: session pooler (port 5432). On Render, do not use the
# direct db.<project-ref>.supabase.co host: it is IPv6-only.
DIRECT_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Then apply the committed migration and start the app:

```bash
npm run db:migrate
npm run build
NODE_ENV=production npm start
```

Notes:

- URL-encode special characters in the database password.
- Keep `sslmode=require`. Never expose the database URL or a Supabase service-role key to the browser; this app talks to the database only from the server.
- `DATABASE_URL` is used by Prisma Client at runtime. `DIRECT_URL` is used by Prisma Migrate (`db:migrate`, `start`, `start:prod`). The pooler on port 6543 cannot run migrations.
- The migration wrapper (`scripts/prisma-cli.mjs`) automatically points Prisma Migrate at `DIRECT_URL` when it is set, falling back to `DATABASE_URL` for local PostgreSQL.
- If your network lacks IPv6, use Supabase's **Session pooler** on port 5432 for `DIRECT_URL` (as shown above). Render does not support IPv6, so the direct `db.<project-ref>.supabase.co:5432` host fails with `P1001` there. The shared pooler host includes a cluster index (`aws-0-...` or `aws-1-...`) that cannot be inferred from the region; copy the exact string from **Supabase → Connect → Session pooler**.
- Prisma connects with the database role in the URL and does not use Supabase Row Level Security policies. The committed Supabase migration enables RLS on all game tables and revokes Data API grants from Supabase's `anon` and `authenticated` roles. This is intentional: the game server is the only database writer and enforces authorization. If you add a Supabase client or direct browser access, add explicit RLS policies and grants first.
- The Telegram login remains server-side `initData` verification; Supabase Auth is not required and is not used.

### Deploy production on Render

Two production Blueprints are included. Both set `DEMO_MODE=false`, `DB_MODE=postgres`, disable development auth, generate a persistent `SESSION_SECRET`, derive a Telegram-safe webhook secret from it, run Prisma migrations before the server starts, and expose `GET /health` for Render's health check. `MINI_APP_URL` and `CORS_ORIGINS` are derived from the Render service URL, and the Telegram webhook is registered automatically.

**Option A — Supabase (`render.yaml`)**

1. Create a Supabase project and copy the two PostgreSQL connection strings from **Project Settings → Database**:
   - `DATABASE_URL`: transaction pooler, port `6543`
   - `DIRECT_URL`: **Session pooler**, port `5432` (not the direct `db.<project-ref>.supabase.co` host on Render, which is IPv6-only)
2. Create a bot with [@BotFather](https://t.me/BotFather) and note its token and username.
3. Open the [Render Blueprint](https://render.com/deploy?repo=https://github.com/Heng-zm/tictac-game), connect the repository, and keep `render.yaml` as the Blueprint file.
4. Fill in `DATABASE_URL`, `DIRECT_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_BOT_USERNAME`. Do **not** use a Supabase `anon` or `service_role` key; this app connects directly to PostgreSQL.
5. Wait for the deploy and the `/health` check to pass, then set the bot's menu button to the service URL:
   **@BotFather → `/setmenubutton`**.
6. Verify the live service:
   ```bash
   npm run check:prod -- https://your-service.onrender.com
   ```

The first boot applies the committed migrations through `DIRECT_URL`. Render generates `SESSION_SECRET` once and keeps it across deploys; `TELEGRAM_WEBHOOK_SECRET` is derived from it unless you set one explicitly.

Existing services are handled too: an empty `NODE_ENV` is treated as unset and defaults to `production` on Render, and a Render-generated base64 `TELEGRAM_WEBHOOK_SECRET` is deterministically normalized to a Telegram-safe value at startup.

**Option B — Render Postgres (`render.postgres.yaml`)**

If you do not already have Supabase, use the alternative Blueprint. Render provisions the PostgreSQL database, injects both connection strings, and you only need to provide the Telegram bot token and username. When creating the Blueprint, select `render.postgres.yaml` as the Blueprint file.

> The included Blueprints use Render's free plan, which sleeps after inactivity. Sleep does not lose PostgreSQL data, but use a paid instance for an always-on game server. Supabase free projects may also pause after inactivity. Run a single instance: matchmaking queues and Socket.IO rooms are process-local.

### Temporary in-memory mode

For a demo where you do not want to connect a database yet, set:

```dotenv
DB_MODE=memory
```

This keeps users, matches, ratings, and history in process memory. **Everything is lost when the server restarts**, and it only works with one application instance. It is intended for temporary demos, not real production use. Telegram authentication is still required, so `SESSION_SECRET`, `MINI_APP_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_BOT_USERNAME` must still be configured. Omit `DATABASE_URL`/`DIRECT_URL` in this mode.

### Render zero-config demo (not production)

When the app is deployed to Render with **no** `DATABASE_URL` and **no** `TELEGRAM_BOT_TOKEN`, and `DEMO_MODE` is not explicitly disabled, it automatically starts a guest demo. The production Blueprints above set `DEMO_MODE=false`, so this fallback cannot activate there.

- `DB_MODE=memory` — no database, data resets on restart.
- `DEMO_MODE=true` — guest login is enabled; no Telegram bot is required.
- `MINI_APP_URL` and `CORS_ORIGINS` are derived from `RENDER_EXTERNAL_URL`.
- A random `SESSION_SECRET` is generated for that instance, so sessions reset on restart.

A **Demo mode** banner appears in the app. To switch to Telegram authentication, add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`; the app then uses Telegram login and stops using guest auth. To require real configuration and disable the automatic fallback, set `DEMO_MODE=false`.

## Environment

Copy `.env.example` to `.env`. Important variables:

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production`. Empty values are treated as unset; on Render they default to `production`. |
| `PORT` | Server port (default `3000`). |
| `DATABASE_URL` | PostgreSQL URL. Required in production unless `DB_MODE=memory`. For Supabase, use the transaction pooler URL. |
| `DB_MODE` | `postgres` or `memory`. Defaults to `postgres` when `DATABASE_URL` is set, otherwise `memory` outside production. `memory` in production is explicit and ephemeral. |
| `DEMO_MODE` | `true` enables guest login without Telegram and allows in-memory data. Render enables it automatically when neither `DATABASE_URL` nor `TELEGRAM_BOT_TOKEN` is configured. Set `false` to require real configuration. |
| `DIRECT_URL` | Session-pooler PostgreSQL URL (port `5432`) used by Prisma Migrate and the start entrypoint. Use the Session pooler, not Supabase's IPv6-only direct host, on Render. |
| `SESSION_SECRET` | At least 32 random characters. Required in production; placeholders are rejected. |
| `MINI_APP_URL` | Public HTTPS origin in production. Automatically set from `RENDER_EXTERNAL_URL` on Render when unset. |
| `TELEGRAM_BOT_TOKEN` | Server-only bot token. Required in production. |
| `TELEGRAM_BOT_USERNAME` | Bot username without `@`. Required for invite links in production. |
| `TELEGRAM_WEBHOOK_URL` | Optional. On Render with a bot token, derived automatically from `MINI_APP_URL`; otherwise set it to use a webhook instead of long polling. |
| `TELEGRAM_WEBHOOK_SECRET` | Required with an explicit webhook URL (16–256 chars; letters, digits, `_`, `-` only). On Render it is derived from `SESSION_SECRET` when unset, and incompatible base64 values are normalized automatically; set a safe explicit value to rotate it independently. |
| `DEV_AUTH_ENABLED` | Local guest auth. Rejected in production. |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. `MINI_APP_URL` is added automatically. |
| `DISCONNECT_GRACE_MS` | Reconnect grace period before a disconnect can forfeit (default 30s). |
| `TURN_TIMEOUT_MS` | Per-turn timeout; `0` disables turn timers. |
| `INVITE_TTL_MINUTES` | Invitation lifetime (default 24h). |
| `AUTH_MAX_AGE_SECONDS` | Maximum accepted `initData` age (default 24h). |
| `MAINTENANCE_INTERVAL_MS` | Background cleanup interval. |
| `MATCH_STALE_AFTER_MS` | Age after which an idle active/waiting match is abandoned. |
| `TRUST_PROXY` | Number of trusted reverse-proxy hops. Set to `1` behind one proxy. |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Production startup fails fast if required secrets, the HTTPS Mini App URL, or Telegram credentials are missing, or if development auth is enabled.

## Telegram setup

1. Create a bot with **@BotFather** and copy its token.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`.
3. Deploy the app behind HTTPS and set `MINI_APP_URL` to that public origin.
4. In **@BotFather**:
   - `/setmenubutton` → choose the bot → set the Mini App URL.
   - `/newapp` (or Mini App settings) → configure the Web App URL and short name.
5. Webhook. On Render, the app registers it automatically using the derived public URL and a Telegram-safe `TELEGRAM_WEBHOOK_SECRET` derived from `SESSION_SECRET`; no manual `setWebhook` call is needed. For other hosts, set both variables below or let the bot use long polling:

   ```dotenv
   TELEGRAM_WEBHOOK_URL=https://your-domain.example/api/telegram/webhook
   TELEGRAM_WEBHOOK_SECRET=<random 16-256 chars, letters/digits/_/->
   ```

   The app serves the webhook at `/api/telegram/webhook` and validates Telegram's secret header. If `TELEGRAM_WEBHOOK_URL` is unset outside Render, the bot starts long polling.

6. Invitations use `https://t.me/<BOT_USERNAME>?startapp=invite_<TOKEN>`. The bot's `/start` handler also recognizes `invite_<TOKEN>` payloads and opens the Mini App with the invitation.

### How Telegram authentication works

1. The client sends raw `initData` to `POST /api/auth/telegram`.
2. The server builds the data-check string from all fields except `hash`, sorted by key, and computes
   `HMAC_SHA256(HMAC_SHA256("WebAppData", botToken), dataCheckString)`.
3. It compares the signature in constant time, checks `auth_date` freshness, validates the user payload, and upserts the user.
4. The server returns an HttpOnly `ttt_session` cookie signed with `SESSION_SECRET`. HTTP and Socket.IO authentication use this cookie; the bot token is never sent to the client.

## Production build and run

```bash
npm ci
npm run build          # generates Prisma Client, client → dist/client, server → dist/server
npm run start:prod     # applies migrations, then starts dist/server/index.js
```

`npm start` and `npm run start:prod` use the same production entrypoint: they apply committed migrations through `DIRECT_URL` (falling back to `DATABASE_URL`) before boot. When neither URL is set (memory/demo mode), migrations are skipped. Put the process behind a TLS-terminating reverse proxy (Caddy, nginx, a platform load balancer) and set `TRUST_PROXY` appropriately.

Minimum production environment:

```dotenv
NODE_ENV=production
PORT=3000
DEMO_MODE=false
DB_MODE=postgres
DEV_AUTH_ENABLED=false
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SESSION_SECRET=<random 32+ chars>
MINI_APP_URL=https://your-domain.example
TELEGRAM_BOT_TOKEN=123456:...
TELEGRAM_BOT_USERNAME=your_bot
CORS_ORIGINS=https://your-domain.example
TRUST_PROXY=1
# Optional: set both to use a webhook instead of long polling.
# TELEGRAM_WEBHOOK_URL=https://your-domain.example/api/telegram/webhook
# TELEGRAM_WEBHOOK_SECRET=<random 16-256 chars, letters/digits/_/->
```

Health checks:

- `GET /health` — process is up.
- `GET /ready` — database is reachable (HTTP 503 when not ready).

Verify a deployed HTTPS instance, including production auth and demo-mode settings:

```bash
npm run check:prod -- https://your-service.onrender.com
```

GitHub Actions runs typecheck, lint, the PostgreSQL integration tests, and the production build on every push and pull request. Render's `checksPass` auto-deploy trigger waits for those checks before deploying.

### Single-instance note

Matchmaking queues, socket rooms, and AI timers live in process memory. Run **one application instance** unless you add a Socket.IO adapter and a shared queue. PostgreSQL remains the source of truth for matches and reservations.

## Testing

```bash
npm test               # all unit/integration tests
npm run test:coverage  # coverage report
npm run lint
npm run typecheck
```

The PostgreSQL repository suite is opt-in and runs only when `TEST_DATABASE_URL` is set:

```bash
# Use a dedicated throwaway database; tables are truncated between tests.
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tictactoe_test?schema=public"  # PowerShell
npx prisma migrate deploy
npx vitest run tests/prisma-repository.test.ts
```

Without `TEST_DATABASE_URL`, those tests skip cleanly.

## Verification

See [VERIFICATION.md](./VERIFICATION.md) for the exact commands, test counts, production smoke-test results, and the list of behavior that still requires real Telegram/Supabase/deployment verification.

## Project structure

```text
src/
  client/                 React UI, screens, hooks, socket client
  server/
    auth/                 Telegram initData verification + signed sessions
    bot/                  grammY bot and webhook
    database/             Repository contract, Prisma and memory implementations
    game/                 Rules, scoring, AI (minimax)
    matchmaking/          In-memory queue
    services/             Match lifecycle, invitations, profile, views
    sockets/              Socket.IO authentication, events, rate limits
    app.ts                Express app, HTTP API, security middleware
    create-server.ts      Composition root
  shared/                 Shared types, Zod payloads, socket event contracts
prisma/                   Schema and committed migrations
tests/                    Unit, HTTP, E2E, and gated PostgreSQL tests
```

## Game and security rules

- The server owns the board, turn order, result, and rating changes.
- Human rated games: win `+20`, draw `+5`, loss `−10`. AI games and abandoned/incomplete games are unrated.
- Move action IDs are unique per match; retries are idempotent.
- Socket actions verify that the authenticated user is a participant in the match room.
- Disconnects do not immediately end a game; the configured grace period applies.
- Invitation tokens are stored as SHA-256 hashes, expire, and can be accepted once.
- Sessions are HttpOnly, Secure in production, and signed. Production cookies use `SameSite=None` so the Mini App works inside Telegram Web's iframe; API mutations also enforce the origin allowlist.
- Rate limits apply to authentication, HTTP APIs, and socket events.
- CSP allows Telegram's script/frame origins while keeping `frame-ancestors` limited to Telegram.

## Limitations

- Real Telegram end-to-end behavior requires a bot token and an HTTPS deployment; local guest mode does not exercise Telegram's client.
- The in-memory repository is development-only and is never used when `NODE_ENV=production`.
- Horizontal scaling requires shared Socket.IO/pub-sub state and a distributed matchmaking queue.
- No payment, spectator, or tournament features.

## License

Private project. All rights reserved.
