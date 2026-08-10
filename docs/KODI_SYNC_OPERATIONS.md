# KODI snapshot synchronization operations

## Schedule

The selected private-LAN host is the Windows machine running Docker Desktop. MariaDB stays on the NAS and port 3306 must remain reachable only from the private LAN. In an elevated PowerShell window, register a daily 03:00 task:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-kodi-sync-task.ps1 -DailyAt 03:00
```

The task uses `scripts/run-kodi-sync.ps1`. A named mutex and Task Scheduler's `IgnoreNew` policy prevent overlapping runs. Set `KODI_SYNC_ENDPOINT`, `KODI_SYNC_TOKEN`, and the SELECT-only MariaDB values in the ignored root `.env` before registering it. Verify with `Get-ScheduledTask -TaskName 'KODI Web Snapshot Sync'` and trigger once with `Start-ScheduledTask -TaskName 'KODI Web Snapshot Sync'`.

## Monitoring

- `https://kodi.glabs.my/api/sync/status` exposes only the active snapshot's last-success timestamp, duration, movie/TV counts, and `current`, `stale`, or `never_synced` state. Data becomes stale after 48 hours.
- `.kodi-sync-status.json` on the LAN host records the last attempt, last success/failure, duration, counts, and stable failure code. It contains no credentials and is ignored by Git.
- Task Scheduler history and the task's last result show whether the runner launched. Exit code 0 means success or an intentionally skipped overlapping run.

Staleness never deactivates the last completed snapshot. Public library routes continue serving that snapshot while operators investigate.

## Manual rerun and recovery

1. Check `.kodi-sync-status.json` and Task Scheduler history. Do not paste `.env` or tokens into logs or tickets.
2. Confirm the NAS and MariaDB are reachable privately and run `npm run db:discover --workspace @kodi/api` if database selection is in doubt.
3. Rerun `powershell -ExecutionPolicy Bypass -File .\scripts\run-kodi-sync.ps1`.
4. The uploader resumes a partial snapshot from `.kodi-sync-state.json`. A failed or partial snapshot is never activated, so the previous complete snapshot remains public.
5. If the saved state is known to be unrecoverable, stop all sync processes, rename `.kodi-sync-state.json` as a diagnostic backup, then run the wrapper again to create a fresh snapshot. Do not delete or modify KODI tables.
6. Confirm `/api/sync/status` is `current` and its counts match the local success record.

The automated tests cover persisted success/failure metadata, preservation of the previous success, partial-upload resume behavior, atomic activation, and continued public reads when stale.

## Rollback

Stage 1 remains available through the local Docker Compose deployment. If Cloudflare synchronization or serving must be disabled, stop or disable `KODI Web Snapshot Sync` in Task Scheduler and use the Stage 1 LAN URL. This does not change MariaDB or its SELECT-only account. Re-enable the task and manually rerun it when Cloudflare service is restored.
