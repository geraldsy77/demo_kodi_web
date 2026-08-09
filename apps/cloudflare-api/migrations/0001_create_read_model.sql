PRAGMA foreign_keys = ON;

CREATE TABLE sync_snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1))
);

CREATE UNIQUE INDEX idx_sync_snapshots_active
  ON sync_snapshots(is_active)
  WHERE is_active = 1;

CREATE TABLE movies (
  snapshot_id TEXT NOT NULL,
  id INTEGER NOT NULL CHECK (id > 0),
  title TEXT NOT NULL,
  search_title TEXT NOT NULL,
  plot TEXT,
  premiered TEXT,
  user_rating REAL,
  rating REAL,
  votes INTEGER,
  play_count INTEGER,
  last_played TEXT,
  date_added TEXT,
  resume_position_seconds REAL,
  resume_total_seconds REAL,
  artwork_url TEXT CHECK (
    artwork_url IS NULL OR
    (artwork_url GLOB 'https://*' AND instr(substr(artwork_url, 9), '@') = 0)
  ),
  PRIMARY KEY (snapshot_id, id),
  FOREIGN KEY (snapshot_id) REFERENCES sync_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX idx_movies_browse
  ON movies(snapshot_id, title COLLATE NOCASE, id);
CREATE INDEX idx_movies_search
  ON movies(snapshot_id, search_title);

CREATE TABLE tv_shows (
  snapshot_id TEXT NOT NULL,
  id INTEGER NOT NULL CHECK (id > 0),
  title TEXT NOT NULL,
  search_title TEXT NOT NULL,
  plot TEXT,
  premiered TEXT,
  user_rating REAL,
  duration_seconds REAL,
  rating REAL,
  votes INTEGER,
  last_played TEXT,
  date_added TEXT,
  total_episodes INTEGER,
  watched_episodes INTEGER,
  total_seasons INTEGER,
  artwork_url TEXT CHECK (
    artwork_url IS NULL OR
    (artwork_url GLOB 'https://*' AND instr(substr(artwork_url, 9), '@') = 0)
  ),
  PRIMARY KEY (snapshot_id, id),
  FOREIGN KEY (snapshot_id) REFERENCES sync_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX idx_tv_shows_browse
  ON tv_shows(snapshot_id, title COLLATE NOCASE, id);
CREATE INDEX idx_tv_shows_search
  ON tv_shows(snapshot_id, search_title);

PRAGMA optimize;
