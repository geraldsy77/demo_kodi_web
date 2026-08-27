# KODI manual synchronization add-on design

**Status:** Planning only  
**Backlog:** KODI-505, KODI-506, KODI-507  
**Implementation:** Deferred until one of these tickets is explicitly started

This document records the proposed implementation for manually starting the
existing Synology-to-Cloudflare D1 snapshot synchronization from KODI. The
existing DSM schedule and Cloudflare synchronization behavior remain unchanged.

## Architecture and trust boundary

```text
KODI add-on
  |  HTTPS + dedicated LAN trigger token
  v
Native DSM Express API at https://kodi
  |  starts one fixed, source-controlled command
  v
/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
  |                       |
  | SELECT-only           | HTTPS + existing KODI_SYNC_TOKEN
  v                       v
KODI MariaDB       Cloudflare Worker ingestion API -> D1
```

The add-on must not connect directly to MariaDB, D1, or the protected
Cloudflare ingestion endpoint. It receives only the narrow authority to start
and observe a synchronization run on the LAN.

The trigger API is a native DSM feature. It must not be mounted in the
Cloudflare Worker and must not be made public through a Cloudflare route,
Tunnel, router port-forward, or public reverse proxy.

## Security decisions

- Introduce `KODI_ADDON_TRIGGER_TOKEN`; do not reuse `KODI_SYNC_TOKEN`.
- Require at least 32 characters and compare bearer tokens with a timing-safe
  operation after verifying equal byte lengths.
- Keep TLS verification enabled. Allow an explicit private Root CA file when
  KODI's Python trust store does not trust the certificate for `https://kodi`.
- Never offer a setting that disables certificate validation.
- Start only the configured absolute runner path. No request field may become
  a process name, path, argument, environment variable, or shell input.
- Use `spawn(runnerPath, [], { shell: false })` and a minimal inherited
  environment.
- Use the existing NAS runner lock so manual and scheduled runs cannot overlap.
- Write status files atomically with owner-only permissions (`0600`).
- API errors contain stable codes and safe messages only. They must not include
  tokens, SQL, filesystem paths, command output, or raw exception text.
- The add-on token is sensitive even though it is LAN-only. Do not commit it,
  package it in the add-on ZIP, or print it in logs.

## API contract

All requests require:

```http
Authorization: Bearer <KODI_ADDON_TRIGGER_TOKEN>
Accept: application/json
```

### Start a run

```http
POST /api/internal/sync/runs
Content-Length: 0
```

Accepted response:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "runId": "a4fb3833-ec8a-448f-8e0d-1f5031c1d16c",
  "state": "running",
  "startedAt": "2026-08-25T02:15:00.000Z",
  "statusUrl": "/api/internal/sync/runs/a4fb3833-ec8a-448f-8e0d-1f5031c1d16c"
}
```

When either the manual API or scheduled task already owns the runner lock:

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": {
    "code": "SYNC_ALREADY_RUNNING",
    "message": "A synchronization run is already in progress."
  }
}
```

The POST endpoint accepts no JSON properties. A non-empty or malformed body is
rejected with `400 INVALID_REQUEST`.

### Read a run

```http
GET /api/internal/sync/runs/a4fb3833-ec8a-448f-8e0d-1f5031c1d16c
```

Running response:

```json
{
  "runId": "a4fb3833-ec8a-448f-8e0d-1f5031c1d16c",
  "state": "running",
  "startedAt": "2026-08-25T02:15:00.000Z",
  "completedAt": null,
  "movieCount": null,
  "tvShowCount": null,
  "failureCode": null
}
```

Successful response:

```json
{
  "runId": "a4fb3833-ec8a-448f-8e0d-1f5031c1d16c",
  "state": "success",
  "startedAt": "2026-08-25T02:15:00.000Z",
  "completedAt": "2026-08-25T02:16:08.000Z",
  "movieCount": 843,
  "tvShowCount": 71,
  "failureCode": null
}
```

Failed response:

```json
{
  "runId": "a4fb3833-ec8a-448f-8e0d-1f5031c1d16c",
  "state": "failure",
  "startedAt": "2026-08-25T02:15:00.000Z",
  "completedAt": "2026-08-25T02:15:04.000Z",
  "movieCount": null,
  "tvShowCount": null,
  "failureCode": "SYNC_FAILED"
}
```

