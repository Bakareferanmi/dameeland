ALTER TABLE comments ADD COLUMN media TEXT;
ALTER TABLE comments ADD COLUMN gif TEXT;
ALTER TABLE comments ADD COLUMN sticker TEXT;
CREATE INDEX comments_media ON comments(media) WHERE media IS NOT NULL;
