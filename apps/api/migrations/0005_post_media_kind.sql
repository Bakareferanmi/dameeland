ALTER TABLE posts ADD COLUMN media_kind TEXT NOT NULL DEFAULT 'image' CHECK(media_kind IN ('image','video'));
