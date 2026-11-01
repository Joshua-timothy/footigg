# Free-tier budget

FOOTIGG is designed to run forever on permanent free tiers. That constraint drives
several architectural choices: one upstream request per sync instead of per fixture,
Postgres-backed rate limiting instead of in-memory counters, a daily cron plus a lazy
sync instead of polling, and aggressive render caching.

This document records the limits the app depends on, how much of each it actually uses,
and the signals that mean it is time to change something.

> Provider limits change. The numbers below reflect the plans at the time of writing;
> the **code-level guardrails** are the part that matters, because they keep the app
> well below the ceilings even if a limit is adjusted.

---

## 1. football-data.org (free plan)

| Limit | Value |
| --- | --- |
| Requests per minute | **10** |
| Competitions included | The ten tracked codes |
| Cost | Free |

The app treats **8 requests/minute** as its own ceiling (`SYNC.safeRequestsPerMinute`),
leaving two requests of headroom for retries and clock skew.

### How requests are spent

| Operation | Requests | Frequency |
| --- | --- | --- |
| `/matches` (9 days back → 21 days ahead, split into four ≤10-day windows) | 4 | Every sync |
| `/competitions` (names, emblems) | 1 | Cached 7 days in `ApiCache`; typically skipped |
| Season history (`/competitions/{code}/matches?season=…`, current + previous) | 20 | Once, from the CLI (`npm run backfill`) |
| 429 / network retry | 1 extra, only on failure | Rare |

A normal sync is **four real requests** plus the weekly metadata refresh. The one-time
history load is **20 requests**, run from the CLI where waiting between batches is safe.

There are no per-fixture, per-team or per-day requests.

### Sync cadence

| Trigger | Cadence | Requests/day (max) |
| --- | --- | --- |
| Vercel cron `/api/cron/daily` | Once daily at 05:00 UTC | ~5.14 (four windows + weekly metadata amortised) |
| Lazy sync from a board view | At most every `SYNC_MIN_INTERVAL_MINUTES` (default 30) | 48 × 5 = 240 |
| Manual "Sync now" | Human-triggered, budget-checked | — |

Worst case is therefore ~245 requests/day, spread across the day. The binding constraint
is **per minute**, and the app never comes close: a sync makes at most five requests in a
burst, the pre-flight check requires five free slots, and the lazy interval prevents a
second sync within 30 minutes.

### Guardrails in code

1. **Postgres ledger.** Every call writes an `ApiRequest` row. `getBudgetState()` counts
   the last 60 seconds, so the limit holds across serverless instances, cold starts and
   regions. Rows older than two hours are pruned.
2. **Pre-flight check.** `runSync` requires at least five free slots (four windows plus
   metadata) and returns `SKIPPED` otherwise; `footballDataFetch` refuses at zero.
3. **Lock.** A single `SyncLock` row with a five-minute TTL means concurrent page views
   cannot start parallel syncs.
4. **Interval guard.** `maybeLazySync` reads the last successful `SyncRun` and returns
   early unless it is older than the configured interval.
5. **Short-window design.** The free plan caps `/matches` at 10 days, so a sync walks four
   9-day windows instead of one long request. History comes from the season endpoint
   once, via the CLI-only `npm run backfill`.

### If you see 429s

- Check `/settings`: the API budget card shows requests in the last minute.
- Raise `SYNC_MIN_INTERVAL_MINUTES` (e.g. 60) — this halves lazy syncs.
- Do not lower `safeRequestsPerMinute`; it is already the safety margin.
- A manual sync loop is the usual cause. The ledger blocks it after 8 requests.

---

## 2. Vercel Hobby

