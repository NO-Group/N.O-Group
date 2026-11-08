CREATE TABLE IF NOT EXISTS widget_cache (
  cache_key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS widget_cache_expiry ON widget_cache(expires_at);
