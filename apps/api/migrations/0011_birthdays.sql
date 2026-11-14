ALTER TABLE users ADD COLUMN dob TEXT CHECK(dob IS NULL OR dob GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]');
ALTER TABLE google_attempts ADD COLUMN dob TEXT;
CREATE TABLE birthday_wishes (
  sender TEXT NOT NULL REFERENCES users(id),
  recipient TEXT NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(sender,recipient,year)
) WITHOUT ROWID;
