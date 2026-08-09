# KODI MariaDB Discovery

KODI database names and schemas vary by KODI version. Inspect first. The
KODI-002 utility reads database metadata only; it does not inspect or modify
KODI library data.

## Step 1 — configure read-only access

Copy `.env.example` to `.env` and set the MariaDB host, port, and a dedicated
read-only account. Leave `KODI_VIDEO_DB` empty until discovery is complete.
Never commit `.env` or paste its password into discovery results.

The account must be able to view database metadata and later select from the
chosen KODI database. Do not grant write or schema privileges.

## Step 2 — identify video database candidates

Run this command from the repository root; the CLI loads the local `.env` file:

```powershell
npm run db:discover --workspace @kodi/api
```

The command lists visible database names matching `MyVideos%`. It prints a
sanitized troubleshooting message and exits nonzero if validation, networking,
or authentication fails. It never prints the configured password.

The utility uses this parameterized metadata-only query:

```sql
SELECT SCHEMA_NAME AS databaseName
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME LIKE ?
ORDER BY SCHEMA_NAME;
```

Record results without credentials:

```text
Discovery date:
MariaDB host/instance label (no credentials):
Candidates:
Selected video DB:
KODI version:
Notes/errors (redacted):
```

Recorded 2026-08-09:

```text
Discovery date: 2026-08-09
MariaDB host/instance label (no credentials): Synology MariaDB on private LAN
Candidates: MyVideos116, MyVideos121
Selected video DB: MyVideos121
KODI version: Kodi 20 Nexus (schema version 121)
Notes/errors (redacted): Read-only connection and metadata discovery succeeded.
```

Detailed schema observations are recorded in
[`docs/schema/MYVIDEOS121.md`](schema/MYVIDEOS121.md).

Set `KODI_VIDEO_DB` to the selected candidate only after confirming it belongs
to the active KODI installation.

## Step 3 — inspect the selected schema (KODI-003)

For the selected video database:

```sql
SHOW TABLES;
```

Then inspect only the tables/views needed for the current story:

```sql
DESCRIBE <table_or_view>;
SHOW CREATE VIEW <view_name>;
```

KODI commonly exposes useful views, but verify the actual schema rather than
assuming names or columns.

## Step 4 — safe repository exploration

Before implementing a real repository query:

1. Save schema observations in this file or a new `docs/schema/` note.
2. Write the smallest query needed for the active Jira story.
3. Add a limit during exploration.
4. Do not modify schema or data.

## Art paths

KODI artwork paths can use KODI-specific formats and local network paths. Do
not assume a browser can display them directly.

Create a separate Jira story for artwork mapping once actual values are
inspected.
