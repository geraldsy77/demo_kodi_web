# Jira Backlog

Project key: `KODI`

Workflow:
`BACKLOG -> READY -> IN PROGRESS -> REVIEW -> DONE`

Suggested sprint length: 1–2 weeks. For solo/Codex development, treat a sprint as a small batch of tickets and still execute one ticket at a time.

---

# EPIC KODI-E1 — Foundation & Safe Database Access

## KODI-001 — Bootstrap repository and health API
**Type:** Story  
**Priority:** Highest  
**Sprint:** Sprint 1  
**Status:** DONE  
**Story points:** 3

**User story**  
As the developer, I want a reproducible project skeleton so that every later feature is built and tested consistently.

**Acceptance criteria**
- npm workspace contains `apps/api` and `apps/web`.
- API is TypeScript + Express.
- Web is React + Vite + TypeScript.
- `GET /api/health` returns 200 and JSON.
- Environment variables are validated at API startup.
- `.env.example` contains no real secrets.
- Lint, test, and build scripts exist.
- Dockerfiles exist for API and web.
- Docker Compose can build both services.

**Codex instruction**
Do not implement KODI library queries in this ticket.

---

## KODI-002 — MariaDB connection and schema discovery
**Type:** Story  
**Priority:** Highest  
**Sprint:** Sprint 1  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-001

**User story**  
As the developer, I want the API to connect safely to MariaDB and discover KODI database candidates so that later SQL uses the real schema.

**Acceptance criteria**
- Uses `mysql2/promise`.
- Connection settings come from validated environment variables.
- Pool has conservative limits.
- A CLI/dev-only discovery script lists `MyVideos%` candidates.
- No password is printed.
- No KODI data is modified.
- Connection failure has a clear error.
- `docs/KODI_DB_DISCOVERY.md` is updated with instructions/results placeholders.

---

## KODI-003 — Verify KODI video schema
**Type:** Spike  
**Priority:** Highest  
**Sprint:** Sprint 1  
**Status:** DONE  
**Story points:** 2  
**Depends on:** KODI-002

**Goal**
Inspect the actual selected KODI video DB schema and document the safest source views/tables for movies and TV shows.

**Acceptance criteria**
- KODI version is recorded if known.
- Selected DB name is recorded without credentials.
- Candidate movie source and columns documented.
- Candidate TV-show source and columns documented.
- Artwork field/path samples are documented in redacted/non-sensitive form.
- No production feature query is guessed.

---

# EPIC KODI-E2 — Library API

## KODI-101 — Library summary endpoint
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 2  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-003

**Acceptance criteria**
- `GET /api/library/summary`.
- Returns movie count and TV-show count where supported.
- Repository SQL uses verified schema.
- Repository integration test exists.
- API failure does not expose raw SQL.

---

## KODI-102 — Paginated movie API
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 2  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-003

**Acceptance criteria**
- `GET /api/movies?page=1&pageSize=24`.
- Page size has a safe maximum.
- Response includes items + pagination metadata.
- Supports stable title ordering initially.
- No `SELECT *`.
- Integration tests cover valid and invalid pagination.

---

## KODI-103 — Movie detail API
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 2  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-102

**Acceptance criteria**
- `GET /api/movies/:id`.
- 404 for unknown ID.
- Returns verified movie metadata.
- ID is validated before repository call.

---

## KODI-104 — Paginated TV show API
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 2  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-003

---

## KODI-105 — TV show detail API
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 2  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-104

---

## KODI-106 — Library search API
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 3  
**Status:** DONE  
**Story points:** 5

**Acceptance criteria**
- `GET /api/search?q=...`.
- Query is validated and length-limited.
- Parameterized SQL only.
- Results distinguish entity type.
- Result count is limited/paginated.

---

# EPIC KODI-E3 — Web UI

## KODI-201 — Application shell and responsive navigation
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 2  
**Status:** DONE  
**Story points:** 3

