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

## 5. Test in the foreground

```sh
cd /volume1/web/kodi-web
/usr/local/bin/node apps/api/dist/server.js
```

In a second SSH session:

```sh
curl --fail http://127.0.0.1:8181/api/health
curl --fail http://127.0.0.1:8181/api/library/summary
curl --fail -H 'Accept: text/html' http://127.0.0.1:8181/movies/1 >/dev/null
free -m
```

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

Verify:

```text
https://kodi/
https://kodi/movies
https://kodi/api/health
```

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

## Rollback

1. Run `scripts/nas/stop-kodi-web.sh`.
2. Disable the DSM boot task.
3. Disable or delete only the `KODI Web LAN` reverse-proxy rule.
4. Continue using `https://kodi.glabs.my`.

Rollback does not modify MariaDB, D1, synchronization, or the public Cloudflare
deployment.
