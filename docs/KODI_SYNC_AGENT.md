# KODI D1 snapshot sync agent

**Ticket:** KODI-404

The local agent reads the verified `MyVideos121` schema through the existing
SELECT-only MariaDB account and sends the API read model to the private
Cloudflare Worker ingestion route. MariaDB remains private and is never written.

## Configuration

Set the `KODI_SYNC_*` values documented in `.env.example`. The endpoint must be
HTTPS, `KODI_SYNC_TOKEN` must match the Worker's Cloudflare-managed
`SYNC_TOKEN`, and batches cannot exceed 50 records.

The token is sent only in the HTTPS `Authorization` header. It is never placed
in snapshot JSON, logs, or resume state.

## Dry run

Set `KODI_SYNC_DRY_RUN=true`, then run:

```powershell
npm run sync:kodi --workspace @kodi/api
```

Dry-run mode executes the same paged, SELECT-only export and reports movie and
TV-show counts. It performs no HTTP requests and creates no resume-state file.

## Synchronize

Set `KODI_SYNC_DRY_RUN=false` and run the same command. The agent:

1. Creates a timestamp-based snapshot version.
2. Reads movies and TV shows in stable ID order and bounded pages.
3. Uploads deterministic, idempotent batch IDs with bounded retry/backoff.
4. Sends the completion batch only after all records are accepted.
5. Removes the local resume file after successful completion.

Only verified DTO fields and credential-free HTTPS poster URLs are uploaded.
Raw `strPath`, `strFileName`, local artwork paths, and KODI unique IDs are not
selected.

## Interrupted runs

Progress is stored in `.kodi-sync-state.json` by default. The file contains only
the snapshot ID/version, current phase, offset, and record counts. Run the same
command again to resume. If the previous process stopped after Cloudflare
accepted a batch but before saving progress, the deterministic batch ID makes
the retry safe.

Do not manually edit the resume file. To intentionally abandon an incomplete
snapshot, remove only the configured state file while the agent is stopped;
the incomplete D1 snapshot never becomes public because no completion batch was
sent.
