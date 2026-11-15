CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT,
  kind TEXT NOT NULL,
  entity_id TEXT,
  body TEXT NOT NULL,
  group_key TEXT,
  created INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  messages INTEGER NOT NULL DEFAULT 1,
  follows INTEGER NOT NULL DEFAULT 1,
  comments INTEGER NOT NULL DEFAULT 1,
  reactions INTEGER NOT NULL DEFAULT 1,
  calls INTEGER NOT NULL DEFAULT 1,
  birthdays INTEGER NOT NULL DEFAULT 1,
  announcements INTEGER NOT NULL DEFAULT 1,
  quiet_start TEXT,
  quiet_end TEXT,
  updated INTEGER NOT NULL
);
