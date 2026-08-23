CREATE INDEX idx_movies_latest_added
  ON movies(snapshot_id, date_added DESC, title COLLATE NOCASE, id);

CREATE INDEX idx_tv_shows_latest_added
  ON tv_shows(snapshot_id, date_added DESC, title COLLATE NOCASE, id);

PRAGMA optimize;
