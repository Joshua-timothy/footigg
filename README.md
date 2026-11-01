# FOOTIGG

A private, transparent **both-teams-to-score (GG / BTTS)** board for ten football competitions. Every pick shows its working, every prediction is frozen before kick-off, and the whole thing runs on free tiers only.

Built for one owner plus a few friends. No paid APIs, no external AI, no betting odds feed.

```
Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · shadcn/ui
Supabase Free Postgres (Prisma 6) · football-data.org Free · Vercel Hobby
```

---

## What it does

- **Daily GG board** for Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Championship, Eredivisie, Primeira Liga, Brasileirão and the Champions League.
- **Explainable picks.** Each match detail page lists every input, its fitted value, and the percentage-point swing in P(GG) when that input is neutralised.
- **Full scoreline matrix.** A Dixon-Coles adjusted 0–8 × 0–8 grid produces BTTS, 1X2, over/under, clean-sheet and fair-odds views.
- **Frozen predictions.** Picks are stored before kick-off with their exact inputs. The app never invents a pick after the fact.
- **Honest scoreboard.** Accuracy, Brier score, log loss, calibration buckets and per-league results, computed only from resolved picks.
- **League context.** Tables, scoring baselines and team-level GG rates for all ten competitions.
- **Zero-config demo.** With no database or API key, the app boots into a deterministic synthetic season that runs through the real prediction engine.
- **Private by default.** A shared access code and a signed, http-only session cookie gate the app.

> Predictions are probabilistic, not certainties. This is a personal tracking tool, not betting advice.

---

## Quick start (no keys, no database)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app detects that `DATABASE_URL` and `FOOTBALL_DATA_API_KEY` are missing and serves a synthetic season. The fixtures are generated, but ratings, probabilities, explanations and the score matrix all come from the production engine.

Useful commands:

```bash
npm run typecheck     # tsc --noEmit
npm run build         # prisma generate + next build
npm run lint          # next lint
```

> On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

---

## Live setup

### 1. Supabase (free)

1. Create a project at <https://supabase.com>.
2. Copy the **transaction pooler** connection string (port `6543`) into `DATABASE_URL`.
3. Copy the **direct/session** connection string (port `5432`) into `DIRECT_URL`.
4. Push the schema:

```bash
npm run db:push
npm run db:seed
npm run backfill
```

`db:seed` inserts the ten competitions. `backfill` loads the current and previous
season for all ten competitions through the season endpoint (20 requests, paced to stay
inside the free plan). It is the one-time history load; normal syncs only fetch short
windows around today.

### 2. football-data.org (free)

Register at <https://www.football-data.org/client/register> and put the key in `FOOTBALL_DATA_API_KEY`. The free plan includes all ten tracked competitions at 10 requests per minute.

### 3. Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | live mode | Supabase pooled Postgres URL |
| `DIRECT_URL` | migrations | Supabase direct Postgres URL |
| `FOOTBALL_DATA_API_KEY` | live mode | football-data.org token |
| `APP_ACCESS_CODE` | recommended | Shared code for you and friends |
| `AUTH_SECRET` | with access code | 32+ random chars; signs the session cookie |
| `CRON_SECRET` | recommended | Bearer token for `/api/cron/daily` |
| `DEMO_MODE` | no | `auto` (default), `on`, `off` |
| `NEXT_PUBLIC_TIMEZONE` | no | Display timezone, default `Europe/London` |

`DEMO_MODE=auto` falls back to demo whenever the database or API key is missing. `off` forces live mode and surfaces configuration errors.

### 4. First history load and sync

```bash
npm run backfill   # one-time: current + previous season for all ten competitions
npm run sync       # normal sync: four short windows around today
```

Or open **Settings → Sync now** after the app is running. The free plan caps a `/matches`
window at 10 days, so a normal sync uses four short windows (9 days back, then 21 days
ahead) plus a weekly-cached `/competitions` request.

---

## Deploy to Vercel Hobby

> **Step-by-step guide:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) has the exact Vercel
> CLI and dashboard sequence, every environment value, post-deploy verification and
> troubleshooting. The summary below is the short version.

