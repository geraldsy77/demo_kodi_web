# API and private-LAN sync agent

This workspace has two roles:

1. It provides the Node/Express Stage 1 API used by the local Docker deployment.
2. It runs the Stage 2 synchronization agent, which reads KODI MariaDB with a
   SELECT-only account and uploads bounded snapshots to the Cloudflare Worker.

The production Cloudflare website reads the app-owned D1 projection through
`apps/cloudflare-api`; it does not connect directly to this Express service or
to MariaDB.

## Stage 1 API

Available endpoints:

- `GET /api/health`
- `GET /api/library/summary`
- `GET /api/movies?page=1&pageSize=24`
- `GET /api/movies/:id`
- `GET /api/tvshows?page=1&pageSize=24`
- `GET /api/tvshows/:id`
- `GET /api/search?q=term&page=1&pageSize=24`

List endpoints allow a maximum `pageSize` of 100. Search queries allow a
maximum of 100 characters. Artwork is returned only as credential-free HTTPS
URLs; unsupported or unsafe KODI artwork values become `null`.

Run the API locally:

```powershell
npm run dev --workspace @kodi/api
```

When `WEB_DIST_PATH` is configured, Express also serves the compiled React
application and returns `index.html` for non-API deep links. `API_HOST` controls
the bind address; the native DSM pilot binds to `127.0.0.1` behind DSM's reverse
proxy. See [Native DSM hosting](../../docs/NATIVE_DSM_HOSTING.md).

## Database discovery

KODI database names are versioned. With the private MariaDB connection values
configured in the root `.env`, discover the available databases:

```powershell
npm run db:discover --workspace @kodi/api
```

Set `KODI_VIDEO_DB` to the verified result. Do not guess table names or schema
versions, and do not grant this application write access to KODI tables.

## Cloudflare snapshot synchronization

Configure the HTTPS ingestion endpoint and matching secret in the ignored root
`.env`, then run:

```powershell
npm run sync:kodi --workspace @kodi/api
```

`KODI_SYNC_DRY_RUN=true` validates a complete local export without uploading.
Normal runs persist non-sensitive resume state and last-run status in ignored
files. Completed snapshots are activated atomically; failed or partial uploads
leave the previous D1 snapshot available.

Windows scheduling, status monitoring, recovery, and Stage 1 rollback are
documented in [KODI_SYNC_OPERATIONS.md](../../docs/KODI_SYNC_OPERATIONS.md).

## Verification

```powershell
npm run lint --workspace @kodi/api
npm run test --workspace @kodi/api
npm run build --workspace @kodi/api
```

Repository tests use mocks by default. To include read-only integration tests
against the configured MariaDB database:

```powershell
$env:KODI_INTEGRATION_TEST='true'
npm run test --workspace @kodi/api
```

## Security

- Keep `.env`, tokens, passwords, and connection details out of Git and logs.
- Keep MariaDB private to the LAN; never expose port 3306 publicly.
- Use a dedicated SELECT-only MariaDB account.
- Never migrate, alter, or otherwise write to the KODI-owned schema.
- Keep the Worker `SYNC_TOKEN` in Cloudflare-managed secrets.
