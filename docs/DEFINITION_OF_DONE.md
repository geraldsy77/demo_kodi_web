# Definition of Done

A Jira story can move to Done when all applicable checks pass.

## Functional
- Acceptance criteria met.
- No unrelated scope added.
- Empty/loading/error states handled.

## Code quality
- TypeScript has no avoidable `any`.
- Lint passes.
- Formatting is clean.
- Naming follows existing patterns.
- No duplicated API/DB logic without justification.

## Database
- Queries use parameterized values.
- Explicit columns; no `SELECT *`.
- Pagination/limits are applied to list queries.
- No KODI schema modification.
- No write SQL unless the story explicitly authorizes it.

## Testing
- Unit/integration tests added for new behavior.
- Regression test added for bugs.
- Build passes.
- Relevant Playwright flow passes for user-facing critical paths.

## Security
- No secrets committed.
- No credentials logged.
- User-controlled input validated.
- Error responses do not leak SQL or connection strings.

## Documentation
- Environment changes reflected in `.env.example`.
- Architecture decision documented when it materially changes design.
- API changes documented in the ticket or relevant docs.
