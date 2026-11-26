CREATE INDEX IF NOT EXISTS posts_media ON posts(media) WHERE media IS NOT NULL;
