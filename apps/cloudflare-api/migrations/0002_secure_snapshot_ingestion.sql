ALTER TABLE sync_snapshots ADD COLUMN version INTEGER;

CREATE UNIQUE INDEX idx_sync_snapshots_version
  ON sync_snapshots(version)
  WHERE version IS NOT NULL;

CREATE TABLE sync_batches (
  snapshot_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'complete')),
  movie_count INTEGER NOT NULL CHECK (movie_count >= 0),
  tv_show_count INTEGER NOT NULL CHECK (tv_show_count >= 0),
  received_at TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, batch_id),
  FOREIGN KEY (snapshot_id) REFERENCES sync_snapshots(id) ON DELETE CASCADE
);

CREATE TABLE sync_audit_log (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL,
  batch_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'complete')),
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'completed', 'duplicate')),
  movie_count INTEGER NOT NULL CHECK (movie_count >= 0),
  tv_show_count INTEGER NOT NULL CHECK (tv_show_count >= 0),
  received_at TEXT NOT NULL
);

CREATE INDEX idx_sync_audit_snapshot
  ON sync_audit_log(snapshot_id, received_at);

CREATE TABLE sync_rate_limits (
  client_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (client_key, window_start)
);

CREATE INDEX idx_sync_rate_limits_window
  ON sync_rate_limits(window_start);

PRAGMA optimize;
