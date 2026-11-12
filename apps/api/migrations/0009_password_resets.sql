CREATE TABLE password_resets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires INTEGER NOT NULL
);
CREATE INDEX password_resets_expiry ON password_resets(expires);
