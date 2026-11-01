# Architecture

FOOTIGG is a single Next.js application with one database, one upstream API, and one
pure prediction engine. The goal of the architecture is not scale — it is **auditability
on a free tier**: every prediction can be traced back to the exact inputs that produced
it, and every external call can be accounted for against a hard budget.

```
Browser
  │
  ▼
Next.js App Router (Vercel Hobby)
  ├── middleware.ts ............ access gate (HMAC cookie)
  ├── Server Components ........ pages render from queries.ts
  ├── Route Handlers ........... /api/health, /api/predictions, /api/sync, /api/cron/daily
  └── after() .................. lazy sync after a board render
        │
        ▼
  Data access (src/lib/data)
  ├── queries.ts ............... unstable_cache, 900 s, tag "board"
  ├── repository.ts ............ FootballRepository interface
  ├── prisma-repository.ts ..... live: Supabase Postgres
  ├── demo-repository.ts ....... fallback: deterministic synthetic season
  └── prediction-factory.ts .... fits models once per batch (no I/O)
        │
        ▼
  Prediction engine (src/lib/prediction) — pure TypeScript
        │
        ▼
  Sync service (src/lib/sync)
  ├── Postgres advisory lock (SyncLock)
  ├── budget ledger (ApiRequest)
  ├── upserts (Match, Team, Competition)
  ├── frozen predictions (Prediction)
  └── resolution + pruning
        │
        ▼
  football-data.org (10 req/min free plan)
```

## Layers and responsibilities

| Layer | Location | Responsibility | I/O |
| --- | --- | --- | --- |
| UI | `src/app`, `src/components` | Render domain objects, never query the API or DB directly | No |
| Data access | `src/lib/data/queries.ts` | Cache server renders and choose the repository | Cache only |
| Repository | `src/lib/data/repository.ts` + implementations | Turn storage into `Board`, `MatchDetail`, `PerformanceReport`, `LeagueOverview`, `SyncStatus` | Yes |
| Model fitting | `src/lib/data/prediction-factory.ts` | Fit league models once, reuse across fixtures | No |
| Engine | `src/lib/prediction` | Ratings, score matrix, blending, explanations, scoring | No |
| Upstream client | `src/lib/football-data` | Typed fetch, mapping, budget ledger | Yes |
| Sync | `src/lib/sync` | Lock, upsert, predict, resolve, prune | Yes |
| Auth | `src/lib/auth`, `src/middleware.ts` | Shared-code gate with signed cookie | Cookie only |

The engine imports nothing from the data or network layers. That is deliberate: the
same function that produced a stored pick can be re-run against the same inputs and
must return the same numbers.

## Request flow: board

1. `src/app/(app)/page.tsx` parses `searchParams` with `parseBoardFilters`.
2. `getBoardData(filters)` hits `unstable_cache` (900 s, tag `board`) in production;
   development bypasses the cache so edits appear immediately.
3. `PrismaRepository.getBoard` loads a single match window: 420 days back and 21 days
   forward, with teams included (`loadMatchWindow`-style query).
4. Fixtures on the requested date are matched to stored `Prediction` rows.
   - Stored row → `hydratePrediction` keeps the frozen probability, factors, markets
     and ratings, but recomputes **form and head-to-head for display** at the
     pre-kickoff cutoff.
   - Upcoming fixture with no stored row → the engine predicts it live and the row is
     inserted with `createMany({ skipDuplicates: true })`.
   - Kickoff already passed and no stored row → `prediction: null`. The app will not
     invent a pick with hindsight.
5. Filters (`comp`, `pick`, `conviction`, `q`) are applied in memory, stats are derived
   with `statsFor`, and the board is returned.
6. `after()` calls `maybeLazySync("board-view")`, which is a no-op unless the last
   successful run is older than `SYNC_MIN_INTERVAL_MINUTES` (default 30).

## Request flow: match detail

