ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX users_google_sub ON users(google_sub);

CREATE TABLE google_attempts (
  state TEXT PRIMARY KEY,
  exchange_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','tech')),
  expires INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  user_id TEXT REFERENCES users(id),
  error TEXT
);
CREATE INDEX google_attempts_expiry ON google_attempts(expires);
