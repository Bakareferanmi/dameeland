ALTER TABLE users ADD COLUMN avatar_media TEXT;
ALTER TABLE users ADD COLUMN cover_media TEXT;
CREATE INDEX users_avatar_media ON users(avatar_media);
CREATE INDEX users_cover_media ON users(cover_media);
