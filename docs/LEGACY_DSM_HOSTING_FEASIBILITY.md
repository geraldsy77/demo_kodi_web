# Legacy DSM hosting feasibility

## Decision

For Stage 1, run the KODI web and API containers on another always-on device
on the private LAN. Keep MariaDB and the KODI-owned database on the Synology
DS115j. Windows Docker Desktop is the current host; a supported Raspberry Pi
or small x86-64 Linux host can replace it later without changing the API
contract.

Do not install an unofficial Docker daemon or run this application natively on
the DS115j. Do not expose MariaDB port 3306 to the public Internet.

## Verified target

| Item | Verified value |
| --- | --- |
| NAS | Synology DiskStation DS115j |
| DSM | 7.1.1-42962 Update 9 |
| CPU/platform | Marvell Armada 370 88F6707, one core, 32-bit ARMv7 (`armada370`) |
| Memory | 256 MB DDR3 |

Synology's [CPU table](https://kb.synology.com/en-sg/DSM/tutorial/What_kind_of_CPU_does_my_NAS_have)
and [DS115j data sheet](https://global.download.synology.com/download/Document/Hardware/DataSheet/DiskStation/15-year/DS115j/enu/Synology_DS115j_Data_Sheet_enu.pdf)
confirm the hardware. The [Synology archive](https://archive.synology.com/download/Os/DSM/7.1.1-42962-9)
identifies Update 9 for the `armada370` DS115j platform.

## Package availability

- The DS115j Download Center offers DSM 7.1.1 but does not offer Container
  Manager for this model. Container Manager 20.10.23 requires DSM 7.2 or
  later according to its
  [release notes](https://www.synology.com/en-us/releaseNote/ContainerManager).
- There is no compatible, supported legacy Synology Docker package for this
  model. Manually bypassing SPK model or architecture checks would create an
  unmaintained root-level service and is rejected.
- [SynoCommunity](https://docs.synocommunity.com/user-guide/) is an available
  third-party package source. It publishes some DSM 7.1 `armada370` packages,
  but compatibility is package-specific and third-party packages are not
  verified by Synology on DSM 7. Its repository does not make Container
  Manager available on unsupported hardware.
- Package Center on the NAS remains the authoritative view of packages
  compatible with the exact DSM/model combination.

## Options compared

| Option | Feasibility | Operations and upgrades | Security and resource tradeoffs |
| --- | --- | --- | --- |
| Legacy Docker package on DS115j | Rejected: no supported package for DSM 7.1.1/DS115j | Manual SPK modification would be fragile across DSM updates and has no supported rollback path | Docker is privileged; unofficial binaries increase supply-chain risk; 256 MB RAM is inadequate for two application containers |
| Native Node.js on DS115j | Rejected for this application | Requires maintaining a compatible Node 22 runtime, dependencies, static server, startup, logs, and upgrades outside the tested container path | The old 32-bit platform is not a dependable current Node production target, and the application would compete with MariaDB in 256 MB RAM |
| Web/API containers on another LAN device | Selected | Uses the tested Compose images, health checks, restart policy, and normal image rebuild/rollback workflow | Requires another powered device, but isolates load from the NAS and permits a supported x86-64 or ARM64 runtime |

## Selected private-LAN topology

```text
Browser
   |
   v
External LAN Docker host :8181
   +-- nginx/static web
   +-- Node API :3001
            |
            | private LAN TCP 3306
            v
Synology DS115j
   +-- MariaDB
   +-- MyVideos###
```

The API must use a dedicated SELECT-only MariaDB account restricted to the
external host's LAN address where practical. The router must not forward port
3306. Credentials stay in the Docker host's uncommitted `.env` file and never
enter the browser or web image.

## Operating and upgrade implications

- Assign stable LAN addresses or DHCP reservations to the NAS and Docker host.
- Keep the host operating system and Docker runtime supported and patched.
  Docker Desktop is acceptable now; an always-on Linux device is preferable
  for unattended service.
- Build tagged images before upgrades and retain previous tags for rollback.
  Application rollback must not modify the KODI-owned database.
- Back up the NAS configuration and KODI/MariaDB data independently. This
  read-only web application is not a database backup.
- Restrict ports 8181 and 3001 to trusted LAN clients. Port 3001 need not be
  exposed beyond the Docker host once diagnostics no longer require it.

## Consequence for KODI-302

The deployment runbook should target an external LAN Docker host, not Synology
Container Manager. Synology steps should cover the read-only MariaDB account,
LAN/firewall configuration, and backups only.
