# Project Handover Assessment — KODI Web

**Assessment date:** 2026-09-17
**Scope:** full repository review — instructions, documentation, source,
configuration, and tests
**Status:** point-in-time. Verify live state before acting on any single finding.

## Purpose

Capture the *actual* state of the repository for an incoming maintainer, because
the governing instruction file (`AGENTS.md`) and parts of
[`JIRA_BACKLOG.md`](JIRA_BACKLOG.md) describe an earlier plan than the one that
is deployed.

This assessment is based on source inspection only. No commands were executed,
no builds were run, and git history was not inspected.

## Bottom line

1. The project is **complete against its own backlog**. Every ticket is `DONE`,
   `SKIPPED`, or `CANCELLED`; nothing is in `READY`, `IN PROGRESS`, or `REVIEW`.
2. The **deployed architecture is the Cloudflare design**, not the Stage 1
   Synology Docker design that `AGENTS.md` still presents as current.
3. Several implemented subsystems have **no corresponding Jira ticket**.
4. **No Playwright/E2E suite and no CI pipeline exist**, although both are
   required by the Definition of Done.
5. The next ticket must be **created**, not resumed.

## How this assessment was produced

Read: `AGENTS.md`, all files in `docs/`, then the actual source in `apps/api`,
`apps/cloudflare-api`, `apps/cloudflare-probe`, `apps/web`, `kodi-addon`,
`scripts/`, `docker-compose.yml`, both `.env.example` files, and `.gitignore`.

**Not verified:**

- `lint` / `test` / `build` results
- git tracking status or history
- whether the working tree is clean
- live Cloudflare, DSM, or MariaDB state

## Deployed architecture (as actually implemented)

```text
Browser
  -> Cloudflare Pages (React + Vite)
  -> Pages Function  /api proxy  (allowlist, GET only)
  -> Cloudflare Worker read API
  -> Cloudflare D1 read model

Private LAN: Synology DS115j (native Node.js 18, no Container Manager)
  -> SELECT-only access to KODI MariaDB (MyVideos121)
  -> outbound authenticated HTTPS snapshot upload
  -> Worker ingestion endpoint -> atomic D1 snapshot activation
```

- Cloudflare never connects inbound to the NAS. MariaDB port 3306 is private.
- D1 holds an app-owned projection of the public DTOs only — not a backup or
  replica of KODI-owned tables.
- The DS115j also serves a **LAN-only fallback** site by hosting the compiled
  React build and the Express API in one Node process behind DSM's reverse proxy.
- Production lags the NAS by design; see
  [`KODI_SYNC_TROUBLESHOOTING.md`](KODI_SYNC_TROUBLESHOOTING.md).

### Repository map

| Path | Role |
| --- | --- |
| `apps/api` | Express Stage 1 API, LAN fallback static host, snapshot sync agent, protected manual-sync trigger |
| `apps/web` | React UI + Cloudflare Pages Function proxy |
| `apps/cloudflare-api` | Worker read API, private ingestion API, D1 migrations |
| `apps/cloudflare-probe` | Hyperdrive feasibility probe (evidence only — placeholder binding, must not be deployed) |
| `kodi-addon/script.glabs.kodi-sync` | KODI Python add-on for manual LAN sync |
| `scripts/` | Windows packagers and DSM shell runners |
| `docs/` | Architecture, schema verification, backlog, runbooks |

## Implemented subsystems

### `apps/api` — Express API, sync agent, native static host

| Area | Evidence |
| --- | --- |
| App factory, routers, graceful shutdown | `src/app.ts`, `src/server.ts` |
| Routes / controllers / services / repositories | `src/routes`, `src/controllers`, `src/services`, `src/repositories` |
| Validated environment (zod), local dotenv only | `src/config/env.ts`, `src/config/loadEnvironment.ts` |
| Conservative MariaDB pool (limit 4, queue 8, 5 s timeout) | `src/db/pool.ts` |
| Discovery and sync CLIs | `src/cli/discoverKodiDatabases.ts`, `src/cli/syncKodiSnapshot.ts` |
| Snapshot agent (paging, retry, resume, status) | `src/services/snapshotSyncService.ts`, `snapshotUploader.ts`, `snapshotState.ts` |
| Manual LAN trigger API | `src/routes/manualSyncRoutes.ts`, `src/middleware/requireSyncTriggerToken.ts`, `src/services/manualSyncTriggerService.ts`, `syncRunnerLock.ts`, `syncRunStatus.ts`, `manualSyncRunStore.ts` |
| Native DSM static host | `src/web/staticWebApplication.ts` |
| Opaque public identifiers | `src/types/publicId.ts`, `movieId.ts`, `tvShowId.ts` |

