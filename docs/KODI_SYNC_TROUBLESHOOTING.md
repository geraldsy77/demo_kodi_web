# KODI snapshot synchronization troubleshooting

How to diagnose "the public site is missing titles that the NAS site shows".
Relates to [`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md) (operations) and
[`KODI_SYNC_AGENT.md`](KODI_SYNC_AGENT.md) (agent behaviour).

> **Convention:** do not record media titles, plots, artwork URLs, raw media
> paths, tokens, or credentials in this document. Reference items by numeric ID.

## The two data paths

| Surface | Reads | Freshness |
| --- | --- | --- |
| NAS site (LAN only) | KODI MariaDB directly through the Express API | Live, to the second |
| Production (`https://kodi.glabs.my`) | The active Cloudflare D1 snapshot | As old as the last successful run |

Production is an **eventually consistent projection**, not a replica. A
difference between the two is expected until the next successful run — it is
not, by itself, evidence of data loss.

## Incident 2026-09-17 — production snapshot lag

**Symptom.** The public site showed fewer movies than the NAS site. Public
status reported `movieCount: 38` with
`lastSuccessAt: 2026-09-15T18:00:21.528Z`.

**Observed in the source library.** The newest row in `movie_view` was
`idMovie 47` with `dateAdded: 2026-09-15 19:16:32`.

**Resolution.** A manual run of the DSM task completed at
`2026-09-17T13:26:21.584Z` and reported:

```json
{
  "status": "current",
  "stale": false,
  "lastSuccessAt": "2026-09-17T13:26:21.584Z",
  "durationSeconds": 6,
  "movieCount": 39,
  "tvShowCount": 26
}
```

Both surfaces then agreed. **No defect was present.** The movie had entered the
library after the Wednesday snapshot, so production was correctly serving the
previous, complete snapshot.

**Root cause:** snapshot lag, made confusing by a timestamp timezone offset
(see "`dateAdded` timezone caveat" below).

**Hypotheses tested and disproven:**

| Hypothesis | Test | Result |
| --- | --- | --- |
| Rows exist in `movie` but not in `movie_view`, so the NAS counter includes rows production cannot export | Orphan join query (Q2) | **0 orphans** — disproven |
| A batch was rejected or only partially applied | Manual run and count comparison | **39 exported cleanly** — disproven |
| `GET /api/sync/status` reports incorrect counts | Compared against the post-run library state | Correct |

## Standard timeline arithmetic

All Cloudflare timestamps are UTC. Malaysia is **UTC+8**:

```text
MYT = UTC + 8 hours
```

The status endpoint returns a UTC instant, while KODI stores `dateAdded` as a
**local-time string**. Read the `dateAdded` caveat before comparing the two.

Example: `2026-09-15T18:00:21Z` is `2026-09-16 02:00:21 MYT` — the Wednesday
02:00 scheduled run.

## Diagnostic procedure

Run these in order and stop as soon as the cause is identified.

### Step 1 — Is the snapshot merely old?

```powershell
Invoke-RestMethod https://kodi.glabs.my/api/sync/status
```

| Observation | Meaning |
| --- | --- |
| `lastSuccessAt` older than the newest library change | Snapshot lag. Continue to step 2, then apply the remediation. |
| `stale: true` | If it is Sunday 02:00 to Monday 02:00, this is expected: the 48 hour threshold is shorter than the Friday to Monday gap (T13 in `PROJECT_HANDOVER_ASSESSMENT.md`). |
| `status: never_synced` | No snapshot has ever completed. |

### Step 2 — Does the library actually differ from the snapshot?

```sql
-- Read-only. Run against the selected KODI video database.
SELECT COUNT(*) AS movieViewRows FROM movie_view;
SELECT COUNT(*) AS tvShowViewRows FROM tvshow_view;
```

```powershell
# Read-only SELECT against the remote D1 database.
npx wrangler d1 execute kodi-web --remote --config apps/cloudflare-api/wrangler.jsonc `
  --command "SELECT COUNT(*) AS movieCount FROM movies WHERE snapshot_id = (SELECT id FROM sync_snapshots WHERE is_active = 1)"
```

| Observation | Meaning |
| --- | --- |
| Counts equal | Production is complete. Any on-screen difference is a UI or pagination issue, not a data issue. |
| Canonical count higher | Lag or a failing run. Continue. |

### Step 3 — Are runs failing?

```sh
cat /volume1/web/kodi-web/run/kodi-sync-status.json          # last attempt: outcome, counts, failureCode
cat /volume1/web/kodi-web/run/kodi-manual-sync-status.json   # last add-on-triggered run
tail -n 50 /volume1/web/kodi-web/logs/kodi-sync.log
```

| Evidence | Cause |
| --- | --- |
| `outcome: failure`, `failureCode: SYNC_FAILED` | The agent run failed. Read the log for the failing stage. |
| The add-on shows an authentication message | Wrong or rotated `KODI_ADDON_TRIGGER_TOKEN`. |
| The add-on shows "already in progress" | A scheduled or manual run owns the shared lock (`SYNC_ALREADY_RUNNING`). |
| Network or HTTPS unreachable | Outbound connectivity from the NAS. |
| Failure with HTTP 400 returned by the Worker | A row failed strict payload validation. See step 4. |

### Step 4 — Is one row silently blocking the whole snapshot?

The Worker validates each batch **all-or-nothing** and rejects it with
`400 INVALID_SYNC_PAYLOAD` if any record fails schema validation. Because the
completion batch is then never sent, **D1 keeps serving the previous snapshot
indefinitely while every subsequent run fails.** A movie with a NULL or empty
`c00` title is the classic trigger, because `title` requires a non-empty string.

```sql
SELECT idMovie, c00, idFile, dateAdded
FROM movie_view
WHERE c00 IS NULL OR TRIM(c00) = '';

SELECT idShow, c00, dateAdded
FROM tvshow_view
WHERE c00 IS NULL OR TRIM(c00) = '';
```

Any result is a real defect: the agent should tolerate or clearly report the row
rather than freezing synchronization indefinitely.

### Step 5 — Is an abandoned resume file interfering?

Look for `409 SNAPSHOT_CONFLICT` or `409 BATCH_CONFLICT` in the log. Recovery is
documented in [`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md) under "Manual
rerun and recovery" (step 6). Never edit or delete KODI tables.

