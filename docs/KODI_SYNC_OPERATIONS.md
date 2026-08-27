# KODI snapshot synchronization operations

## Active schedule

The Synology DS115j is the active synchronization host. The compiled agent
reads the local KODI MariaDB through the dedicated SELECT-only account and
sends bounded snapshots to the authenticated Cloudflare Worker ingestion
endpoint over outbound HTTPS. MariaDB port 3306 is not exposed publicly.

The active DSM schedule is:

| Setting | Value |
| --- | --- |
| DSM task name | `KODI D1 Synchronization` |
| Task type | Scheduled, user-defined script |
| User | `gerald` |
| Days | Monday, Wednesday, Friday |
| Start time | 02:00 Asia/Kuala_Lumpur |
| Command | `/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh` |

Choose a time that does not overlap a KODI library scan. The schedule runs
three times per week; therefore, the public status may become stale before the
next scheduled run because the current stale threshold is 48 hours.

The previous Windows Task Scheduler configuration is not active. Keep its
scripts only as a recovery option and never schedule both hosts at the same
time.

## NAS configuration

The ignored NAS file `/volume1/web/kodi-web/.env` contains the local MariaDB
settings and these synchronization settings:

```dotenv
KODI_SYNC_ENDPOINT=https://your-worker-url/api/internal/sync/snapshots
KODI_SYNC_TOKEN=your-existing-sync-token
KODI_SYNC_BATCH_SIZE=50
KODI_SYNC_MAX_RETRIES=4
KODI_SYNC_STATE_FILE=/volume1/web/kodi-web/run/kodi-sync-state.json
KODI_SYNC_STATUS_FILE=/volume1/web/kodi-web/run/kodi-sync-status.json
KODI_SYNC_DRY_RUN=false
```

The optional native KODI add-on trigger uses these additional settings:

```dotenv
KODI_ADDON_TRIGGER_ENABLED=true
KODI_ADDON_TRIGGER_TOKEN=replace-with-a-separate-addon-trigger-token
KODI_SYNC_RUNNER_PATH=/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
KODI_SYNC_LOCK_DIR=/volume1/web/kodi-web/run/kodi-sync.lock
KODI_MANUAL_SYNC_STATUS_FILE=/volume1/web/kodi-web/run/kodi-manual-sync-status.json
```

The trigger token must contain at least 32 characters and must not equal
`KODI_SYNC_TOKEN`. `KODI_SYNC_TOKEN` authorizes snapshot ingestion by the
Cloudflare Worker; `KODI_ADDON_TRIGGER_TOKEN` only authorizes starting and
observing a run through the native DSM API. Never copy the Worker token or
MariaDB credentials into the KODI add-on.

The actual endpoint and token are secrets/configuration, not documentation.
Never paste the token into logs, tickets, or Git. Protect the environment and
runner files:

```sh
chmod 600 /volume1/web/kodi-web/.env
chmod 750 /volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
```

The NAS runner:

- prevents overlapping synchronization processes with a lock directory;
- removes a stale lock when its recorded process no longer exists;
- runs the compiled agent with reduced CPU priority;
- rotates its log after 5 MB; and
- returns the agent's exit code to DSM Task Scheduler.

The runner must use Unix LF line endings. If DSM reports
`/bin/sh^M: bad interpreter`, repair the file on the NAS:

```sh
sed -i 's/\r$//' /volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
chmod 750 /volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
```

## Manual synchronization trigger API

The native Express application conditionally mounts the trigger only when
`KODI_ADDON_TRIGGER_ENABLED=true`. It is reached through the LAN-only DSM
reverse proxy at `https://kodi`; it is not implemented by the public
Cloudflare Worker.

The protected contract is:

| Request | Successful result |
| --- | --- |
| `POST /api/internal/sync/runs` | `202` with `runId`, `state`, `startedAt`, and `statusUrl` |
| `GET /api/internal/sync/runs/{runId}` | `200` with `running`, `success`, or `failure`, timestamps, counts, and a stable failure code |

Both requests require:

```http
Authorization: Bearer <KODI_ADDON_TRIGGER_TOKEN>
Accept: application/json
```

The POST body must be empty or an empty JSON object. Important errors are:

| HTTP | Code | Meaning |
| ---: | --- | --- |
| `400` | `INVALID_REQUEST` or `INVALID_RUN_ID` | The body or run identifier is invalid. |
| `401` | `SYNC_TRIGGER_UNAUTHORIZED` | The dedicated trigger token is missing or invalid. |
| `404` | `SYNC_RUN_NOT_FOUND` | No retained status exists for that run identifier. |
| `409` | `SYNC_ALREADY_RUNNING` | The API or DSM scheduled runner already owns the shared lock. |
| `500` | `SYNC_TRIGGER_FAILED` | The runner could not be started or its safe status could not be read. |

Cancelling KODI add-on polling does not terminate the NAS process. The runner
continues and remains observable through its status and log files.

### Authenticated LAN smoke test

