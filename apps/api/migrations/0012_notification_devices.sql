CREATE TABLE IF NOT EXISTS notification_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'pwa', 'android', 'ios')),
  endpoint TEXT,
  token TEXT,
  created INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  UNIQUE(user_id, platform, endpoint, token)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user
ON notification_devices(user_id);