### `apps/cloudflare-api` — Worker read API and private ingestion

- `src/index.ts` / `router.ts`: eight public routes plus
  `POST /api/internal/sync/snapshots`.
- `src/repository.ts`: D1 read queries with the same ordering semantics as
  Express (KODI-501).
- `src/syncAuth.ts`: SHA-256 digest comparison with a timing-safe loop.
- `src/syncValidation.ts`: 1 MiB bounded streaming body read, strict schema,
  50 records per batch, HTTPS and credential-free artwork URLs.
- `src/syncRepository.ts`: rate limiting, snapshot version and batch
  idempotency, stale-version rejection, atomic activation with superseded
  snapshot cleanup.
- `migrations/0001..0003`: app-owned read model, ingestion tables, latest-added
  indexes. No KODI-owned schema is copied.

### `apps/web` — React UI and Pages Function

- Routes: `/`, `/movies`, `/movies/:id`, `/tvshows`, `/tvshows/:id`, `/search`,
  and a catch-all not-found route.
- `src/services/api.ts` is the only HTTP layer and performs runtime response
  validation; no component constructs an API base URL.
- `functions/apiProxy.ts` allowlists public routes only, rejects non-GET, and
  cannot reach the ingestion endpoint.
- Home heading and favicon use the repository-owned `public/g-logo.svg`.

### Tests present

33 Vitest test files (26 in `apps/api` including four integration tests gated by
`KODI_INTEGRATION_TEST`, three in `apps/cloudflare-api` using
`@cloudflare/vitest-pool-workers` with real D1 migrations, three in `apps/web`,
one in `apps/cloudflare-probe`) plus one Python test module for the add-on.

## Ticket status from source evidence

| Ticket | Backlog | Assessment |
| --- | --- | --- |
| KODI-001/002/003 | DONE | Verified. `KODI_DB_DISCOVERY.md` and `schema/MYVIDEOS121.md` are genuine schema work. |
| KODI-101–106 | DONE | Repositories, services, routes, and controllers present; parameterized SQL; pagination limits enforced. |
| KODI-201–207 | DONE | All pages and components present; artwork is HTTPS-URL mapping only (documented anti-SSRF decision). |
| KODI-301 | DONE | Multi-stage Dockerfiles and compose health dependency. |
| KODI-302 | SKIPPED | Correct — Container Manager is unavailable. The replacement design was never given its own ticket. |
| KODI-303 | DONE | `LEGACY_DSM_HOSTING_FEASIBILITY.md` records DS115j / DSM 7.1.1 / ARMv7 / 256 MB. |
| KODI-401–406 | DONE | Probe, D1 read model, ingestion, agent, Pages configuration, and status endpoint all implemented and tested. |
| KODI-407 | CANCELLED | Consistent, but the `kodi-web.pages.dev` redirect to `kodi.glabs.my` was never implemented. Low impact, unrecorded. |
| KODI-501–504 | DONE | Migration 0003 and matching ordering in both APIs; opaque IDs; branding; tablet breakpoint. |
| KODI-505 | DONE | Trigger mounted conditionally, `spawn(path, [], { shell: false })`, timing-safe dedicated token, atomic `0600` status file. |
| KODI-506 | DONE | Add-on v0.1.3 with settings, localized strings, icon, and Python tests. |
| KODI-507 | DONE, with gaps | `KODI_ADDON_RELEASE_VALIDATION.md` records four PASS and **five Pending** rows accepted without live execution. |

## Implemented work with no ticket

| Subsystem | Files | Documented in |
| --- | --- | --- |
| Native DSM single-process hosting | `apps/api/src/web/staticWebApplication.ts`, `WEB_DIST_PATH`, the `scripts/nas/` start, stop, and status scripts, and `scripts/package-nas-release.ps1` | `NATIVE_DSM_HOSTING.md` only |
| Public `GET /api/sync/status` | `apps/cloudflare-api/src/router.ts`, `repository.ts` | `README.md`, `KODI_SYNC_OPERATIONS.md` |
| Second environment template | `scripts/nas/.env.example` (DSM-specific) | Nowhere else |
| Windows scheduler recovery path | `scripts/register-kodi-sync-task.ps1`, `scripts/run-kodi-sync.ps1` | `KODI_SYNC_OPERATIONS.md` (marked inactive) |