1. Push the repository to GitHub and import it into Vercel (or use `vercel link`).
2. Add the environment variables from the table above (Production and Preview).
3. Deploy. `vercel.json` registers the single daily cron:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }] }
```

4. Set `CRON_SECRET`; Vercel sends it automatically as `Authorization: Bearer …`.
5. Run `npm run db:push`, `npm run db:seed` and `npm run backfill` once against the production database, then `npm run sync`.

The app also performs a **lazy sync** from page views, but only when the last successful run is older than `SYNC_MIN_INTERVAL_MINUTES` (default 30). A Postgres row lock prevents two serverless instances from syncing at once.

---

## Pages

| Route | What it shows |
| --- | --- |
| `/` | Daily board with date navigation, competition/pick/conviction filters and board stats |
| `/match/[id]` | Full explanation, score matrix, markets, ratings, form, head-to-head, data quality |
| `/competitions?league=PL` | League cards, tables, scoring baselines |
| `/performance` | Accuracy, Brier, log loss, calibration chart, per-league and per-conviction results |
| `/settings` | Mode, sync status, budget, configuration checklist, manual sync, sign out |
| `/login` | Access-code gate (disabled when no code is configured) |

---

## API

All JSON routes are protected by the same access gate as the UI.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/health` | `GET` | Public liveness probe: mode, model version, configured services |
| `/api/predictions?date=YYYY-MM-DD` | `GET` | Board payload with the same filters as the UI |
| `/api/predictions?id=123` | `GET` | One match detail payload |
| `/api/sync` | `POST` | Manual sync (settings page) |
| `/api/cron/daily` | `GET` | Daily sync, guarded by `CRON_SECRET` |

Supported board filters: `date`, `comp` (comma-separated codes), `pick=YES|NO`, `conviction=HIGH|MEDIUM|LOW`, `q`.

---

## Project structure

```
src/
  app/
    (app)/                 # authenticated shell: board, match, leagues, model, settings
    api/                   # health, predictions, sync, cron
    login/                 # access gate
  components/
    fixtures/              # board, cards, filters, stats
    prediction/            # ring, split, factors, heatmap, markets, verdict
    leagues/               # league cards and tables
    performance/           # metrics, calibration chart, accuracy, results
    layout/                # shell, brand, nav, status
    shared/                # headings, stats, crests, form dots, model dialog
    ui/                    # shadcn primitives
  lib/
    prediction/            # pure engine: math, features, engine, evaluate
    data/                  # repository interface, Prisma + demo repos, queries
    football-data/         # API client, mapper, budget ledger
    sync/                  # lock, upserts, prediction lifecycle, pruning
    auth/                  # HMAC session tokens, cookie helpers, server actions
  types/domain.ts          # shared domain types
prisma/
  schema.prisma            # Supabase schema
  seed.ts                  # competition seed
scripts/
  sync.ts                  # CLI sync
  backfill.ts              # repair/backfill + table counts
docs/
  ARCHITECTURE.md
  PREDICTION_MODEL.md
  FREE_TIER_BUDGET.md
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (demo by default) |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Production server |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Push schema to Supabase |
| `npm run db:seed` | Seed the ten competitions |
| `npm run sync` | One normal sync: four short match windows around today |
| `npm run backfill` | One-time history load (current + previous season), clear expired locks, print table counts |
| `npm run db:studio` | Prisma Studio |

---

## Design principles

1. **Free forever.** Every dependency has a permanent free tier and the app is budget-aware by construction. See `docs/FREE_TIER_BUDGET.md`.
2. **No black box.** The engine is pure TypeScript with no I/O. Explanations are produced by ablation, not by a language model.
3. **No hindsight.** A pick is stored before kick-off and never rewritten. Finished fixtures without a stored pick show “no pre-match pick recorded”.
4. **Fail soft.** Missing database, API key or sync failure degrades to demo data or stale data — never a crashed page.
5. **Small blast radius.** One repository interface, one sync service, one prediction engine. The UI depends only on domain types.

---

## Troubleshooting

**The app shows “Demo season”.** `DATABASE_URL` or `FOOTBALL_DATA_API_KEY` is missing, or `DEMO_MODE=on`. Check `/settings`.

**Sync says “Another sync is already running”.** A lock row is still held (5-minute TTL). Wait, or run `npm run backfill`, which clears expired locks.

**Sync says “Rate limit guard”.** Eight requests were made in the last minute. Wait 60 seconds; the ledger is in Postgres and shared across instances.

**No predictions for a finished match.** The fixture kicked off before a prediction was stored. This is intentional: the app will not create a pick after the result.

**Prisma cannot connect.** Use the pooled URL on port `6543` with `?pgbouncer=true&connection_limit=3&pool_timeout=20` for `DATABASE_URL`, and the direct URL on port `5432` for `DIRECT_URL`.

**Login redirects immediately.** The gate is disabled when `APP_ACCESS_CODE` or `AUTH_SECRET` is absent. That is the intended local-development behaviour.

---

## License

Private personal project. No license granted for redistribution.
