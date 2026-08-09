---
name: testing-review
description: Review a completed KODI ticket against acceptance criteria, regression risks, security, database safety, lint, tests, build, and critical browser flows.
---

# Testing and Review

## Review sequence
1. Re-read the active Jira acceptance criteria.
2. Review the diff for unrelated scope.
3. Check secret/config handling.
4. Check KODI DB safety.
5. Run lint.
6. Run unit/integration tests.
7. Run production build.
8. If UI changed, run relevant browser tests or document why unavailable.
9. Inspect error/loading/empty paths.
10. Report failures; do not call the story Done while required checks fail.

## DB-specific review
Look for:
- writes,
- `SELECT *`,
- interpolation/string concatenation,
- missing limits,
- schema assumptions,
- credentials in logs.

## Completion format
- PASS/FAIL by acceptance criterion.
- Commands executed.
- Key regression risks.
- Follow-ups separated from the active ticket.
