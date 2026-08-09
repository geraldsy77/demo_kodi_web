# Cloudflare Hyperdrive feasibility probe

This isolated KODI-401 probe validates that `mysql2` bundles for Workers and
executes only `SELECT 1 AS ok`. It is not the Stage 2 API implementation.

The committed Hyperdrive ID is deliberately invalid. Before a live test,
create a private Hyperdrive configuration backed by a Workers VPC service and
replace it with the returned binding ID. Never add a database connection
string or credentials to this file.

The Worker returns measured query latency on success. Connection failures are
bounded by a five-second connect timeout and return `DATABASE_UNAVAILABLE`
without the underlying error or credentials.
