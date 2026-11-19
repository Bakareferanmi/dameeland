ALTER TABLE messages ADD COLUMN media TEXT;
ALTER TABLE messages ADD COLUMN media_kind TEXT CHECK(media_kind IN ('image','video'));
ALTER TABLE messages ADD COLUMN view_once INTEGER NOT NULL DEFAULT 0 CHECK(view_once IN (0,1));
ALTER TABLE messages ADD COLUMN viewed_at INTEGER;
ALTER TABLE messages ADD COLUMN media_token_hash TEXT;
ALTER TABLE messages ADD COLUMN media_token_expires INTEGER;

CREATE TABLE IF NOT EXISTS chat_streaks (
  room TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  started_by TEXT NOT NULL REFERENCES users(id),
  count INTEGER NOT NULL DEFAULT 0,
  last_completed_day INTEGER,
  first_sent_day INTEGER,
  second_sent_day INTEGER,
  created INTEGER NOT NULL
);
