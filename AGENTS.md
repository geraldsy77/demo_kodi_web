# KODI Web Development Instructions

## Mission

Build a web application that reads the existing KODI MariaDB library and presents it through a modern web UI.

Development is managed in Jira-style stories and two-week-style sprints. Work one ticket at a time and keep changes reviewable.

## Hosting Roadmap

### Stage 1 — Synology NAS
- Existing KODI MariaDB remains on the Synology NAS.
- Web frontend and Node.js API are hosted on the Synology NAS using Container Manager / Docker Compose.
- API connects to MariaDB over the NAS/private LAN.
- Start READ-ONLY. Do not update KODI tables in Stage 1 unless a later Jira story explicitly authorizes writes.

### Stage 2 — Cloudflare
Target:
- Frontend: Cloudflare Pages.
- API: Cloudflare Workers.
- Database: existing MariaDB where practical, via Cloudflare Hyperdrive.
- Prefer Cloudflare Tunnel / Workers VPC for a private database. Never expose MariaDB port 3306 directly to the public Internet.
- Keep the frontend API contract stable so moving the API implementation does not require rewriting React pages.

## Preferred Stack

Frontend:
- React
- Vite
- TypeScript
- React Router
- Redux Toolkit only for genuinely shared client state
- CSS modules or simple global CSS; avoid adding a large UI framework unless a story requires it

Stage 1 API:
- Node.js
- Express
- TypeScript
- mysql2/promise
- zod for environment/input validation

Testing:
- Vitest
- React Testing Library
- Supertest
- Playwright for critical end-to-end flows

Tooling:
- npm workspaces
- ESLint
- Prettier
- Docker / Docker Compose

## Repository Rules

- Never hardcode database credentials, hostnames, API URLs, or KODI database names in source files.
- Use environment variables and the config modules.
- Do not modify existing working behavior unless required by the active ticket.
- Prefer small reusable components and small service modules.
- Keep SQL out of React components and routes.
- Put KODI-specific SQL in `apps/api/src/repositories/`.
- Use parameterized SQL for all user-controlled values.
- Do not use `SELECT *`.
- Every query must have an explicit column list.
- Treat the KODI schema as externally owned. The app must not run migrations against KODI databases.
- Never drop, alter, truncate, or rename KODI tables.
- Default DB user should have SELECT-only permissions.
- Do not log passwords, connection strings, tokens, or full environment dumps.
- Do not commit `.env` files.

## KODI Database Discovery

KODI database names are versioned, for example `MyVideos###` and `MyMusic##`.

Do not assume a fixed suffix.

For Stage 1:
1. Accept `KODI_VIDEO_DB` as an environment variable.
2. Provide a discovery utility/story that can list candidate `MyVideos%` databases.
3. Record the detected KODI version/schema in documentation before adding complex queries.
4. Build repository queries against the actual schema found in the user's database.

If schema details are uncertain, inspect them before coding. Do not guess table or column names.

## API Contract

Frontend requests go through:
`apps/web/src/services/api.ts`

Frontend components must not construct environment-specific API base URLs.

Initial endpoints:
- `GET /api/health`
- `GET /api/library/summary`
- `GET /api/movies`
- `GET /api/movies/:id`
- `GET /api/tvshows`
- `GET /api/tvshows/:id`
- `GET /api/search?q=...`

All list endpoints should support pagination before large libraries are loaded.

Success responses should be JSON. Errors should use a consistent structure:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message"
  }
}
```

## Jira / Sprint Workflow

The active backlog is in:
`docs/JIRA_BACKLOG.md`

Before coding:
1. Read `AGENTS.md`.
2. Read the selected Jira story.
3. Read relevant skill files listed below.
4. Inspect existing code before proposing changes.
5. State the ticket ID being implemented.

During coding:
- Implement only the active ticket plus unavoidable supporting changes.
- Update/add tests with the implementation.
- Do not silently expand scope.

After coding:
1. Run lint.
2. Run unit/integration tests.
3. Run build.
4. If UI behavior changed, run relevant Playwright test when available.
5. Summarize changed files.
6. Summarize test evidence.
7. Note assumptions / follow-up tickets.
8. Update the Jira story status/checklist only if the user asks Codex to do so.

## Git / Commit Convention

Branch examples:
- `feature/KODI-101-health-api`
- `feature/KODI-112-movie-list`
- `fix/KODI-145-search-pagination`

Commit examples:
- `feat(KODI-112): add paginated movie API`
- `fix(KODI-145): preserve search query on page change`
- `test(KODI-112): cover movie repository pagination`

## Definition of Done

A story is done only when:
- Acceptance criteria are satisfied.
- No secrets are committed.
- Lint passes.
- Tests pass.
- Production build passes.
- Error handling is present.
- Responsive UI is checked when relevant.
- Documentation is updated when architecture/configuration changes.
- No unauthorized writes are made to the KODI DB.

See `docs/DEFINITION_OF_DONE.md`.

## Skills

Use these repo skills when relevant:

- `.agents/skills/jira-sprint-development/SKILL.md`
  Use for starting, implementing, and closing Jira-style tickets.

- `.agents/skills/kodi-mariadb/SKILL.md`
  Use for schema inspection, SQL, repositories, and KODI database safety.

- `.agents/skills/frontend-designer/SKILL.md`
  Use for UI layout, responsive design, component styling, and visual refinement.

- `.agents/skills/api-development/SKILL.md`
  Use for Express routes, service/repository layers, validation, API errors, and tests.

- `.agents/skills/testing-review/SKILL.md`
  Use before calling a ticket complete.

- `.agents/skills/cloudflare-stage2/SKILL.md`
  Use only for Stage 2 Cloudflare work.

## First Codex Task

Start with `KODI-001` in `docs/JIRA_BACKLOG.md`.

Do not begin feature development against guessed KODI tables. Establish the repository, environment validation, API health route, database connectivity, and schema discovery first.
