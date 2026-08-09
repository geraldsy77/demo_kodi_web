# Cloudflare Stage 2 feasibility

## Decision

Use Cloudflare Pages for the frontend, a Worker for the stable HTTP API, and
an app-owned Cloudflare D1 read model. A scheduled agent on the private LAN
reads KODI MariaDB using SELECT-only credentials and pushes snapshots to a
separate authenticated Worker endpoint over HTTPS.

Cloudflare will not connect to MariaDB. NAS port 3306 remains private, and the
cloud database is an eventually consistent application projection rather than
a copy or backup of the KODI-owned schema.

References:

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 Worker binding API](https://developers.cloudflare.com/d1/worker-api/)

## Alternatives evaluated

| Design | Result | Reason |
| --- | --- | --- |
| Public MariaDB endpoint | Rejected | Exposes port 3306 to the Internet and conflicts with the security baseline |
| Hyperdrive + Workers VPC + Tunnel | Feasible but not selected | Preserves private connectivity, but keeps runtime availability coupled to the home connection, MariaDB TLS, and an always-on tunnel connector |
| Outbound metadata snapshots to D1 | Selected | Requires no inbound NAS connectivity, keeps the public site available while home systems are offline, and places only the API's bounded read model in Cloudflare |

The isolated Hyperdrive `SELECT 1` probe remains in the repository as evidence
that the alternative bundles correctly; it is not the selected production
architecture and must not be deployed with the placeholder binding ID.

## Data boundary

The D1 schema will contain only fields already exposed by the stable API:

- movie and TV-show identifiers and display metadata;
- watch/resume values required by the existing pages;
- sanitized HTTPS artwork URLs;
- normalized fields required for pagination and search; and
- sync run/version metadata.

Database credentials, KODI table names, raw filesystem paths, connection
strings, and unrelated KODI data are excluded. Artwork binaries remain at
their HTTPS origins unless a later ticket explicitly selects R2.

The verified library currently has 38 movies and 26 TV shows, far below D1's
documented storage and query limits. Schema design must still paginate reads,
index browse/search fields, and batch writes so larger libraries remain safe.

## Synchronization ownership

Cloudflare Cron Triggers cannot independently reach the private NAS without a
tunnel. Scheduling therefore belongs to the private LAN host:

1. Query the verified KODI schema through the SELECT-only account.
2. Map rows to the app-owned read model.
3. Start a versioned snapshot.
4. Upload validated, bounded HTTPS batches with retry/backoff.
5. Atomically mark the snapshot complete.
6. Remove D1 records absent from the completed snapshot.

The ingestion endpoint uses a Cloudflare-managed secret, timing-safe
verification, payload limits, idempotency keys, and stale-version rejection.
Interrupted snapshots never become the active public dataset.

## Failure and recovery behavior

- NAS, LAN, or sync-host outage: D1 continues serving the last complete
  snapshot and exposes its last-success timestamp.
- Upload interruption: retry the same idempotent snapshot/batch identifiers.
- Invalid or stale snapshot: reject without changing the active dataset.
- Worker or D1 failure: retain the previous complete snapshot and report a
  sanitized failure from the sync agent.
- Bad release: Stage 1 remains deployable, and Worker/Pages versions can roll
  back without modifying MariaDB.

The sync process is not a KODI backup. NAS/MariaDB backups remain independent.

## Delivery tickets

- KODI-402: D1 read model and Worker read API.
- KODI-403: secure D1 snapshot ingestion endpoint.
- KODI-404: local read-only KODI sync agent.
- KODI-405: Cloudflare Pages deployment.
- KODI-406: schedule, monitoring, and recovery.