Additional errors use the normal API error envelope:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `INVALID_RUN_ID` | The path parameter is not a UUID. |
| 401 | `SYNC_TRIGGER_UNAUTHORIZED` | The bearer token is missing or invalid. |
| 404 | `SYNC_RUN_NOT_FOUND` | The UUID is valid but no retained status exists. |
| 409 | `SYNC_ALREADY_RUNNING` | The NAS runner lock is already held. |
| 500 | `SYNC_TRIGGER_FAILED` | The fixed runner could not be started safely. |

## KODI-505 — Protected LAN trigger API

### Planned files

```text
apps/api/src/
  config/syncTriggerEnv.ts
  controllers/manualSyncController.ts
  middleware/requireSyncTriggerToken.ts
  routes/manualSyncRoutes.ts
  services/manualSyncRunStore.ts
  services/manualSyncTriggerService.ts
  tests/manualSyncRoutes.test.ts
scripts/nas/
  run-kodi-sync.sh
```

The existing `scripts/package-nas-release.ps1` already copies `scripts/nas` and
normalizes `*.sh` files to LF. KODI-505 must add the verified runner to that
source directory and add an archive-content assertion to the packaging tests or
script.

### Environment parser skeleton

The final implementation should integrate these fields into the repository's
validated configuration rather than reading `process.env` inside a route.

```ts
import { z } from 'zod';

export const syncTriggerEnvironmentSchema = z
  .object({
    KODI_ADDON_TRIGGER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    KODI_ADDON_TRIGGER_TOKEN: z.string().min(32).optional(),
    KODI_SYNC_RUNNER_PATH: z.string().startsWith('/').optional(),
    KODI_MANUAL_SYNC_STATUS_FILE: z.string().startsWith('/').optional(),
    KODI_SYNC_STATUS_FILE: z.string().startsWith('/').optional(),
  })
  .superRefine((value, context) => {
    if (!value.KODI_ADDON_TRIGGER_ENABLED) return;

    for (const key of [
      'KODI_ADDON_TRIGGER_TOKEN',
      'KODI_SYNC_RUNNER_PATH',
      'KODI_MANUAL_SYNC_STATUS_FILE',
      'KODI_SYNC_STATUS_FILE',
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when the add-on trigger is enabled.`,
        });
      }
    }
  });
