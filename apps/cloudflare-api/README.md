# Cloudflare read API

KODI-402 implements the existing public read API against an app-owned D1
projection. KODI-403 adds the private snapshot-ingestion endpoint. Neither
component connects to MariaDB.

Commands:

```powershell
npm run types --workspace @kodi/cloudflare-api
npx wrangler d1 migrations apply kodi-web --local --config apps/cloudflare-api/wrangler.jsonc
npm run test --workspace @kodi/cloudflare-api
npm run build --workspace @kodi/cloudflare-api
```

The production D1 database is empty until the later synchronization tickets
are complete. Apply production migrations only as part of an explicitly
reviewed deployment step.

## Snapshot ingestion

`POST /api/internal/sync/snapshots` is reserved for the private LAN sync agent.
It accepts at most 50 movie/TV records and 1 MiB of JSON per request. Configure
its bearer credential as a Cloudflare-managed Worker secret; never add its value
to `wrangler.jsonc` or source control:

```powershell
npx wrangler secret put SYNC_TOKEN --config apps/cloudflare-api/wrangler.jsonc
```

For local development, put `SYNC_TOKEN` in an ignored `.dev.vars` file inside
`apps/cloudflare-api`. Snapshot batches use monotonically increasing integer
versions and unique batch IDs. Completing a snapshot atomically activates it
and removes superseded snapshot data.

`GET /api/sync/status` is public and secret-free. It reports the active
snapshot's completion time, duration, row counts, and whether it is older than
the configured `SYNC_STALE_AFTER_SECONDS` threshold. Stale snapshots continue
serving the normal read API. See `docs/KODI_SYNC_OPERATIONS.md` for scheduling,
monitoring, recovery, and rollback.
