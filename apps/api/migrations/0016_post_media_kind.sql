ALTER TABLE posts ADD COLUMN media_kind TEXT CHECK (media_kind IN ('image', 'video'));

UPDATE posts SET media_kind = 'image' WHERE media IS NOT NULL;
