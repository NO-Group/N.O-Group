CREATE TABLE IF NOT EXISTS request_reservations (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  client TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reservations_service_time ON request_reservations(service, created_at);
CREATE INDEX IF NOT EXISTS reservations_client_time ON request_reservations(service, client, created_at);
CREATE TABLE IF NOT EXISTS provider_cooldown (service TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);
