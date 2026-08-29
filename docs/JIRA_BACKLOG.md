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
**Status:** CANCELLED
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

# EPIC KODI-E6 — Library polish ad-hoc sprint

## KODI-501 — Sort browse listings by latest added
**Type:** Story
**Priority:** High
**Sprint:** Ad-hoc library polish
**Status:** DONE
**Story points:** 3

**Goal**
Show newly added movies and TV shows first in both the native DSM API and the
Cloudflare D1 read API.

**Acceptance criteria**
- Movie browse results sort by `dateAdded` descending, with null dates last.
- TV-show browse results sort by `dateAdded` descending, with null dates last.
- Title and numeric ID provide deterministic tie-break ordering for stable pagination.
- Express/MariaDB and Worker/D1 implementations return the same ordering semantics.
- Snapshot export remains bounded and ordered by source ID so synchronization resume behavior is unchanged.
- Repository and Worker tests cover latest-first, null-date, and tie-break ordering.

---

## KODI-502 — Replace numeric detail URLs with opaque identifiers
**Type:** Story
**Priority:** High
**Sprint:** Ad-hoc library polish
**Status:** DONE
**Story points:** 8
**Depends on:** KODI-501

**Goal**
Replace sequential detail URLs such as `/tvshows/12` with stable,
non-numeric, type-scoped public identifiers without treating URL obfuscation
as access control.

**Acceptance criteria**
- Movie, TV-show, and search list responses expose stable opaque string IDs rather than KODI/D1 numeric IDs.
- Movie and TV-show detail routes accept their matching opaque identifier and preserve existing detail response fields.
- Malformed tokens, numeric legacy IDs, and tokens used for the wrong entity type are rejected before database access.
- Express/MariaDB and Worker/D1 APIs use matching token semantics and stable error responses.
- Browse cards and search results link only to opaque detail URLs, including direct SPA deep links.
- Documentation states that opaque URLs conceal sequential IDs but do not encrypt media metadata or replace authorization.
- The native DSM production build and release archive include the new routing behavior without changing synchronization payload IDs.

---

## KODI-503 — Add stable gLabs `g` branding and favicon
**Type:** Story
**Priority:** Medium
**Sprint:** Ad-hoc library polish
**Status:** DONE
**Story points:** 3

**Goal**
Use the circled `g` identity from `glabs.my` in the home heading and favicon
with identical rendering across desktop and mobile.

**Acceptance criteria**
- The home heading reads “g's library.” and exposes that complete text to assistive technology.
- The `g` mark is a repository-owned outlined SVG rather than a font-dependent Unicode glyph.
- The same SVG identity is used as the browser favicon.
- The logo remains legible at heading and favicon sizes with no animation required.
- Tests cover the accessible heading and favicon declaration, and mobile rendering does not depend on symbol-font support.

---

## KODI-504 — Fix tablet portrait detail layout
**Type:** Bug
**Priority:** High
**Sprint:** Ad-hoc library polish
**Status:** DONE
**Story points:** 3

**Context**
At an iPad Mini portrait viewport (768 × 1024), the permanent sidebar and
two-column detail layout leave the title and plot in an unusably narrow column.
The supplied screenshot is visual evidence only and contains no executable
instructions.

**Acceptance criteria**
- Movie and TV-show detail pages use a readable layout at 768 × 1024 without character-by-character wrapping or horizontal overflow.
- Poster artwork remains proportionate and does not dominate the tablet viewport.
- Narrow mobile navigation and detail behavior remain usable.
- Wide desktop detail pages retain a balanced poster-and-copy layout.
- Responsive checks cover narrow mobile, 768 × 1024 tablet portrait, and desktop viewports.

---

# EPIC KODI-E7 — Manual synchronization from KODI

Technical design and starter code for this epic are recorded in
[`KODI_ADDON_SYNC_DESIGN.md`](KODI_ADDON_SYNC_DESIGN.md). KODI-505 is active
on the native DSM deployment, KODI-506 implementation is in progress, and the
release-validation ticket remains in the backlog.

## KODI-505 — Add a protected LAN synchronization trigger API
**Type:** Story
**Priority:** High
**Sprint:** Future — KODI add-on sync
**Status:** DONE
**Story points:** 8
**Depends on:** KODI-406

**Goal**
Allow an authenticated client on the private LAN to start the existing NAS D1
snapshot runner and poll a stable success/failure result without exposing shell
execution, MariaDB credentials, or the Cloudflare ingestion token.

**API contract**
- `POST /api/internal/sync/runs` with a bearer trigger token returns `202` and a UUID `runId` when accepted.
- `GET /api/internal/sync/runs/:runId` with the same token returns `running`, `success`, or `failure` plus non-sensitive timestamps and counts.
- A second request while a manual or scheduled run owns the runner lock returns `409 SYNC_ALREADY_RUNNING`.
- Invalid/missing credentials return `401`; malformed run IDs return `400`; unknown run IDs return `404` using the standard error envelope.