**Acceptance criteria**
- React Router routes are established.
- Navigation contains Home, Movies, TV Shows, Search.
- Mobile and desktop layouts are usable.
- Loading/error boundary pattern established.

---

## KODI-202 — Home dashboard
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 3  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-101, KODI-201

---

## KODI-203 — Movie browse page
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 3  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-102, KODI-201

**Acceptance criteria**
- Responsive movie grid.
- Loading skeleton.
- Empty state.
- Error state.
- Pagination.
- Clicking a movie opens its detail route.

---

## KODI-204 — Movie detail page
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 3  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-103, KODI-203

---

## KODI-205 — TV show browse/detail UI
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 4  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-104, KODI-105, KODI-201

---

## KODI-206 — Search page
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 4  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-106, KODI-201

---

## KODI-207 — Artwork mapping/proxy
**Type:** Story  
**Priority:** Medium  
**Sprint:** Sprint 4  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-003

**Note**
Final solution depends on actual KODI artwork values and NAS media/image accessibility. Do not implement from assumptions.

---

# EPIC KODI-E4 — Synology Deployment

## KODI-301 — Production Docker images
**Type:** Story  
**Priority:** High  
**Sprint:** Sprint 4  
**Status:** DONE  
**Story points:** 3

**Acceptance criteria**
- Multi-stage builds.
- Non-root API runtime where practical.
- Web served by nginx/static container.
- Health checks.
- Restart policy documented.
- Production env variables documented.

---

## KODI-302 — Synology deployment runbook
**Type:** Task  
**Priority:** High  
**Sprint:** Sprint 4  
**Status:** SKIPPED  
**Story points:** 2  
**Depends on:** KODI-303

**Acceptance criteria**
- Container Manager steps documented.
- Volumes/network requirements documented.
- MariaDB account permissions documented.
- Upgrade/rollback steps documented.
- Backup note included.

---

## KODI-303 — Legacy DSM hosting feasibility
**Type:** Spike  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE  
**Story points:** 2

**Context**
The target Synology DSM version does not support Container Manager. Synology-hosted deployment is deferred until a safe, supportable alternative is selected.

**Goal**
Evaluate deployment options for the existing NAS without assuming Container Manager support.

**Acceptance criteria**
- Record the NAS model, CPU architecture, and DSM version.
- Confirm which Synology packages and third-party package sources are supported.
- Compare a compatible legacy Docker package, native Node.js hosting, and hosting the web/API on another LAN device.
- Preserve private LAN access to MariaDB; do not expose port 3306 publicly.
- Document operational, upgrade, and security tradeoffs.
- Select a supported deployment approach before updating the Synology runbook.

---

# EPIC KODI-E5 — Cloudflare Stage 2

## KODI-401 — Cloudflare feasibility spike
**Type:** Spike  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE  
**Story points:** 3

**Goal**
Select a safe Cloudflare hosting model for the web, API, and a read-only copy
of KODI library metadata without exposing the Synology MariaDB service.

**Acceptance criteria**
- Compare direct Hyperdrive connectivity with an outbound D1 snapshot sync.
- Confirm D1 is suitable for the verified library metadata and API access patterns.
- Define synchronization ownership, authentication, deletion handling, and failure behavior.
- Preserve the existing frontend API contract and Stage 1 rollback path.
- No public MariaDB exposure is introduced.

---

## KODI-402 — D1 read model and Worker read API
**Type:** Story  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE  
**Story points:** 8  
**Depends on:** KODI-401

**Acceptance criteria**
- App-owned D1 schema covers the existing movie, TV-show, artwork, progress, and search DTOs.
- Worker read routes preserve the existing public API paths and response shapes.
- Schema migrations and indexes are version controlled.
- Empty, pagination, not-found, and stable error responses are tested.
- No MariaDB credentials or KODI-owned schema are copied into Worker configuration.

---