## Deviations from `AGENTS.md`

| # | Deviation | Severity |
| --- | --- | --- |
| D1 | Hosting roadmap inverted: `AGENTS.md` presents Synology Docker as current and Hyperdrive as the Stage 2 database preference. Reality is native DSM plus Cloudflare Pages/Worker/D1. | High (documentation risk) |
| D2 | Playwright is required by `AGENTS.md` and the Definition of Done, but no Playwright dependency, configuration, or test exists. | Medium |
| D3 | The "First Codex Task — start with KODI-001" section is obsolete. | Low |
| D4 | Route to controller to service to repository is applied only in Express. The Worker collapses to `router.ts` and `repository.ts`. | Low |
| D5 | `apps/cloudflare-api`, `apps/cloudflare-probe`, `src/cli/`, and `src/web/` are not reflected in the documented layer list. | Low |
| D6 | The documented contract still reads `/api/movies/:id`; the real contract uses type-scoped opaque identifiers and adds `/api/sync/status`. | Low |

**Verified compliant:** no `SELECT *` in `src`; explicit column lists; all
user-controlled values bound; SQL confined to repository modules; no secrets in
`wrangler.jsonc`; consistent error envelope across Express, the Worker, and the
Pages proxy.

## Security review

### Verified good

- Timing-safe secret comparison in `syncAuth.ts` (digest comparison) and
  `requireSyncTriggerToken.ts` (`timingSafeEqual` with a length guard).
- The add-on trigger token is separate from `KODI_SYNC_TOKEN`, has a 32
  character minimum, and startup fails if the two are equal.
- `spawn(runnerPath, [], { shell: false })` — request data cannot reach a
  command, path, or argument.
- Ingestion hardening: bounded 1 MiB streaming read, declared-length pre-check,
  content-type check, strict schema, stale-version and conflict handling,
  idempotency, rate limiting, and an audit log.
- Artwork is returned as URLs only and is never fetched server-side, removing an
  SSRF surface. Enforced in three places: the Express helper, the payload
  refinement, and a D1 `CHECK` constraint.
- The Pages proxy allowlist cannot reach the ingestion route and rejects
  non-GET methods.
- `public/_headers` sets `X-Frame-Options: DENY`, `nosniff`, and
  `Referrer-Policy`.
- The Hyperdrive probe ships an all-zero placeholder binding identifier.

### Open items

| # | Finding | Severity |
| --- | --- | --- |
| S1 | A populated `.env` exists at the repository root. `.gitignore` covers it, but git history was **not** verified. Run `git ls-files --error-unmatch .env` and `git log --all -- .env`; rotate credentials if history is dirty. | High — verify first |
| S2 | The ingestion endpoint shares the public Worker hostname and is protected by a single static bearer secret plus a 30 request/minute limit — no Cloudflare Access service token, IP allowlist, or separate write scope. A leaked token permits replacing the public library. | Medium |
| S3 | No Content-Security-Policy on the Pages site. | Low |
| S4 | `.env.example` contains a real private LAN address and account name. Not a secret, but it conflicts with the "no hardcoded hostnames" rule. | Low |
| S5 | `docker-compose.yml` publishes the API port on all host interfaces without authentication. | Low |
| S6 | No request-logging or security-header middleware in Express despite the layering documentation listing them. | Low |
| S7 | Five `KODI-507` validation rows remain unexecuted. | Low–Medium |

## Technical debt