### Step 6 — Confirm the intended row is present after a successful run

```powershell
npx wrangler d1 execute kodi-web --remote --config apps/cloudflare-api/wrangler.jsonc `
  --command "SELECT id, date_added FROM movies WHERE snapshot_id = (SELECT id FROM sync_snapshots WHERE is_active = 1) ORDER BY date_added IS NULL ASC, date_added DESC, id ASC LIMIT 10"
```

## Reference queries

All queries in this document are read-only. Never run `UPDATE`, `DELETE`, or DDL
against the KODI database.

### Q1 — Library counts (source of truth)

```sql
SELECT
  (SELECT COUNT(*) FROM movie)       AS movieTableRows,
  (SELECT COUNT(*) FROM movie_view)  AS movieViewRows,
  (SELECT COUNT(*) FROM tvshow)      AS tvShowTableRows,
  (SELECT COUNT(*) FROM tvshow_view) AS tvShowViewRows;
```

### Q2 — Orphan rows (`movie` rows the view cannot expose)

The counter inconsistency described as T5 in `PROJECT_HANDOVER_ASSESSMENT.md` is
latent. If these queries return rows, it becomes active and the NAS counter will
exceed production permanently.

```sql
SELECT COUNT(*) AS orphans
FROM movie AS m
LEFT JOIN movie_view AS v ON v.idMovie = m.idMovie
WHERE v.idMovie IS NULL;

