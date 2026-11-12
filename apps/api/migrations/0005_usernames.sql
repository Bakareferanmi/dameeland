ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX users_username ON users(username COLLATE NOCASE);
ALTER TABLE google_attempts ADD COLUMN username TEXT;
