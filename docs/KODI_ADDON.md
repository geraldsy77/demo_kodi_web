# KODI manual synchronization add-on

The `script.glabs.kodi-sync` program add-on lets a user on the private LAN ask
the native DSM KODI Web API to run the existing MariaDB-to-Cloudflare D1
snapshot synchronization. It does not connect directly to MariaDB, D1, or the
private Cloudflare ingestion endpoint.

## Compatibility

The supported target is Kodi 20 Nexus, matching the detected MyVideos121
library. The manifest requires `xbmc.python` 3.0.1. The add-on uses only Python
standard-library modules and KODI-provided modules.

## Installation and settings

Install the versioned ZIP with KODI's **Add-ons > Install from zip file** flow.
The archive must contain `script.glabs.kodi-sync/` as its single top-level
directory. It must not contain a token, generated settings, a certificate,
tests, caches, or source-control files.

### Versioning and Windows packaging

Increase the `version` attribute in
`kodi-addon/script.glabs.kodi-sync/addon.xml` before building. Keep the add-on
ID, `script.glabs.kodi-sync`, unchanged so KODI treats a higher version as an
upgrade and preserves the user's settings.

Run the following from the repository root in PowerShell. Use the Windows
`tar.exe` supplied by libarchive to create the ZIP. Do not use PowerShell's
`Compress-Archive`: on Windows it can write backslashes (`\`) into ZIP entry
names, and KODI rejects that archive as having an invalid structure.

```powershell
[xml]$manifest = Get-Content '.\kodi-addon\script.glabs.kodi-sync\addon.xml'
$version = $manifest.addon.version
$output = (New-Item -ItemType Directory -Force '.\dist-kodi-addon').FullName
$zip = Join-Path $output "script.glabs.kodi-sync-$version.zip"

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Push-Location '.\kodi-addon'
try {
  tar.exe -a -c -f $zip 'script.glabs.kodi-sync'
}
finally {
  Pop-Location
}

tar.exe -tf $zip
```

The listing must have `script.glabs.kodi-sync/` as its single top-level
directory, and every path separator must be `/`, for example:

```text
script.glabs.kodi-sync/
script.glabs.kodi-sync/addon.xml
script.glabs.kodi-sync/addon.py
script.glabs.kodi-sync/resources/settings.xml
script.glabs.kodi-sync/resources/lib/kodi_sync.py
```

A display that escapes an underscore as `\_` is harmless: the backslash is
only presentation escaping, not a directory separator. A real invalid entry
uses backslashes between path components, such as
`script.glabs.kodi-sync\resources\settings.xml`.

Remove or ignore older ZIPs with invalid entry names before copying the new
archive to the KODI device. If KODI still reports **invalid structure**, note
the exact ZIP filename and inspect `kodi.log`; the on-screen notification is
generic and the log contains the underlying installer error.

Open the add-on settings after installation and configure:

- **NAS URL:** `https://kodi` by default. Only an HTTPS origin without a path,
  query, credentials, or fragment is accepted.
- **NAS IP override:** optional literal IPv4 or IPv6 address used only for the
  underlying connection. Version 0.1.3 can connect to `192.168.0.3` while
  retaining `kodi` from the NAS URL for TLS hostname verification, SNI, and
  the HTTP Host header. This is intended for devices that must use an external
  DNS service that cannot resolve the private hostname.
- **Add-on trigger token:** the dedicated `KODI_ADDON_TRIGGER_TOKEN` from the
  NAS. Do not use `KODI_SYNC_TOKEN`.
- **Private CA certificate (local or network):** optional path to `ca.crt` when
  KODI's Python trust store does not recognize the private root CA used by
  `https://kodi`. Version 0.1.2 supports KODI VFS URLs such as
  `nfs://192.168.1.10/export/certs/ca.crt` in addition to local and
  `special://` paths.

Place `ca.crt` in a location readable by KODI and select that file in settings.
For a private-LAN deployment, a read-only NFS export lets all KODI devices use
one centrally maintained certificate without copying it into each device's
profile. The add-on reads network certificates through KODI's VFS and supplies
the PEM data directly to Python's TLS context; it does not treat an `nfs://`
URL as a local filename. The CA is not included in the add-on ZIP. TLS hostname
and certificate verification are always enabled; the add-on has no option to
disable them.
See [SYNOLOGY_SSL_CERT.md](SYNOLOGY_SSL_CERT.md) for certificate creation and
device trust instructions.

## Running a synchronization

Open **Add-ons > Program add-ons > g's library sync** and confirm the action.
The add-on starts a run through `POST /api/internal/sync/runs`, then polls its
UUID through `GET /api/internal/sync/runs/{runId}` every two seconds for at
most 15 minutes.

Cancelling the progress dialog stops only KODI's status polling. The NAS runner
continues independently. Successful runs display movie and TV-show counts;
authentication, duplicate-run, LAN, certificate, timeout, invalid-response,
and synchronization failures have separate messages that do not expose secret
or exception details.

Version 0.1.2 and later write sanitized failures to `kodi.log` with the prefix
`[script.glabs.kodi-sync]`. Diagnostics may contain an HTTP status, exception
type, or numeric OS error, but never the trigger token, Authorization header,
request URL, response body, certificate contents, or raw exception message.

On Android/Google TV devices that use Getflix DNS directly, configure:

```text
NAS URL: https://kodi
NAS IP override: 192.168.0.3
Private CA certificate: nfs://192.168.0.3/<export-path>/ca.crt
```

The IP override is scoped to each synchronous NAS request and the normal
resolver is restored immediately afterward. It does not disable TLS checks or
change the hostname presented to DSM.

The trigger must remain LAN-only. Do not add router port forwarding, a public
Cloudflare route, or a tunnel for `/api/internal/sync/runs`.
