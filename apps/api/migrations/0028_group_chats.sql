CREATE TABLE IF NOT EXISTS chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 50),
  owner TEXT NOT NULL REFERENCES users(id),
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined INTEGER NOT NULL,
  PRIMARY KEY(group_id,user_id)
);

CREATE INDEX IF NOT EXISTS group_members_user ON group_members(user_id,group_id);

PRAGMA foreign_keys=OFF;
CREATE TABLE messages_next(
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  author TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created INTEGER NOT NULL,
  read_at INTEGER,
  edited_at INTEGER
);
INSERT INTO messages_next(id,room,author,body,created,read_at,edited_at)
  SELECT id,room,author,body,created,read_at,edited_at FROM messages;
DROP TABLE messages;
ALTER TABLE messages_next RENAME TO messages;
CREATE INDEX IF NOT EXISTS messages_room_created ON messages(room,created);
PRAGMA foreign_keys=ON;
