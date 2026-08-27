# Native DSM hosting pilot

This runbook hosts the compiled React site and read-only Express API as one
Node.js process on the Synology DS115j. It is a LAN-only fallback deployment.
The public Cloudflare deployment remains available, while the DS115j also owns
the scheduled outbound D1 snapshot synchronization described in
[`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md).

## Constraints

- Verified NAS: DS115j, DSM 7.1.1, ARMv7, 256 MB RAM.
- Verified runtime: Node.js 18.18.2 and npm 9.8.1.
- Node.js 18 is end-of-life. Do not expose this service to the Internet.
- Build on the development laptop. Do not install TypeScript, Vite, tests, or
  other development dependencies on the NAS.
- MariaDB access remains SELECT-only. Never forward port 3306.
- Keep the Cloudflare site available for immediate rollback.

## 1. Create the release on Windows

From the repository root:

```powershell
npm.cmd run package:nas
```

The command builds the API and frontend, generates a production-only package
lock, normalizes DSM shell scripts to LF line endings, and creates:

```text
dist-nas/kodi-web-nas-release.tar.gz
```

It also prints a SHA-256 checksum. The archive contains compiled output only;
it does not contain `.env`, source files, tests, or Cloudflare credentials.

## 2. Transfer and verify

Upload to the NAS:

```powershell
scp .\dist-nas\kodi-web-nas-release.tar.gz gerald@gerald-nas:/volume1/web/
```

If DSM reports `subsystem request failed on channel 0`, force the legacy SCP
protocol because this DSM version does not provide the SFTP subsystem used by
newer Windows OpenSSH clients:

```powershell
scp.exe -O .\dist-nas\kodi-web-nas-release.tar.gz gerald@192.168.0.3:/volume1/web/
```

Optionally verify the Windows checksum again:

```powershell
certutil -hashfile .\dist-nas\kodi-web-nas-release.tar.gz SHA256
```

On the NAS:

```sh
cd /volume1/web
sha256sum kodi-web-nas-release.tar.gz
tar -xzf kodi-web-nas-release.tar.gz
cd /volume1/web/kodi-web
```

Compare the two checksums before continuing.

## 3. Install production dependencies

Install only the locked runtime dependency tree:

```sh
cd /volume1/web/kodi-web/apps/api
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspaces=false
```

Do not run `npm install` from `/volume1/web/kodi-web` and do not install the
repository's development workspaces on the NAS.

## 4. Configure the service

```sh
cd /volume1/web/kodi-web
cp .env.example .env
chmod 600 .env
```

Edit `.env` locally on the NAS. Keep these native-hosting values:

```dotenv
NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=8181
WEB_DIST_PATH=/volume1/web/kodi-web/apps/web/dist
KODI_DB_HOST=127.0.0.1
KODI_DB_PORT=3306
```

Set the verified `KODI_VIDEO_DB` and dedicated SELECT-only database
credentials. If this NAS owns D1 synchronization, also configure the
`KODI_SYNC_*` values documented in
[`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md). Keep `.env` mode `600`
because it then contains the Worker synchronization token.

To allow the future KODI add-on to start a synchronization from the private
LAN, configure the native-only trigger separately:

```dotenv
KODI_ADDON_TRIGGER_ENABLED=true
KODI_ADDON_TRIGGER_TOKEN=replace-with-a-separate-addon-trigger-token
KODI_SYNC_RUNNER_PATH=/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh
KODI_SYNC_LOCK_DIR=/volume1/web/kodi-web/run/kodi-sync.lock
KODI_MANUAL_SYNC_STATUS_FILE=/volume1/web/kodi-web/run/kodi-manual-sync-status.json
KODI_SYNC_STATUS_FILE=/volume1/web/kodi-web/run/kodi-sync-status.json
```

`KODI_ADDON_TRIGGER_TOKEN` and `KODI_SYNC_TOKEN` grant different permissions
and must have different random values. The add-on token can only start and
observe a native LAN run; it must never contain the Worker ingestion token,
MariaDB password, or a copy of either credential. Generate and store the real
value only in the ignored NAS `.env` and the KODI add-on settings. Do not put it
in `.env.example`, a release archive, a command transcript, or Git.