| Limit | Value | App usage |
| --- | --- | --- |
| Cron jobs | One run per day on Hobby | One job, `0 5 * * *` |
| Function duration | 60 s maximum | `maxDuration = 60` on sync routes |
| Bandwidth | ~100 GB/month | A few MB/day for a handful of users |
| Deployments | Personal, non-commercial | Private tool |
| Serverless invocations | Generous for personal use | Board views + one cron/day |

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }] }
```

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is
set. The route also accepts `?secret=` for manual testing.

**Why the daily cron is enough:** the lazy sync covers the hours between cron runs, and
the board cache means most page views do not touch the database at all. The cron exists
to guarantee at least one sync per day even if nobody opens the app.

**Why not more frequent cron:** Hobby does not allow it. Do not add a second schedule
that effectively polls; use the lazy path instead.

---

## 3. Supabase Free Postgres

| Limit | Value | App usage (estimate) |
| --- | --- | --- |
| Database size | 500 MB | ~15–40 MB for several seasons |
| Egress | ~5 GB/month | A few hundred KB per board render, cached |
| Project pause | After ~7 days of inactivity | Prevented by the daily cron |
| Connections | Pooled; use port 6543 | One pooled client, reused |
| Cost | Free | — |

### Row and size estimates

| Table | Rows | Approx. bytes/row | Total |
| --- | --- | --- | --- |
| `Competition` | 10 | ~200 | negligible |
| `Team` | ~500 | ~250 | ~125 KB |
| `CompetitionTeam` | ~500/season | ~50 | ~25 KB/season |
| `Match` | ~4,000/season | ~250 (+ indexes) | ~2–4 MB/season |
| `Prediction` | ~4,000/season | ~2–4 KB (JSON blobs) | ~8–16 MB/season |
| `ApiCache` | < 100 | ~1 KB | < 100 KB |
| `ApiRequest` | < ~1,200 (2 h window) | ~100 | ~120 KB |
| `SyncRun` | ~365/year (pruned at 90 days) | ~300 | ~30 KB |
| `SyncLock` | 1 | ~100 | negligible |

A season is comfortably under 20 MB. Even with predictions kept for two years
(`prune()` deletes resolved picks older than 730 days), the database stays far below
500 MB.

### Pruning (runs after every sync)

- `ApiRequest` older than **2 hours** — keeps the ledger tiny.
- `ApiCache` rows past `expiresAt`.
- Resolved predictions older than **2 years**.
- `SyncRun` rows older than **90 days**.

### Connection notes

- `DATABASE_URL` → transaction pooler on port `6543`, with
  `?pgbouncer=true&connection_limit=3&pool_timeout=20`. Three slots let a
  background sync and a page render proceed without waiting on each other; the
  pooler still multiplexes them onto far fewer server connections.
- `DIRECT_URL` → direct/session connection on port `5432`, used by `prisma db push`.
- The Prisma client is a module-level singleton, reused across hot reloads.

### If the project pauses

Supabase pauses inactive free projects. The daily cron writes a `SyncRun` every day, so
the project stays active as long as the deployment and cron are alive. If the project has
already paused, restore it from the Supabase dashboard, then run `npm run backfill`.

---

## 4. Next.js caching budget

| Cache | TTL | Effect |
| --- | --- | --- |
| `unstable_cache` board / match / leagues / performance | 900 s (`BOARD_REVALIDATE_SECONDS`) | One DB read serves ~15 minutes of traffic |
| Sync status | 60 s | Settings stays fresh without hammering the DB |
| Competition metadata | 7 days (`ApiCache`) | `/competitions` is effectively free |
| Demo dataset | Per UTC hour + `DEMO_VERSION` | No DB, no API |

`revalidateTag("board")` runs after a successful manual, cron or API sync, so a sync is
visible immediately rather than after the TTL.

Development bypasses `unstable_cache` (`NODE_ENV === "development"`), which is why local
edits appear instantly and why the local app makes more DB queries than production.

---

## 5. What one user actually costs

Assume one owner plus three friends, each opening the board a few times a day:

- **Upstream API:** ~5 requests per 30 minutes while someone is active (four match
  windows plus occasional metadata), plus one cron sync. Call it 60–120 requests/day.
  The plan allows 10 **per minute** — roughly 14,400 per day if sustained — so usage is
  around 1%.
- **Vercel:** a few thousand requests/day at most, each rendering a cached page.
- **Supabase:** a handful of reads per cache miss, plus a small write batch per sync.
- **Storage:** tens of MB, growing by <20 MB per season.

The app is not near any limit, and the guardrails make it hard to get near one by
accident.

---

## 6. Upgrade triggers

| Symptom | First response | Upgrade only if |
| --- | --- | --- |
| Frequent 429s | Raise `SYNC_MIN_INTERVAL_MINUTES`, check for sync loops | Never — the free plan is sufficient at this scale |
| Database > 400 MB | Shorten prediction retention in `prune()` | You need multi-season history online |
| Supabase pausing | Confirm the cron is running and `CRON_SECRET` is valid | You need guaranteed uptime |
| Need sub-daily cron | Use the lazy sync path | You need scheduled syncs more than once a day (Vercel Pro) |
| More than a few friends | Keep the shared code; it is not per-user | You need real accounts and per-user data |
| Function timeouts | Reduce the history window or batch sizes | You need a bigger window than 420 days |

The intended answer to almost every row is **change a constant, not a plan**.

---

## 7. Cost summary

| Service | Plan | Monthly cost |
| --- | --- | --- |
| football-data.org | Free | $0 |
| Supabase | Free | $0 |
| Vercel | Hobby | $0 |
| Domain (optional) | — | Your choice |
| **Total** | | **$0** |

No paid API, no external AI model, no analytics service, no auth provider, no queue, no
redis. The only secrets are the football-data.org key, the access code, the auth secret
and the cron secret.