| # | Item | Impact |
| --- | --- | --- |
| T1 | `publicId.ts` is duplicated verbatim in `apps/api` and `apps/cloudflare-api`; no test asserts cross-workspace equality. | Medium — silent URL breakage risk |
| T2 | No Playwright/E2E coverage despite being a Definition of Done gate. | Medium |
| T3 | No CI pipeline; all completion checks are manual. | Medium |
| T4 | Python add-on tests are outside `npm test`. | Medium |
| T5 | Counter source inconsistency: `movieRepository`, `snapshotExportRepository`, and `librarySummaryRepository` count `movie` while rows come from `movie_view` (the same applies to TV shows). Measured **0 orphans** in the current library, so this is latent rather than active. | Low–Medium |
| T6 | Search uses `INSTR(c00, ?)`, which cannot use an index. Acceptable at the current library size; it will not scale. | Low |
| T7 | Search matching semantics differ between MariaDB (collation based) and D1 (a lowercased copy). | Low |
| T8 | Two independent implementations of one public contract with no shared conformance test. Spot-checked as currently consistent. | Medium |
| T9 | Stale in-repo claims: `apps/cloudflare-api/README.md` says production D1 is empty, and `README.md` presents the Windows scheduler as the default. | Low |
| T10 | The `JIRA_BACKLOG.md` epic-E7 preamble contradicts its own `DONE` statuses. | Low |
| T11 | Stale `dist*/` build folders are present locally; they are ignored by git and prove nothing about the current build. | Low |
| T12 | `dateAdded` is stamped by the KODI client in the client's timezone, so database timestamps can be hours behind the NAS clock. See [`KODI_SYNC_TROUBLESHOOTING.md`](KODI_SYNC_TROUBLESHOOTING.md). | Low (diagnostic trap) |
| T13 | `SYNC_STALE_AFTER_SECONDS = 172800` (48 h) is shorter than the Friday to Monday gap (72 h), so status reads `stale` every Sunday 02:00 to Monday 02:00 while perfectly healthy. | Low |

## Documentation currency

### `docs/JIRA_BACKLOG.md` — needs updating

1. Fix the epic-E7 preamble, which still says KODI-505 is active and KODI-506 is
   in progress.
2. Record the untracked subsystems above, or state explicitly that they were
   delivered outside the backlog.
3. Re-scope or formally close KODI-302.
4. Convert the `KODI-507` Pending rows into a follow-up ticket.
5. Decide KODI-407: re-open it or record the missing redirect as accepted risk.

### `docs/SPRINT_PLAN.md` — should not be created

The file does not exist and nothing references it. The backlog already carries a
"Suggested Sprint Plan" section, which is itself stale. Replace that section
with a current-state and next-candidates summary instead of creating a second
source of truth.

### Also needs updating

`AGENTS.md` (roadmap, Playwright status, contract, workspace list) and the stale
claims listed under T9.

## Recommended next work

| Proposed | Title | Rationale |
| --- | --- | --- |
| KODI-508 | Close the KODI-507 validation gaps | The only unverified claims in an otherwise complete system |
| KODI-509 | Playwright E2E for critical flows | Satisfies the existing Definition of Done gate (T2) |
| KODI-510 | CI pipeline for lint, tests, build, packaging, and add-on tests | Closes T3 and T4 |
| KODI-511 | Extract a shared `@kodi/public-id` package | Closes T1 |
| KODI-512 | Documentation refresh | Aligns `AGENTS.md` and fixes T9 and T10 |
| KODI-513 | Stale-threshold and schedule alignment | Closes T13 |

Do not start with feature work. The remaining risk is unverified failure
behaviour and documentation that misdescribes the system.

## Incoming owner checklist

1. Verify git hygiene: `git status`, `git ls-files --error-unmatch .env`,
   `git log --all -- .env` (S1).
2. Run the real gates: `npm run lint`, `npm run test`, `npm run build`,
   `npm run package:nas`, and the add-on packager.
3. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and `README.md` as the accurate
   description of the deployed system — not `AGENTS.md` alone.
4. Treat `SYNC_TOKEN` as a Cloudflare secret; never place it in
   `wrangler.jsonc`. Keep `.dev.vars` ignored.
5. Follow [`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md) for all
   synchronization operations and
   [`KODI_SYNC_TROUBLESHOOTING.md`](KODI_SYNC_TROUBLESHOOTING.md) when the
   public library looks behind.

## Related documents

- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`JIRA_BACKLOG.md`](JIRA_BACKLOG.md)
- [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md)
- [`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md)
- [`KODI_SYNC_TROUBLESHOOTING.md`](KODI_SYNC_TROUBLESHOOTING.md)
- [`KODI_ADDON_RELEASE_VALIDATION.md`](KODI_ADDON_RELEASE_VALIDATION.md)
- [`schema/MYVIDEOS121.md`](schema/MYVIDEOS121.md)
