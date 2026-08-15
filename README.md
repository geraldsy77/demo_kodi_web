# KODI Web

A responsive web interface for an existing KODI video library. The production
site is hosted at [kodi.glabs.my](https://kodi.glabs.my).

## Current design

```text
Browser
  -> Cloudflare Pages (React + Vite)
  -> Pages Function /api proxy
  -> Cloudflare Worker read API
  -> Cloudflare D1 read model

Windows private-LAN host
  -> SELECT-only access to KODI MariaDB on Synology
  -> authenticated outbound HTTPS snapshot upload
  -> Cloudflare Worker ingestion endpoint
  -> atomic D1 snapshot activation
```

Cloudflare never connects directly to the NAS. MariaDB remains private and its
port 3306 must never be exposed to the Internet. The synchronization agent
copies only the fields required by the public API into an app-owned D1 read
model. A failed, partial, or stale synchronization leaves the last completed
snapshot online.

The original Node/Express API and Docker Compose deployment remain available as
the Stage 1 LAN fallback. The current Synology DS115j cannot run Container
Manager, so Docker Desktop on the Windows LAN host is the selected local host.
An experimental native DSM fallback can also run the prebuilt React site and
Express API as one LAN-only Node.js 18 process; see
[Native DSM hosting](docs/NATIVE_DSM_HOSTING.md).

## Repository layout

```text
apps/api/              Node/Express Stage 1 API and LAN sync agent
apps/web/              React UI and Cloudflare Pages Function
apps/cloudflare-api/   Worker read API, ingestion API, and D1 migrations
apps/cloudflare-probe/ Cloudflare feasibility probe
docs/                  Architecture, schema, backlog, and runbooks
scripts/               Windows synchronization scheduling scripts
```

## Requirements

- Node.js 22 or newer
- npm
- Docker Desktop for the optional Stage 1 local deployment
- A private-LAN connection to the Synology MariaDB server for discovery and sync
- Wrangler authentication for Cloudflare deployment

Install workspace dependencies:

```powershell
npm install
```

## Configuration

Copy `.env.example` to `.env` and provide local values. `.env` is ignored by
Git and must never be committed.

Important settings:

- `KODI_DB_HOST`, `KODI_DB_PORT`: private MariaDB address and port.
- `KODI_DB_USER`, `KODI_DB_PASSWORD`: dedicated SELECT-only account.
- `KODI_VIDEO_DB`: discovered versioned database, such as `MyVideos121`.
- `KODI_SYNC_ENDPOINT`: HTTPS Worker ingestion endpoint.
- `KODI_SYNC_TOKEN`: secret matching the Worker `SYNC_TOKEN` secret.
- `KODI_SYNC_STATE_FILE`: non-sensitive partial-upload resume state.
- `KODI_SYNC_STATUS_FILE`: non-sensitive last-run status.

Discover the actual KODI video database instead of guessing its suffix:

```powershell
npm run db:discover --workspace @kodi/api
```

## Development

Run the Stage 1 API and web development servers:

```powershell
npm run dev
```

Or run the production-style local containers:

```powershell
docker compose up --build -d
docker compose ps
```

The local website is available at `http://localhost:8181`; the diagnostic API
is published at `http://localhost:3001`.

Create a compiled LAN-only release for the verified DS115j native runtime:

```powershell
npm.cmd run package:nas
```

This produces `dist-nas/kodi-web-nas-release.tar.gz`. Build tooling remains on
the laptop; the NAS installs and runs production dependencies only.

## Public API

- `GET /api/health`
- `GET /api/library/summary`
- `GET /api/movies?page=1&pageSize=24`
- `GET /api/movies/:id`
- `GET /api/tvshows?page=1&pageSize=24`
- `GET /api/tvshows/:id`
- `GET /api/search?q=term&page=1&pageSize=24`
- `GET /api/sync/status`

The status endpoint reports the active snapshot's last-success time, duration,
row counts, and current/stale state without exposing credentials. The private
`POST /api/internal/sync/snapshots` endpoint is authenticated and is not
forwarded by the public Pages proxy.

## Synchronization operations

Run a manual synchronization from the private LAN host:

```powershell
npm run sync:kodi --workspace @kodi/api
```

After the Worker secret and local `.env` values are configured, register the
default daily 03:00 Windows task from an elevated PowerShell window:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-kodi-sync-task.ps1 -DailyAt 03:00
```

The runner prevents overlapping executions, resumes safe partial uploads, and
records non-sensitive status locally. See
[KODI synchronization operations](docs/KODI_SYNC_OPERATIONS.md) for monitoring,
manual recovery, and rollback.

## Cloudflare deployment

Generate Worker types, apply reviewed D1 migrations, and deploy the API:

```powershell
npm run types --workspace @kodi/cloudflare-api
npx wrangler d1 migrations apply kodi-web --remote --config apps/cloudflare-api/wrangler.jsonc
npx wrangler deploy --config apps/cloudflare-api/wrangler.jsonc
```

Deploy the tested frontend to preview before production:

```powershell
npm run pages:deploy:preview --workspace @kodi/web
npm run pages:deploy:production --workspace @kodi/web
```

Do not run remote migrations or deployments blindly. Review the target account,
database, and generated changes first.

## Quality checks

Run the repository-wide Definition of Done checks:

```powershell
npm run lint
npm run test
npm run build
```

MariaDB integration tests are opt-in and use the configured SELECT-only account:

```powershell
$env:KODI_INTEGRATION_TEST='true'
npm run test --workspace @kodi/api
```

## Security and data ownership

- Never commit `.env`, `.dev.vars`, tokens, passwords, certificates, or private keys.
- Never expose MariaDB publicly or place its credentials in Cloudflare source/config.
- The application must not migrate or modify KODI-owned tables.
- Use explicit, parameterized SELECT queries and the verified KODI schema.
- Keep `SYNC_TOKEN` in Cloudflare-managed secrets and the ignored LAN `.env`.
- D1 is an eventually consistent read model, not a backup of the KODI database.

## Project workflow and documentation

Development follows one Jira-style ticket at a time in
[JIRA_BACKLOG.md](docs/JIRA_BACKLOG.md), under the rules in [AGENTS.md](AGENTS.md).
Architecture details are in [ARCHITECTURE.md](docs/ARCHITECTURE.md), and the
completion checklist is in [DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md).
