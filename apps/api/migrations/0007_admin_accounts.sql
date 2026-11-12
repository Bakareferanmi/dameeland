ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1));
ALTER TABLE users ADD COLUMN created INTEGER;
UPDATE users SET role='student' WHERE role='tech';
CREATE TRIGGER users_set_created AFTER INSERT ON users
WHEN NEW.created IS NULL
BEGIN
  UPDATE users SET created=unixepoch()*1000 WHERE id=NEW.id;
END;
CREATE INDEX users_created ON users(created);
CREATE INDEX comments_created ON comments(created);
CREATE INDEX messages_created ON messages(created);