## KODI-403 — Secure D1 snapshot ingestion endpoint
**Type:** Story  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE  
**Story points:** 5  
**Depends on:** KODI-402

**Acceptance criteria**
- A separate non-public sync route accepts validated, bounded batches.
- Authentication uses a Cloudflare-managed secret and timing-safe verification.
- Snapshot/version identifiers make retries idempotent and reject stale updates.
- Records missing from a completed snapshot are removed safely.
- Rate limits, payload limits, stable errors, and audit metadata are tested.

---

## KODI-404 — Local read-only KODI sync agent
**Type:** Story  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE  
**Story points:** 8  
**Depends on:** KODI-003, KODI-403

**Acceptance criteria**
- Agent queries the verified KODI schema with the existing SELECT-only account.
- Exported records match the stable API DTO/read-model mapping.
- Uploads use authenticated HTTPS batches with retry and bounded backoff.
- Full snapshots handle additions, changes, and deletions without writing to KODI.
- Dry-run, interrupted upload, and resume behavior are tested.
- Secrets and raw media paths are never logged or uploaded.

---

## KODI-405 — Deploy web to Cloudflare Pages
**Type:** Story  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE  
**Story points:** 3  
**Depends on:** KODI-402

**Acceptance criteria**
- Production Vite build deploys to Cloudflare Pages.
- Frontend uses the stable Worker API contract without environment-specific URLs in components.
- SPA route fallback and cache headers are configured.
- Preview and production environments are separated.
- Critical browse, detail, search, loading, empty, and error flows are verified.

---

## KODI-406 — Schedule, monitor, and recover synchronization
**Type:** Story  
**Priority:** Medium  
**Sprint:** Future  
**Status:** DONE
**Story points:** 3  
**Depends on:** KODI-404, KODI-405

**Acceptance criteria**
- Sync runs on a documented schedule from the private LAN host.
- Last-success time, duration, row counts, and failures are observable without secrets.
- Stale-data status is detectable without taking the public read API offline.
- Manual rerun and recovery from a failed or partial snapshot are documented and tested.
- MariaDB remains private and Stage 1 rollback remains available.

---

## KODI-407 — Redirect the production Pages hostname to the custom domain
**Type:** Story  
**Priority:** Low  
**Sprint:** Final stage  
**Status:** BACKLOG  
**Story points:** 2  
**Depends on:** KODI-405, KODI-406

**Goal**
Make `https://kodi.glabs.my` the canonical production hostname while retaining
Cloudflare Pages deployment and preview capabilities.

**Acceptance criteria**
- Confirm `https://kodi.glabs.my` is active, healthy, and serving the production Pages deployment before redirecting traffic.
- Permanently redirect production requests from `https://kodi-web.pages.dev` to `https://kodi.glabs.my` using a Cloudflare-supported redirect configuration.
- Preserve request paths and query strings, including React deep links and public `/api` routes.
- Keep preview and immutable deployment URLs available without redirecting them to production.
- Verify there are no redirect loops and document how to disable or roll back the redirect.

---

# Suggested Sprint Plan

## Sprint 1 — Foundation
- KODI-001
- KODI-002
- KODI-003

**Sprint goal:** establish safe, verified access to the real KODI schema.

## Sprint 2 — Core API + shell
- KODI-101
- KODI-102
- KODI-103
- KODI-201

**Sprint goal:** produce the first navigable application backed by real movie data.

## Sprint 3 — Movies + search
- KODI-106
- KODI-202
- KODI-203
- KODI-204

## Sprint 4 — TV + artwork + NAS production
- KODI-104
- KODI-105
- KODI-205
- KODI-206
- KODI-207
- KODI-301
- KODI-302

## Future — Cloudflare
- KODI-401
- KODI-402
- KODI-403
- KODI-404
- KODI-405
- KODI-406

## Final stage — Canonical domain
- KODI-407

## Future — Legacy Synology
- KODI-303
