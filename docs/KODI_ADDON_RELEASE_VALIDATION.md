# KODI manual-sync release validation

This document records KODI-507 evidence for the private KODI-to-NAS manual
synchronization release. Never include trigger tokens, Authorization headers,
private keys, environment dumps, or private API response bodies here.

KODI-507 was closed by explicit owner acceptance on 2026-08-29. Verification
matrix rows still marked Pending were accepted without live execution and are
retained below as known validation gaps rather than represented as tested.

## Environment

- Add-on: `script.glabs.kodi-sync` 0.1.3
- KODI clients: Sony Android/Google TV
- NAS API: DSM HTTPS reverse proxy to the native Node.js API
- Public read model: Cloudflare D1 through `https://kodi.glabs.my`
- Existing schedule: Monday/Wednesday/Friday at 02:00

## Evidence

### Public snapshot status — 2026-08-29

Command:

```powershell
Invoke-RestMethod https://kodi.glabs.my/api/sync/status
```

Observed response:

```text
status          : current
stale           : False
lastSuccessAt   : 2026-08-29T09:58:59.135Z
durationSeconds : 3
movieCount      : 38
tvShowCount     : 26
```

The KODI 0.1.3 success dialog displayed 38 movies and 26 TV shows, matching the
public snapshot exactly. The protected NAS terminal record was:

```json
{
  "runId": "6f596d83-593b-4a33-b81e-9ba4fe25c981",
  "status": "success",
  "startedAt": "2026-08-29T09:58:39.816Z",
  "completedAt": "2026-08-29T09:59:01.606Z",
  "movieCount": 38,
  "tvShowCount": 26,
  "failureCode": null
}
```

The NAS terminal time is 2.471 seconds after public snapshot activation,
consistent with the wrapper recording completion after the snapshot becomes
active. Result: **PASS** for the complete normal manual run across KODI, the
protected NAS status, and the public D1 read model.

## Verification matrix

| Scenario | Status | Evidence still required |
|---|---|---|
| Normal manual run | **PASS** | Run `6f596d83-593b-4a33-b81e-9ba4fe25c981` succeeded; KODI, NAS, and public D1 counts match at 38 movies and 26 TV shows. |
| Invalid trigger token | **PASS** | KODI displayed the safe authentication message with no secret leakage; public status stayed at `2026-08-29T09:58:59.135Z`, 38 movies, and 26 TV shows; NAS run ID remained `6f596d83-593b-4a33-b81e-9ba4fe25c981`, proving no runner start. |
| Scheduled/manual run already active | **PASS** | A second Sony TV displayed `A synchronization run is already in progress.` while the first run continued and completed with 38 movies and 26 TV shows. The shared lock prevented overlap without interrupting the authoritative run. |
| Worker or NAS outbound network unavailable | Pending | Confirm safe failure status and preservation of this active D1 snapshot. |
| API restart during a run | Pending | Confirm the runner continues and status recovery does not start a duplicate. |
| User cancels polling | **PASS** | Accepted as successful by the operator: KODI polling stopped without cancelling the authoritative NAS run. |
| Certificate untrusted | Pending | Confirm the distinct certificate error and that verification is never disabled. |
| DS115j resource usage | Pending | Record CPU, memory, and swap during a manual run outside library scans and the scheduled window. |
| Token rotation, disablement, and rollback | Pending | Execute and record the documented operational procedures without exposing either token. |