`PrismaRepository.getMatchDetail` uses `cutoff = min(now, kickoff)`, so a finished
match is explained with the data that existed **before** it kicked off:

- Context query: 420 days of the same competition plus any match involving either team,
  all with `kickoff <= cutoff`.
- Stored prediction → hydrated exactly like the board.
- No stored prediction and the match is still upcoming → live preview (not persisted;
  persistence belongs to the sync job).
- No stored prediction and the match has started → `prediction: null`.

## Request flow: sync

`runSync({ trigger, force })` is the only writer.

```
flags.database && flags.api ?          ── no ──▶ SKIPPED
budget.remaining > 0 ?                 ── no ──▶ SKIPPED ("Rate limit guard")
acquireLock(owner)                     ── no ──▶ SKIPPED ("Another sync is running")
create SyncRun(RUNNING)
  upsertCompetitions()                 ← /competitions, cached 7 days in ApiCache
  footballDataFetch("/matches") × 4    ← 9 d back + 21 d ahead, in 10-day windows
  upsertTeamsAndMatches(records)       ← deduped by id; one bulk statement per chunk
  createUpcomingPredictions(now)       ← missing rows only, kickoff > now, within 21 d
  resolveFinishedPredictions()         ← up to 200 rows; Brier, log loss, correctness
  prune()                              ← API ledger, expired cache, 2-year-old picks, 90-day runs
update SyncRun(SUCCESS, counters, detail)
releaseLock(owner)                     ← always in finally
```

The lock is a single `SyncLock` row claimed with an atomic `INSERT … ON CONFLICT …
WHERE expiresAt < now()` and a five-minute TTL. Two cold serverless instances can race
the request, but only one can claim the row.

`upsertCompetitions` always costs one request in the counter, but the actual
`/competitions` call is skipped while the `competitions:v4` cache row is fresh (seven
days). A normal sync is therefore **four `/matches` requests** plus, once a week, the
metadata request. The free plan caps a `/matches` window at 10 days, which is why the
sync walks short windows instead of one long one.

The four responses are collected and deduped before writing (boundary days appear in two
windows). Matches and teams are written with multi-row `INSERT … ON CONFLICT` statements
of up to 400 rows; resolved predictions and competition seasons use one `UPDATE … FROM
(VALUES …)` each. This matters on the Supabase pooler, where each statement carries
noticeable latency: a sync does a handful of round trips instead of one per row, so it
finishes inside the 60-second function budget even on a slow connection.

### History backfill

A fresh database has no ratings history. `npm run backfill` calls
`backfillSeasonHistory`, which uses `/competitions/{code}/matches?season=…` to load the
current and previous season for all ten competitions — 20 requests, paced by the same
Postgres budget ledger (it sleeps when the 8-requests-per-minute guard is reached). It is
a CLI-only operation; the serverless sync never attempts it. Run it once after
`prisma db push`, then let the cron and lazy sync keep the data current.

## Failure modes

| Situation | Behaviour |
| --- | --- |
| No `DATABASE_URL` or no API key | `DEMO_MODE=auto` serves the synthetic season; `/settings` shows what is missing |
| Sync lock held | `SKIPPED`, reason surfaced in settings; no writes |
| Eight requests in the last minute | `SKIPPED` before any network call; ledger shared across instances |
| football-data.org 429 | One retry after `Retry-After` (capped at 8 s); then `FAILED` |
| Network timeout | One retry, then `FAILED`; the previous data stays readable |
| `/competitions` fails | Sync fails as a whole; the daily cron retries the next day and the lazy path retries after 30 min |
| Prediction insert conflict | `skipDuplicates` keeps the first frozen row; a stored pick is never overwritten |
| Database unreachable during render | Repository returns constants/demo where possible; the page still renders |
| Lazy sync throws | Swallowed by `after()`; readers never see background failures |

## Auth

- Gate is enabled only when **both** `APP_ACCESS_CODE` and `AUTH_SECRET` are present.
  Otherwise local development runs open.