Run this from a Windows LAN client that trusts the private Root CA. Put the
dedicated trigger token in a temporary process environment variable so it is
not written into the command itself:

```powershell
$headers = @{
  Authorization = "Bearer $env:KODI_ADDON_TRIGGER_TOKEN"
  Accept = 'application/json'
}

$run = Invoke-RestMethod `
  -Method Post `
  -Uri 'https://kodi/api/internal/sync/runs' `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body '{}'

$run

Invoke-RestMethod `
  -Method Get `
  -Uri ("https://kodi" + $run.statusUrl) `
  -Headers $headers

Remove-Item Env:KODI_ADDON_TRIGGER_TOKEN
```

Do not use `-SkipCertificateCheck`. Install the Synology private Root CA as
documented in `SYNOLOGY_SSL_CERTIFICATE.md`. A second POST during the run must
return `409 SYNC_ALREADY_RUNNING`; it must not start a second MariaDB export or
D1 upload.

## DSM Task Scheduler

In DSM, open:

```text
Control Panel > Task Scheduler > KODI D1 Synchronization
```

Confirm that the task is enabled and configured as follows:

1. **General:** user `gerald`.
2. **Schedule:** weekly on Monday, Wednesday, and Friday at 02:00.
3. **Task Settings > User-defined script:**

   ```sh
   /volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
   ```

After changing the task, select it and choose **Run** once. A successful manual
run confirms that DSM can execute the script with the selected user's file and
database permissions.

## Monitoring

- `https://kodi.glabs.my/api/sync/status` exposes only the active snapshot's
  last-success timestamp, duration, movie/TV counts, and `current`, `stale`, or
  `never_synced` state.
- `/volume1/web/kodi-web/run/kodi-sync-status.json` records the last local
  attempt, success/failure time, duration, counts, and stable failure code. It
  contains no credentials.
- `/volume1/web/kodi-web/run/kodi-manual-sync-status.json` records the most
  recent add-on-triggered run identifier, state, timestamps, counts, and stable
  failure code. It contains no credentials, paths, SQL, or command output.
- `/volume1/web/kodi-web/run/kodi-sync.lock/` is shared by the DSM schedule and
  native trigger. A live PID means another run owns synchronization; stale
  ownership is recovered by the runner/lock service.
- `/volume1/web/kodi-web/logs/kodi-sync.log` records runner start, completion,
  failure, and overlap messages without logging the token.
- DSM Task Scheduler shows whether the scheduled command launched and the exit
  result it returned.

Check the NAS after a run:

```sh
tail -n 50 /volume1/web/kodi-web/logs/kodi-sync.log
cat /volume1/web/kodi-web/run/kodi-sync-status.json
free -m
```

Staleness never deactivates the last completed snapshot. Public library routes
continue serving that snapshot while the next run or recovery is pending.

## Manual rerun and recovery

Run the same protected runner manually rather than invoking a second copy of
the Node process:

```sh
/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
```

If it fails:

1. Check `kodi-sync.log` and `kodi-sync-status.json`. Do not display `.env`.
2. Confirm the NAS has Internet access over HTTPS and MariaDB is available on
   the configured local address.
3. Confirm memory and swap remain stable with `free -m`.
4. Run the runner again. It resumes from
   `/volume1/web/kodi-web/run/kodi-sync-state.json`.
5. A partial snapshot is never activated, so the previous completed D1
   snapshot remains public.
6. If the resume state is known to be unrecoverable, ensure no synchronization
   process is running, rename the state file as a diagnostic backup, and run
   the runner again. Never delete or modify KODI tables.
7. Confirm the public status is `current` and its counts match the NAS status
   file.

The automated tests cover persisted success/failure metadata, preservation of
the previous success, partial-upload resume behavior, atomic activation, and
continued public reads when stale.

## Disable or roll back scheduling

Disable `KODI D1 Synchronization` in DSM Task Scheduler. This stops future
updates but does not delete MariaDB data or the last completed D1 snapshot.

If the NAS can no longer run the agent, disable its DSM task before enabling
the existing Windows scheduler. Only one host may own the schedule at a time.

## Rotate or disable the add-on trigger

Token rotation does not require changing the Worker ingestion token:

1. Generate a new random add-on trigger token of at least 32 characters on a
   trusted administrator device.
2. Replace only `KODI_ADDON_TRIGGER_TOKEN` in the NAS `.env` and retain mode
   `600`.
3. Restart KODI Web so the old token is no longer accepted.
4. Update the token in each trusted KODI add-on installation.
5. Run the authenticated LAN smoke test and remove temporary token variables.

To disable manual triggering while keeping scheduled synchronization active,
set `KODI_ADDON_TRIGGER_ENABLED=false` in the NAS `.env` and restart KODI Web.
Do not disable the Monday/Wednesday/Friday DSM task unless scheduling ownership
is also intentionally changing. Disabling the add-on trigger does not delete
MariaDB data, synchronization state, or the last active D1 snapshot.