```

### Token middleware skeleton

```ts
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function tokensMatch(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export function requireSyncTriggerToken(expected: string): RequestHandler {
  return (request, response, next) => {
    const prefix = 'Bearer ';
    const header = request.header('authorization') ?? '';
    const token = header.startsWith(prefix) ? header.slice(prefix.length) : '';

    if (!tokensMatch(token, expected)) {
      response.status(401).json({
        error: {
          code: 'SYNC_TRIGGER_UNAUTHORIZED',
          message: 'Valid synchronization credentials are required.',
        },
      });
      return;
    }

    next();
  };
}
```

### Service boundary skeleton

The route must depend on an interface so process execution and persistence can
be tested without starting a real sync.

```ts
export type ManualSyncState = 'running' | 'success' | 'failure';

export interface ManualSyncRun {
  runId: string;
  state: ManualSyncState;
  startedAt: string;
  completedAt: string | null;
  movieCount: number | null;
  tvShowCount: number | null;
  failureCode: 'SYNC_FAILED' | null;
}

export interface ManualSyncTriggerService {
  start(): Promise<ManualSyncRun>;
  find(runId: string): Promise<ManualSyncRun | null>;
}
```

The concrete service should:

1. Check the same lock used by the scheduled task.
2. Generate a UUID server-side and atomically persist `running` state.
3. Spawn only `KODI_SYNC_RUNNER_PATH` with no arguments and `shell: false`.
4. Return the running record immediately; do not hold the HTTP request open.
5. On exit code `0`, load and validate `KODI_SYNC_STATUS_FILE`, require a
   matching/newer attempt timestamp, and copy only safe fields to the manual
   run status.
6. On a non-zero exit or invalid status, save `failure` with `SYNC_FAILED`.
7. Reconcile a persisted `running` record after an API restart against the
   runner lock/status rather than leaving it running forever.

Example of the only permitted process call:

```ts
const child = spawn(config.runnerPath, [], {
  cwd: path.dirname(config.runnerPath),
  env: {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
  },
  shell: false,
  stdio: 'ignore',
});
```

No value from `request.body`, `request.params`, or `request.query` is passed to
`spawn`. The real service must also handle the `error` event and exactly one
terminal transition.

### Router wiring skeleton

```ts
import { Router } from 'express';
import { z } from 'zod';

const runIdSchema = z.string().uuid();

export function createManualSyncRouter(
  service: ManualSyncTriggerService,
  expectedToken: string,
): Router {
  const router = Router();
  router.use(requireSyncTriggerToken(expectedToken));

  router.post('/runs', async (_request, response, next) => {
    try {
      const run = await service.start();
      response.status(202).json({
        runId: run.runId,
        state: run.state,
        startedAt: run.startedAt,
        statusUrl: `/api/internal/sync/runs/${run.runId}`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/runs/:runId', async (request, response, next) => {
    try {
      const result = runIdSchema.safeParse(request.params.runId);
      if (!result.success) {
        response.status(400).json({
          error: { code: 'INVALID_RUN_ID', message: 'The run ID is invalid.' },
        });
        return;
      }

      const run = await service.find(result.data);
      if (!run) {
        response.status(404).json({
          error: { code: 'SYNC_RUN_NOT_FOUND', message: 'The run was not found.' },
        });
        return;
      }

      response.json(run);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

The production route is conditionally mounted before static-web fallback:

```ts
if (options.syncTrigger) {
  app.use(
    '/api/internal/sync',
    createManualSyncRouter(options.syncTrigger.service, options.syncTrigger.token),
  );
}
```

This is starter code, not a complete implementation. KODI-505 must adapt it to
the current API error classes/controller conventions and satisfy every test in
the ticket before enabling the route.

### NAS configuration

Add these values only to the NAS `.env`; retain the existing MariaDB and
Cloudflare synchronization settings:

```dotenv
KODI_ADDON_TRIGGER_ENABLED=true
KODI_ADDON_TRIGGER_TOKEN=replace-with-a-separate-random-token
KODI_SYNC_RUNNER_PATH=/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
KODI_MANUAL_SYNC_STATUS_FILE=/volume1/web/kodi-web/run/kodi-manual-sync-status.json
KODI_SYNC_STATUS_FILE=/volume1/web/kodi-web/run/kodi-sync-status.json
```

PowerShell-compatible token generation, including older Windows PowerShell:

```powershell
$tokenBytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
$generator.GetBytes($tokenBytes)
$addonTriggerToken = [Convert]::ToBase64String($tokenBytes)
$generator.Dispose()
$addonTriggerToken
```

The runner itself remains a future KODI-505 deliverable. Its required behavior
is: POSIX `sh`, LF line endings, an atomic single-run lock shared with DSM Task
Scheduler, controlled log rotation, `/usr/local/bin/node` invocation of the
compiled sync CLI, cleanup through `trap`, and propagation of the CLI exit code.
The repository version must be reconciled with the script already proven on the
NAS instead of replacing it with unverified behavior.

## KODI-506 — KODI add-on

### Planned source and ZIP layout

```text
kodi-addon/
  script.glabs.kodi-sync/
    addon.xml
    addon.py
    icon.png
    resources/
      settings.xml
      language/resource.language.en_gb/strings.po
```

The ZIP must contain `script.glabs.kodi-sync/` as its single top-level folder.
It must not contain `.env`, a configured settings file, tokens, certificates,
test caches, or source-control metadata.

### `addon.xml` starter

The version requirements must be verified against the KODI version used by the
target player before implementation is closed.

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<addon id="script.glabs.kodi-sync"
       name="g's library sync"
       version="0.1.0"
       provider-name="gLabs">
  <requires>
    <import addon="xbmc.python" version="3.0.0" />
  </requires>
  <extension point="xbmc.python.script" library="addon.py" />
  <extension point="xbmc.addon.metadata">
    <summary lang="en_GB">Synchronize g's KODI library to Cloudflare</summary>
    <description lang="en_GB">Starts the private NAS snapshot synchronization and reports its result.</description>
    <platform>all</platform>
    <license>MIT</license>
    <assets>
      <icon>icon.png</icon>
    </assets>
  </extension>
</addon>
```

### `resources/settings.xml` starter

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings version="1">
  <section id="script.glabs.kodi-sync">
    <category id="general" label="32010">
      <group id="connection" label="32011">
        <setting id="base_url" type="string" label="32012">
          <default>https://kodi</default>
          <control type="edit" format="string" />
        </setting>
        <setting id="trigger_token" type="string" label="32013">
          <default />
          <control type="edit" format="string">
            <heading>32013</heading>
            <hidevalue>true</hidevalue>
          </control>
        </setting>
        <setting id="ca_path" type="string" label="32014">
          <default />
          <control type="button" format="file" />
        </setting>
      </group>
    </category>
  </section>
</settings>
```

### `addon.py` starter

The implementation should separate HTTP and presentation functions so its unit
tests can replace KODI and network modules. The following defines the intended
flow; localization IDs should replace inline English strings in the completed
ticket.

```python
import json
import ssl
import time
import urllib.error
import urllib.request

import xbmcaddon
import xbmcgui

ADDON = xbmcaddon.Addon()
POLL_SECONDS = 2
TIMEOUT_SECONDS = 15 * 60


def request_json(url, token, method="GET", context=None):
    request = urllib.request.Request(
        url,
        method=method,
        headers={
            "Accept": "application/json",
            "Authorization": "Bearer " + token,
        },
    )
    with urllib.request.urlopen(request, timeout=15, context=context) as response:
        return json.loads(response.read().decode("utf-8"))


def tls_context(ca_path):
    # An empty path uses the platform trust store. Verification is never disabled.
    return ssl.create_default_context(cafile=ca_path or None)


def run():
    dialog = xbmcgui.Dialog()
    base_url = ADDON.getSettingString("base_url").rstrip("/")
    token = ADDON.getSettingString("trigger_token")
    ca_path = ADDON.getSettingString("ca_path")

    if not base_url.startswith("https://") or not token:
        dialog.ok("g's library sync", "Configure the HTTPS NAS URL and trigger token first.")
        return

    if not dialog.yesno("g's library sync", "Synchronize the library to Cloudflare now?"):
        return

    progress = xbmcgui.DialogProgress()
    progress.create("g's library sync", "Starting synchronization…")

    try:
        context = tls_context(ca_path)
        started = request_json(
            base_url + "/api/internal/sync/runs",
            token,
            method="POST",
            context=context,
        )
        run_id = started["runId"]
        deadline = time.monotonic() + TIMEOUT_SECONDS

        while time.monotonic() < deadline:
            if progress.iscanceled():
                dialog.ok(
                    "g's library sync",
                    "Monitoring stopped. Synchronization continues on the NAS.",
                )
                return

            status = request_json(
                base_url + "/api/internal/sync/runs/" + run_id,
                token,
                context=context,
            )
            if status["state"] == "success":
                dialog.ok(
                    "g's library sync",
                    "Synchronization completed. Movies: {}  TV shows: {}".format(
                        status["movieCount"], status["tvShowCount"]
                    ),
                )
                return
            if status["state"] == "failure":
                dialog.ok(
                    "g's library sync",
                    "Synchronization failed. Check the NAS synchronization log.",
                )
                return

            progress.update(50, "Synchronization is running…")
            time.sleep(POLL_SECONDS)

        dialog.ok(
            "g's library sync",
            "Timed out while monitoring. Synchronization may still be running on the NAS.",
        )
    except urllib.error.HTTPError as error:
        if error.code == 401:
            message = "The trigger token is not accepted."
        elif error.code == 409:
            message = "A synchronization run is already in progress."
        else:
            message = "The NAS synchronization service returned an error."
        dialog.ok("g's library sync", message)
    except ssl.SSLError:
        dialog.ok("g's library sync", "The NAS certificate could not be verified.")
    except (urllib.error.URLError, TimeoutError):
        dialog.ok("g's library sync", "The NAS synchronization service is unavailable.")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        dialog.ok("g's library sync", "The NAS returned an invalid response.")
    finally:
        progress.close()


if __name__ == "__main__":
    run()
```

KODI-506 must improve this starter before release by using localized strings,
validating the exact response schema, supporting KODI's virtual filesystem for
the optional CA selection where needed, making waits abort-aware, and testing
that exception text and tokens never reach the UI or logs.

## KODI-507 — Packaging, deployment, and validation

### Windows add-on packaging command

The final ticket should place this behavior in a source-controlled script. The
equivalent developer command is:

```powershell
$version = '0.1.0'
$source = Resolve-Path '.\kodi-addon\script.glabs.kodi-sync'
$output = Join-Path (Resolve-Path '.').Path 'dist-kodi-addon'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$zip = Join-Path $output "script.glabs.kodi-sync-$version.zip"
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -LiteralPath $source -DestinationPath $zip
tar.exe -tf $zip
```

Before release, confirm the listing begins with
`script.glabs.kodi-sync/addon.xml` and contains no generated settings or secret.

### Native DSM release sequence

1. Back up the existing NAS application `.env` and record the current release.
2. Build the normal NAS archive on Windows with
   `powershell -ExecutionPolicy Bypass -File .\scripts\package-nas-release.ps1`.
3. Verify the checksum and archive contents, including
   `scripts/nas/run-kodi-sync.sh`.
4. Stop the native application, replace application files only, install
   production dependencies, and preserve `.env`, `run/`, and `logs/`.
5. Ensure shell scripts are executable and remain LF-terminated.
6. Add the trigger-specific environment values and restart the native API.
7. Confirm the scheduled Monday/Wednesday/Friday 02:00 DSM task is unchanged.
8. Test the LAN endpoint before installing the add-on.
9. Install the add-on ZIP in KODI, configure URL/token/CA, and perform the
   end-to-end matrix below.

The detailed commands belong in KODI-507 after the final runner/service paths
are implemented and verified; they must extend `NATIVE_DSM_HOSTING.md` rather
than creating a competing upgrade procedure.

### Manual API smoke test

```powershell
$headers = @{
  Authorization = "Bearer $env:KODI_ADDON_TRIGGER_TOKEN"
  Accept = 'application/json'
}
$run = Invoke-RestMethod `
  -Method Post `
  -Uri 'https://kodi/api/internal/sync/runs' `
  -Headers $headers

Invoke-RestMethod `
  -Method Get `
  -Uri ("https://kodi" + $run.statusUrl) `
  -Headers $headers
```

Do not use `-SkipCertificateCheck`. Install/trust the private Root CA on the
test system as documented for the Synology certificate.

### End-to-end verification matrix

| Scenario | Expected KODI result | Expected NAS/D1 result |
|---|---|---|
| Normal manual run | Success with movie/TV counts | New active D1 snapshot and matching public status |
| Invalid trigger token | Authentication message | No process starts and D1 is unchanged |
| Scheduled run active | Already-running message | Existing scheduled run continues alone |
| Worker/network unavailable | Safe failure message | Failure status retained; previous active snapshot remains |
| API restarts during run | Poll recovers or returns a stable terminal result | Runner remains authoritative; no duplicate starts |
| User cancels polling | Explains that NAS work continues | Running process is not killed |
| Certificate untrusted | Certificate verification message | No request is sent with verification disabled |

Also compare the protected local run result with:

```text
https://kodi.glabs.my/api/sync/status
```

`lastSuccessAt`, `movieCount`, and `tvShowCount` should reflect the completed
snapshot. A failed upload must not replace the last successfully active D1
snapshot.

### Required gates before any story is marked done

- API/add-on unit and integration tests pass.
- Repository lint, tests, and production builds pass.
- NAS archive and add-on ZIP layout checks pass.
- No secret exists in Git, build archives, logs, errors, or screenshots.
- The KODI MariaDB user remains SELECT-only.
- DS115j CPU/memory behavior is observed during a run.
- Manual sync is not tested during a KODI library scan or near the scheduled
  Monday/Wednesday/Friday 02:00 task.
- Rollback and token-rotation steps are tested and documented.

## Reference material

- [KODI add-on structure](https://kodi.wiki/view/Add-on_structure)
- [KODI add-on manager and install from ZIP](https://kodi.wiki/view/Add-on_manager)
- [KODI add-on settings](https://kodi.wiki/view/Add-on_settings)
- [KODI GUI Python API overview](https://kodi.wiki/view/GUI_tutorial)

