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