SELECT m.idMovie, m.c00 AS title, m.idFile
FROM movie AS m
LEFT JOIN movie_view AS v ON v.idMovie = m.idMovie
WHERE v.idMovie IS NULL
ORDER BY m.idMovie ASC;
```

`dateAdded` is **not** a column of the `movie` base table; it arrives through
`movie_view`. Querying `m.dateAdded` raises
`#1054 Unknown column 'm.dateAdded' in 'field list'`. Join `files` when the
addition date is needed:

```sql
SELECT m.idMovie, m.c00 AS title, m.idFile, f.strFileName, f.dateAdded
FROM movie AS m
LEFT JOIN movie_view AS v ON v.idMovie = m.idMovie
LEFT JOIN files      AS f ON f.idFile   = m.idFile
WHERE v.idMovie IS NULL
ORDER BY m.idMovie ASC;
```

### Q3 — Newest library additions

A scan that adds several files at once stamps them with the **same second**, so
always list more than one row.

```sql
SELECT idMovie, c00 AS title, dateAdded
FROM movie_view
ORDER BY dateAdded IS NULL ASC, dateAdded DESC, idMovie DESC
LIMIT 10;
```

### Q4 — Active snapshot (production)

```powershell
npx wrangler d1 execute kodi-web --remote --config apps/cloudflare-api/wrangler.jsonc `
  --command "SELECT id, created_at, completed_at FROM sync_snapshots WHERE is_active = 1"
```

### Q5 — Ingestion audit trail

```powershell
npx wrangler d1 execute kodi-web --remote --config apps/cloudflare-api/wrangler.jsonc `
  --command "SELECT snapshot_id, action, outcome, movie_count, tv_show_count, received_at FROM sync_audit_log ORDER BY received_at DESC LIMIT 20"
```

A healthy run shows `accepted` upsert batches followed by a `completed` row for
the same snapshot. A repeated `duplicate` outcome indicates a retry of an
already-accepted batch, which is safe.

### Q6 — Column reference when a query fails

```sql
DESCRIBE movie;
DESCRIBE movie_view;
DESCRIBE files;
```

## Remediation

1. Prefer the KODI add-on or the protected LAN trigger for a manual run.
2. Alternatively run the shared runner directly on the NAS:

   ```sh
   /volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
   ```

3. Never invoke a second copy of the Node agent directly.
4. Never run a synchronization during a KODI library scan.
5. Re-check `/api/sync/status` afterwards. It should be `current`, with counts
   matching step 2.

Cancelling add-on polling does not terminate the NAS run; the runner remains
authoritative and observable through its status and log files.

## `dateAdded` timezone caveat

`dateAdded` is written by the KODI client that performed the scan, in that
client's timezone. The NAS clock and Cloudflare timestamps are not necessarily
the same reference. In the 2026-09-17 incident the two were roughly **8 hours
apart**, which made a newly added movie appear to predate the snapshot that had
actually missed it.

**Consequence:** never conclude "the row existed before the snapshot, so the
synchronization must be broken" from a `dateAdded` comparison alone. Convert the
snapshot's UTC time to local time first, and if the two still disagree, treat
the offset as unknown and reason from counts instead.

**Confirm the offset once** by noting the wall-clock time a movie is added and
then reading its stamp:

```sql
SELECT idMovie, c00, dateAdded FROM movie_view ORDER BY idMovie DESC LIMIT 1;
```

This does not affect synchronization — the agent exports every row regardless of
`dateAdded` — but it affects how "recently added" ordering should be read and
how future missing-title reports are interpreted.

## Escalation criteria

Raise a ticket when any of the following is true:

- The canonical count exceeds the D1 count **after** a successful run.
- A run reports the same stable failure code twice in a row.
- A row fails payload validation (`400 INVALID_SYNC_PAYLOAD`) and freezes
  synchronization.
- `sync_audit_log` shows no `completed` row for the expected snapshot.
- `stale: true` persists outside the known Sunday to Monday window.
