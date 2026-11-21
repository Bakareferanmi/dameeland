ALTER TABLE messages ADD COLUMN read_at INTEGER;
CREATE INDEX messages_unread ON messages(room,author,read_at);

CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL REFERENCES rooms(id),
  caller TEXT NOT NULL REFERENCES users(id),
  callee TEXT NOT NULL REFERENCES users(id),
  video INTEGER NOT NULL,
  offer TEXT NOT NULL,
  answer TEXT,
  state TEXT NOT NULL CHECK(state IN ('offered','ringing','answered','ended','declined')),
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX calls_callee_pending ON calls(callee,state,expires);
