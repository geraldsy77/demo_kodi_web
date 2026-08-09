# Architecture

## Stage 1 — Legacy Synology plus external LAN host

```text
Browser
   |
   v
React/Vite Web (external LAN container :8181)
   |
   | HTTP /api
   v
Node/Express API (external LAN container :3001)
   |
   | private TCP 3306
   v
MariaDB on Synology
   |
   +-- MyVideos###
   +-- MyMusic## (optional later)
```

The DS115j cannot run Container Manager. KODI-303 therefore selects another
LAN device as the Docker host while retaining MariaDB on the NAS. See
`docs/LEGACY_DSM_HOSTING_FEASIBILITY.md` for the evaluated alternatives and
operational constraints.

### Principles

- Browser never connects to MariaDB.
- Browser never receives DB credentials.
- API is the only DB access layer.
- Stage 1 starts read-only.
- KODI owns its schema; this project owns no KODI migrations.
- API DTOs isolate the frontend from KODI table details.

## Suggested application layers

### Web
- `pages/`: route-level screens.
- `components/`: reusable UI.
- `features/`: feature-specific state/components where needed.
- `services/api.ts`: all HTTP calls.
- `types/`: frontend TypeScript models.

### API
- `routes/`: HTTP route registration.
- `controllers/`: request/response translation.
- `services/`: application rules/use cases.
- `repositories/`: KODI SQL and DB mapping.
- `db/`: connection pool.
- `config/`: validated environment.
- `middleware/`: errors, request logging, security.
- `types/`: DTOs/internal types.

Dependency direction:
`route -> controller -> service -> repository -> db`

## Stage 2 — Cloudflare

```text
Browser
   |
   v
Cloudflare Pages
   |
   v
Cloudflare Worker API
   |
   v
Cloudflare D1 read model

Private LAN sync host
   |
   | SELECT-only
   v
MariaDB on Synology
   |
   | authenticated outbound HTTPS snapshots
   v
Cloudflare Worker sync endpoint -> D1
```

KODI-401 selects an app-owned D1 read model populated by an outbound sync
agent. Cloudflare never initiates a connection to the NAS, and MariaDB remains
private. The cloud copy is eventually consistent and contains only the fields
required by the public API contract; it is not a backup or replica of the
KODI-owned schema.

KODI-404 implements the sync agent as the `sync:kodi` CLI in the existing API
workspace so it reuses validated SELECT-only MariaDB configuration. It exports
bounded pages of verified DTO fields, retries deterministic HTTPS batches, and
persists only non-sensitive resume metadata. See `docs/KODI_SYNC_AGENT.md`.

## Stage 2 design constraint from day one

The frontend must depend only on the HTTP API contract, not Express implementation details. This makes it possible to replace the Express API with a Worker later.

## Database safety

Create a dedicated MariaDB account similar to:

```sql
CREATE USER 'kodi_web_readonly'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT ON `MyVideosXXX`.* TO 'kodi_web_readonly'@'%';
FLUSH PRIVILEGES;
```

Adjust host restrictions to your actual Docker/NAS network. Prefer a specific subnet/host rather than `%` when practical.

Do not run the sample blindly until the actual database name and network source are known.
