# Deployment guide — Vercel Hobby

This is the exact sequence to put FOOTIGG online for free. The Supabase database is
already provisioned and populated; you only need to create the Vercel project, add the
environment variables, and deploy.

> **Secrets live in `.env.local`, which is gitignored.** Never commit that file or paste
> its contents into a public repository. The values below are the same ones; copy them
> from `.env.local` when you fill the Vercel form.

---

## 0. What is already done

| Step | Status |
| --- | --- |
| Prisma schema pushed to Supabase | Done |
| Ten competitions seeded | Done |
| Current + previous season backfilled | Done — 6,930 fixtures, 216 teams |
| Upcoming predictions stored | Done — 215 frozen picks (8 already resolved) |
| Local production build | Done |

The database already has history, so you do **not** need to run `npm run backfill` again
unless you move to a different Supabase project.

---

## 1. Create the Vercel project

You need a Vercel account (Hobby plan). Pick one of the two paths.

### Option A — Vercel CLI (no GitHub required)

From this folder:

```bash
npm i -g vercel
vercel login
vercel link          # create a new project when prompted
```

When asked:

- **Set up and deploy?** Yes
- **Which scope?** Your personal account
- **Link to existing project?** No
- **Project name:** `footigg` (or anything you like)
- **Directory:** `./`
- **Override settings?** No

Do not deploy yet — add the environment variables first.

### Option B — Vercel dashboard with a Git repository

1. Create a GitHub repository and push this folder to it.
2. In Vercel: **Add New → Project → Import** the repository.
3. Framework preset: **Next.js** (detected automatically).
4. Build command: `npm run build` (already in `package.json`).
5. Do not deploy yet — add the environment variables first.

---

## 2. Environment variables

In Vercel: **Project → Settings → Environment Variables**. Add each variable to
**Production** (and **Preview** if you want preview deployments to work).

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Supabase transaction pooler, port `6543` | Must include `?pgbouncer=true&connection_limit=3&pool_timeout=20` |
| `DIRECT_URL` | Supabase direct/session, port `5432` | Used by Prisma tooling |
| `FOOTBALL_DATA_API_KEY` | your football-data.org token | Free plan |
| `APP_ACCESS_CODE` | `$footigg` | Paste the literal value, **no backslash** |
| `AUTH_SECRET` | the value from `.env.local` | 32+ random characters |
| `CRON_SECRET` | the value from `.env.local` | Bearer token for the daily cron |
| `DEMO_MODE` | `auto` | Falls back to demo only if a dependency is missing |
| `BOARD_REVALIDATE_SECONDS` | `900` | 15-minute render cache |
| `SYNC_MIN_INTERVAL_MINUTES` | `30` | Lazy sync interval |
| `SYNC_STALE_AFTER_MINUTES` | `90` | “Data stale” badge threshold |
| `NEXT_PUBLIC_TIMEZONE` | `Europe/London` | Change if you prefer another zone |

### Important: the access code and `$`

In `.env.local`, the code is written as `\$footigg` so that Next.js's dotenv parser does
not treat `$footigg` as a variable reference. In the **Vercel dashboard**, paste the
literal value:

```
$footigg
```

No backslash. Vercel stores environment values verbatim.

### Where to copy the secrets

Open `.env.local` in this folder and copy each value. The database URLs are long; copy
them whole, including the query string on `DATABASE_URL`.

---

## 3. Deploy

### CLI

```bash
vercel --prod
```

The first deployment runs `prisma generate && next build`. It should finish in under a
minute. Vercel prints the production URL.

### Dashboard

Click **Deploy**. Wait for the build to finish, then open the production URL.

---

## 4. Verify the deployment

Replace `https://your-app.vercel.app` with your URL.

1. **Health probe**

   ```bash
   curl https://your-app.vercel.app/api/health
   ```

   Expected:

   ```json
   {
     "ok": true,
     "mode": "live",
     "checks": { "database": true, "footballData": true, "accessGate": true }
   }
   ```

2. **Access gate** — open `/`. You should be redirected to `/login`. Enter `$footigg`.
   The board should open with real fixtures and no “Demo season” badge.