Leave `KODI_ADDON_TRIGGER_ENABLED=false` or omit it until the trigger API and
its tests are included in the installed release. Enabling the flag with a
missing or invalid trigger setting intentionally prevents API startup.

## 5. Test in the foreground

```sh
cd /volume1/web/kodi-web
/usr/local/bin/node apps/api/dist/server.js
```

In a second SSH session:

```sh
curl --fail http://127.0.0.1:8181/api/health
curl --fail http://127.0.0.1:8181/api/library/summary
curl --fail -H 'Accept: text/html' http://127.0.0.1:8181/movies/QaaaaaaaaAA >/dev/null
free -m
```

The final command checks the SPA fallback only; its sample opaque ID does not
need to identify a real movie. Numeric detail URLs such as `/movies/1` are no
longer part of the public API contract.

Stop the foreground process with `Ctrl+C`. Do not proceed if available memory
remains below roughly 20 MB, swap grows continuously, DSM becomes unstable, or
KODI/MariaDB performance degrades.

## 6. Install lifecycle scripts

```sh
chmod 750 /volume1/web/kodi-web/scripts/nas/*.sh
/volume1/web/kodi-web/scripts/nas/start-kodi-web.sh
/volume1/web/kodi-web/scripts/nas/status-kodi-web.sh
```

Logs and the PID file are stored under `logs/` and `run/`. The stop script
checks the process command before sending `SIGTERM`:

```sh
/volume1/web/kodi-web/scripts/nas/stop-kodi-web.sh
```

## 7. Configure DSM reverse proxy

Create the simple hostname `kodi` in the ASUS router's local DNS/host settings
and point it to the NAS address. ASUS stock firmware supports the simple
hostname used by this deployment rather than a local domain-style hostname.
In DSM, go to:

```text
Control Panel > Login Portal > Advanced > Reverse Proxy > Create
```

Use:

| Field | Value |
| --- | --- |
| Name | KODI Web LAN |
| Source protocol | HTTPS |
| Source hostname | `kodi` |
| Source port | `443` |
| Destination protocol | HTTP |
| Destination hostname | `127.0.0.1` |
| Destination port | `8181` |

Use a dedicated source hostname so the rule does not capture unrelated DSM
traffic. Restrict access to the private LAN with DSM firewall/access-control
rules. Do not configure router port forwarding.

The manual synchronization routes use the same reverse proxy and are expected
only at:

```text
POST https://kodi/api/internal/sync/runs
GET  https://kodi/api/internal/sync/runs/{runId}
```

Keep `API_HOST=127.0.0.1`; clients must reach the API through the DSM HTTPS
reverse proxy rather than connecting directly to port `8181`. In DSM Firewall,
allow HTTPS port `443` from the trusted private-LAN subnet and deny it from
untrusted interfaces according to the rest of the NAS policy. Review DSM
management rules before changing firewall order so administration access is
not accidentally blocked.

Do not create a router port-forward, public DNS record, Cloudflare Tunnel,
Worker route, Pages proxy, or other Internet path for
`/api/internal/sync/runs`. The bearer token is a second control, not a reason to
make the trigger public. The public `kodi.glabs.my` Worker exposes read/status
APIs only and must not forward this native trigger route.

Verify:

```text
https://kodi/
https://kodi/movies
https://kodi/api/health
```

When a frontend or API contract changes, run `npm.cmd run package:nas` again on
Windows, transfer and extract the new archive, rerun the production dependency
installation, and restart the service. The release package includes Vite
public assets (including the favicon) and the compiled API, so no source build
is required on the DS115j.

The `kodi` hostname must resolve to the NAS on each LAN client. For the locally
trusted HTTPS certificate and device trust instructions, follow
[`SYNOLOGY_SSL_CERTIFICATE.md`](SYNOLOGY_SSL_CERTIFICATE.md). The certificate
SAN must include `DNS:kodi` so it matches the URL clients use.