- `src/lib/auth/token.ts` signs `v1.<expiresAtMs>` with HMAC-SHA256 using Web Crypto,
  so it works in the Edge runtime used by middleware.
- The cookie is `httpOnly`, `sameSite=lax`, `secure` in production, and expires after
  30 days. Comparisons use a constant-time helper.
- Middleware redirects unauthenticated page requests to `/login?next=…` and returns 401
  for `/api/*`. `/login`, `/api/health` and static assets are exempt.
- `safeNext` only accepts same-origin paths, so the login form cannot be used as an
  open redirect.

## Caching

| Cache | Where | TTL | Invalidation |
| --- | --- | --- | --- |
| Rendered board / match / leagues / performance | `unstable_cache` in `queries.ts` | 900 s (`BOARD_REVALIDATE_SECONDS`) | `revalidateTag("board")` after any successful sync |
| Sync status | `unstable_cache` | 60 s | Same tag |
| Competition metadata | Postgres `ApiCache` | 7 days | Expiry + `prune()` |
| Upstream HTTP | `fetch(..., { cache: "no-store" })` | none | Deliberate — all caching is explicit |
| Demo dataset | `globalThis.__footiggDemo` | Per UTC hour + `DEMO_VERSION` | Version bump on data changes |

Development intentionally bypasses `unstable_cache`; production uses it. This keeps
local iteration fast without weakening the deployed budget.

## Database schema

| Model | Purpose | Approx. size |
| --- | --- | --- |
| `Competition` | Ten tracked codes, season, display order | 10 rows |
| `Team` | football-data.org team identity + crest | ~500 rows |
| `CompetitionTeam` | Team ↔ competition ↔ season membership | ~500 rows/season |
| `Match` | Fixtures, scores, status, BTTS flag | ~4,000 rows/season |
| `Prediction` | Frozen pick + JSON explanation + resolution metrics | ~4,000 rows/season |
| `ApiCache` | Slow-changing upstream payloads | < 100 rows |
| `ApiRequest` | Rolling budget ledger, pruned after 2 hours | < ~1,200 rows |
| `SyncRun` | Audit trail of every sync, pruned after 90 days | ~1 row/day |
| `SyncLock` | Single-row advisory lock | 1 row |

Indexes follow the read paths: `Match(kickoff)`, `Match(competitionCode, kickoff)`,
`Match(status, kickoff)`, `Match(homeTeamId, kickoff)`, `Match(awayTeamId, kickoff)`,
`Prediction(resolvedAt)`, `Prediction(modelVersion, resolvedAt)`, `ApiRequest(createdAt)`.

`Prediction.inputs` stores the explanation, scorelines, baseline and ratings, so a
historic pick remains explainable after the model or the league changes. Only
`resolvedAt`, `actualBtts`, `correct`, `brier` and `logLoss` are written after kickoff.

## Demo mode

`DemoRepository` shares `applyFilters`, `statsFor`, `buildLeagueOverviews`,
`PredictionFactory` and the engine with the live repository. The only difference is the
source of `MatchRecord[]`: a deterministic synthetic season generated from a seeded RNG.
Consequences:

- The demo is a genuine backtest of the engine, not mocked numbers.
- UI work needs no database, no key and no network.
- `DEMO_VERSION` and the UTC hour form the cache key, so changing the generator without
  bumping the version would serve stale data — bump it whenever demo data changes.

## Extension points

- **Another competition** → add it to `COMPETITIONS`; the sync request already sends a
  comma-separated list of all codes.
- **A new signal** → add it to `PredictInput`, blend it in `combine`, and ablate it in
  `factors`. The UI renders factors generically.
- **A different data source** → implement `FootballRepository` and return it from
  `getRepository()`. Nothing above the interface changes.
- **A different model** → bump `MODEL.version`. New picks carry the new version; old
  picks keep theirs, so the performance page can compare them.