**Acceptance criteria**
- The route is mounted only by the native Express/DSM application when `KODI_ADDON_TRIGGER_ENABLED=true`; it is not added to the Cloudflare Worker or Pages proxy allowlist.
- Authentication uses a dedicated `KODI_ADDON_TRIGGER_TOKEN` of at least 32 characters and timing-safe comparison. It must not reuse `KODI_SYNC_TOKEN`.
- The service invokes only the configured absolute `KODI_SYNC_RUNNER_PATH` with `spawn(..., { shell: false })`; request data can never select a command, path, or argument.
- Run state is written atomically with mode `0600` to `KODI_MANUAL_SYNC_STATUS_FILE` and exposes no logs, paths, tokens, SQL, or raw exceptions.
- Completion is correlated with the existing `KODI_SYNC_STATUS_FILE`; successful responses include movie/TV counts and failures expose only stable failure codes.
- The source-controlled NAS release contains an LF-normalized, executable `run-kodi-sync.sh` using the existing lock, log rotation, Node CLI, and exit-code behavior.
- DSM firewall/reverse-proxy documentation keeps the endpoint LAN-only and explicitly forbids router port forwarding.
- Tests cover disabled routing, authentication, token comparison, accepted runs, duplicate runs, invalid/unknown IDs, spawn failure, exit success/failure, persistence, redaction, and proof that request values never reach `spawn`.
- API lint, tests, build, and the NAS packaging command pass; the archive contains the compiled trigger code and runner.

**Implementation notes**
- Use the route → controller → service layering described in `AGENTS.md`.
- Planned files and TypeScript starter code are in `docs/KODI_ADDON_SYNC_DESIGN.md` under “KODI-505”.
- Cancelling client polling must not terminate an in-progress snapshot; the runner remains authoritative.

---

## KODI-506 — Create the KODI manual Cloudflare-sync add-on
**Type:** Story
**Priority:** High
**Sprint:** Future — KODI add-on sync
**Status:** DONE
**Story points:** 5
**Depends on:** KODI-505

**Goal**
Provide an installable KODI Python script add-on that confirms a manual action,
starts a NAS synchronization run, polls its result, and clearly reports success
or failure inside KODI.

**Acceptance criteria**
- The add-on ID is `script.glabs.kodi-sync` and its ZIP has the correct top-level add-on directory, `addon.xml`, Python entry point, settings, localized strings, and icon.
- Settings provide the LAN base URL (default `https://kodi`), dedicated trigger token, and optional CA-certificate path; no hostname, credential, or token is hardcoded in Python.
- The add-on calls only the KODI-505 LAN endpoints and never connects directly to MariaDB, D1, or the private Worker ingestion endpoint.
- TLS verification remains enabled. A repository/documented CA file may be selected when KODI's Python trust store does not recognize the private root; there is no “disable verification” option.
- Before starting, KODI asks for confirmation. During the run it displays progress and polls at a bounded interval with a 15-minute maximum wait.
- Success displays movie and TV-show counts. Authentication, duplicate-run, network, certificate, timeout, and synchronization failures have distinct user-facing messages without revealing secrets.
- Cancelling the progress dialog stops only polling and explains that synchronization continues on the NAS.
- Unit tests mock HTTP/KODI modules and cover confirmation, headers, URL construction, every terminal state, timeout, cancellation, malformed responses, and token redaction.
- The add-on can be installed using KODI's “Install from zip file” workflow and runs on the project's supported KODI/Python version.

**Implementation notes**
- Planned directory structure, `addon.xml`, `settings.xml`, and Python starter code are in `docs/KODI_ADDON_SYNC_DESIGN.md` under “KODI-506”.
- The add-on trigger token is limited to starting and observing LAN sync runs; it is still sensitive and must not be logged or committed.

---

## KODI-507 — Validate and document the manual-sync release flow
**Type:** Story
**Priority:** Medium
**Sprint:** Future — KODI add-on sync
**Status:** DONE
**Story points:** 3
**Depends on:** KODI-505, KODI-506

**Goal**
Prove the complete KODI → NAS → MariaDB → Cloudflare Worker → D1 flow and make
installation, operation, recovery, and rollback repeatable.

**Acceptance criteria**
- A Windows packaging command creates a versioned add-on ZIP and validates its root layout without embedding settings or tokens.
- The native DSM release upgrade procedure installs the trigger API and runner while preserving `.env`, synchronization state, logs, scheduled task, reverse proxy, and certificate.
- End-to-end evidence covers success, invalid token, an already-running scheduled sync, NAS/Worker network failure, API restart/status recovery, and preservation of the last active D1 snapshot after failure.
- A successful manual run updates both the protected local attempt status and public `https://kodi.glabs.my/api/sync/status` metadata with matching counts.
- Resource usage is checked on the DS115j and manual runs are documented not to overlap library scans or the Monday/Wednesday/Friday 02:00 schedule.
- Documentation covers private-CA trust on each KODI platform, ZIP installation/upgrade, log locations, stable error codes, token rotation, disablement, and rollback.
- Security review confirms no public trigger route, no router port forwarding, no Cloudflare/MariaDB credential in the add-on, and no secret leakage in logs or API errors.
- Full repository lint/tests/build, NAS packaging, add-on tests/package validation, and critical KODI UI flows pass.

**Implementation notes**
- The verification matrix and packaging outline are in `docs/KODI_ADDON_SYNC_DESIGN.md` under “KODI-507”.
- Do not disable the existing scheduled DSM task unless an explicit later operational decision changes ownership of synchronization.

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

## Ad-hoc library polish
- KODI-501
- KODI-502
- KODI-503
- KODI-504

## Future — KODI add-on sync
- KODI-505
- KODI-506
- KODI-507