## 8. Start at boot

In DSM Task Scheduler, create a triggered user-defined task:

| Setting | Value |
| --- | --- |
| Name | Start KODI Web |
| User | Non-administrator service user with access to the release directory |
| Event | Boot-up |
| Command | `/volume1/web/kodi-web/scripts/nas/start-kodi-web.sh` |

Run the task manually once, then check the status script and health endpoint.

## Updating an existing LAN installation from Windows

Use this procedure for later frontend or API releases. It preserves the NAS
`.env`, D1 synchronization state, logs, DSM scheduled tasks, reverse proxy, and
locally trusted certificate.

### 1. Build and checksum the release on Windows

From the repository root:

```powershell
Set-Location D:\web_dev\demo_kodi_web
npm.cmd run package:nas
Get-FileHash .\dist-nas\kodi-web-nas-release.tar.gz -Algorithm SHA256
```

### 2. Transfer the archive

The DS115j requires legacy SCP mode with the current Windows OpenSSH client:

```powershell
scp.exe -O .\dist-nas\kodi-web-nas-release.tar.gz gerald@192.168.0.3:/volume1/web/
ssh gerald@192.168.0.3
```

On the NAS, compare the archive checksum with the Windows result:

```sh
cd /volume1/web
sha256sum kodi-web-nas-release.tar.gz
```

Do not continue if the checksums differ.

### 3. Stop and extract the release

```sh
/volume1/web/kodi-web/scripts/nas/stop-kodi-web.sh
cd /volume1/web
tar -xzf kodi-web-nas-release.tar.gz
```

Do not delete `/volume1/web/kodi-web` before extraction. The release archive
does not contain `.env`, so extracting it in place preserves:

```text
/volume1/web/kodi-web/.env
/volume1/web/kodi-web/run/
/volume1/web/kodi-web/logs/
/volume1/web/kodi-web/apps/api/node_modules/
```

Never run `cp .env.example .env` during an upgrade because that would replace
the working MariaDB credentials and synchronization configuration.

### 4. Refresh runtime dependencies and permissions

```sh
cd /volume1/web/kodi-web/apps/api
/usr/local/bin/npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspaces=false
chmod 750 /volume1/web/kodi-web/scripts/nas/*.sh
```

The Windows packaging command normalizes the shell scripts to Unix LF line
endings before creating the archive.

### 5. Start and verify the release

```sh
/volume1/web/kodi-web/scripts/nas/start-kodi-web.sh
/volume1/web/kodi-web/scripts/nas/status-kodi-web.sh
curl --fail http://127.0.0.1:8181/api/health
curl --fail http://127.0.0.1:8181/api/library/summary
curl --fail 'http://127.0.0.1:8181/api/movies?page=1&pageSize=1'
```

If startup fails, inspect the application log:

```sh
tail -n 50 /volume1/web/kodi-web/logs/kodi-web.log
```

Finally, verify `https://kodi`, its movie and TV-show detail routes, and the
favicon from a LAN client. Use `Ctrl+F5` for a desktop hard refresh. If Android
Chrome retains the old site or favicon, force-stop Chrome and reopen it.

The DSM reverse proxy, certificate, router hostname, boot task, and scheduled
D1 synchronization task do not require changes for an application upgrade.
After an upgrade that introduces or changes the manual trigger, repeat the
authenticated LAN smoke test in
[`KODI_SYNC_OPERATIONS.md`](KODI_SYNC_OPERATIONS.md) and confirm that an active
scheduled run returns `409 SYNC_ALREADY_RUNNING` rather than starting another
process.

## Rollback

1. Run `scripts/nas/stop-kodi-web.sh`.
2. Disable the DSM boot task.
3. Disable or delete only the `KODI Web LAN` reverse-proxy rule.
4. Continue using `https://kodi.glabs.my`.

Rollback does not modify MariaDB, D1, synchronization, or the public Cloudflare
deployment.
