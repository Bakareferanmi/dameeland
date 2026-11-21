ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id);
CREATE INDEX comments_parent ON comments(parent_id);
CREATE TABLE comment_likes (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id,user_id)
);
CREATE TABLE story_likes (
  story_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id,user_id)
);
CREATE INDEX story_likes_author ON story_likes(author_id);
