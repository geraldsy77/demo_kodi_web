---
name: kodi-mariadb
description: Safely inspect and query the existing KODI MariaDB schema without guessing schema versions or modifying KODI-owned data.
---

# KODI MariaDB

## Core rule
Treat KODI MariaDB as an externally owned database. Default to SELECT-only behavior.

## Workflow
1. Read `docs/KODI_DB_DISCOVERY.md`.
2. Determine the configured video DB name from environment/config.
3. If schema is unknown, inspect database/table/view metadata first.
4. Prefer verified KODI views when they provide stable readable data, but verify actual columns.
5. Put SQL only in API repository modules.
6. Use `mysql2/promise`.
7. Use parameter placeholders for user-controlled values.
8. Select explicit columns.
9. Limit/paginate list queries.
10. Map raw rows to application DTOs before returning data to services/controllers.
11. Add integration coverage for repository queries where possible.

## Prohibited
- `DROP`, `ALTER`, `TRUNCATE`, schema migration.
- Writes unless a Jira story explicitly allows them.
- Guessing a KODI schema suffix.
- Guessing columns based only on another KODI version.
- Building SQL with string-concatenated user input.
- Logging credentials.

## Completion check
Explain which verified tables/views/columns were used and why.
