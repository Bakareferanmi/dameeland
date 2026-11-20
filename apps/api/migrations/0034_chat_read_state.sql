CREATE TABLE IF NOT EXISTS chat_read_state (
  room TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY(room,user_id)
);

CREATE INDEX IF NOT EXISTS chat_read_state_user ON chat_read_state(user_id,room);
