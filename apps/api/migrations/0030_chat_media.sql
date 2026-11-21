ALTER TABLE messages ADD COLUMN media_type TEXT CHECK(media_type IN ('image','video','audio'));
