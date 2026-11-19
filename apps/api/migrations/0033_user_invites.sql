ALTER TABLE users ADD COLUMN invite_code TEXT;
ALTER TABLE users ADD COLUMN invited_by TEXT REFERENCES users(id);
ALTER TABLE google_attempts ADD COLUMN referral_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_invite_code ON users(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_invited_by ON users(invited_by) WHERE invited_by IS NOT NULL;