3. **Settings** — `/settings` should show:
   - Data mode: **Live**
   - Database: **Connected**
   - football-data.org key: **Set**
   - Access gate: **Enabled**
   - A successful sync under “Last run”

4. **Match page** — open any fixture. The explanation, score matrix, markets, form and
   head-to-head sections should all render.

5. **Cron** — Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. To test
   manually:

   ```bash
   curl -i https://your-app.vercel.app/api/cron/daily
   # 401 without the header (expected)

   curl -i -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-app.vercel.app/api/cron/daily
   # 200 with status SUCCESS or SKIPPED
   ```

   `SKIPPED` with “Recently synced” or “Rate limit guard” is a healthy response — it
   means the guardrails are working, not that the deployment is broken.

---

## 5. Cron schedule

`vercel.json` already contains the only cron Vercel Hobby allows:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }] }
```

That is 05:00 UTC every day. The app also performs a lazy sync after a board view when
the last successful run is older than 30 minutes, so the data stays fresh between cron
runs without exceeding the free plan.

No additional cron configuration is needed. Do not add a more frequent schedule; Hobby
does not support it.

---

## 6. After deployment

- **First visit:** the board is cached for 15 minutes. If you deploy immediately after a
  sync, the first render may already be fresh; otherwise it will refresh within the TTL.
- **Manual sync:** Settings → **Sync now** runs a normal sync (four match windows). The
  page revalidates immediately after a successful run.
- **New season:** the daily sync keeps fixtures current. At the start of a new season,
  run `npm run backfill` once from your machine against the same database to pull the new
  season and the previous one. It is a CLI operation, not a serverless one.
- **Supabase pause:** the daily cron writes a `SyncRun` row, which keeps the free project
  active. If the project is paused manually, restore it in Supabase and run
  `npm run backfill`.
- **Custom domain:** Vercel → Project → Settings → Domains. Add the domain and follow the
  DNS instructions. No app change is needed.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/api/health` says `"mode": "demo"` | `DATABASE_URL` or `FOOTBALL_DATA_API_KEY` missing in Vercel | Add both, redeploy |
| `checks.database: false` | `DEMO_MODE=on`, or the pooled URL is wrong | Set `DEMO_MODE=auto`; check port `6543` and `pgbouncer=true` |
| Login rejects `$footigg` | The value was saved with a backslash, or `AUTH_SECRET` is missing | Store the literal `$footigg`; set `AUTH_SECRET` |
| Cron returns 401 | `CRON_SECRET` differs between Vercel and the request | Copy the same value; Vercel sends it automatically |
| Sync says “Rate limit guard” | Eight requests in the last minute | Wait 60 seconds; the ledger is in Postgres |
| Sync says “Another sync is already running” | A lock row is still held (5-minute TTL) | Wait, or run `npm run backfill` locally to clear expired locks |
| Sync returns 400 “period must not exceed 10 days” | An old build used one long window | Deploy the current build; it uses four short windows |
| Board is empty on a date | No fixtures in the tracked competitions that day | Use the date navigation or pick another competition |
| Prisma cannot connect at build time | `DATABASE_URL`/`DIRECT_URL` missing in Vercel | Add both to Production and Preview |
| Supabase project paused | Free project inactivity | Restore in Supabase; the cron keeps it awake afterwards |

---

## 8. Security checklist

- `.env.local` is gitignored. Do not commit it.
- Do not put real secrets in this guide, README, or any tracked file.
- The access code is shared by design; rotate it by changing `APP_ACCESS_CODE` in Vercel
  and redeploying. Existing sessions remain valid until they expire (30 days) or the
  `AUTH_SECRET` is rotated (which invalidates all sessions).
- If the football-data.org key leaks, regenerate it in their dashboard and update
  `FOOTBALL_DATA_API_KEY`.
- The database password is only in `.env.local` and Vercel's encrypted environment
  variables. Do not reuse it anywhere else.

---

## 9. Cost

| Service | Plan | Monthly |
| --- | --- | --- |
| Vercel | Hobby | $0 |
| Supabase | Free | $0 |
| football-data.org | Free | $0 |
| **Total** | | **$0** |

See `docs/FREE_TIER_BUDGET.md` for the request and storage accounting.
