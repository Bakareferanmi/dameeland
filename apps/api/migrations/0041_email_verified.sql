-- Password sign-ups never proved the person owns the email address. Track that, so an unverified account can't be used to hijack a later Google login.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1));
-- Google only returns verified emails, so every Google-linked account is already verified.
UPDATE users SET email_verified=1 WHERE google_sub IS NOT NULL;
-- The owner account existed before this column. Keep it verified so the owner doesn't lose admin rights on deploy.
UPDATE users SET email_verified=1 WHERE lower(email)='bakareferanmi96@gmail.com';
