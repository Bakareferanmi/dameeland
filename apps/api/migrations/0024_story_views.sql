CREATE TABLE IF NOT EXISTS story_views (
  viewer_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  viewed_at INTEGER NOT NULL,
  PRIMARY KEY (viewer_id, story_id)
);
CREATE INDEX IF NOT EXISTS story_views_viewed_at ON story_views(viewed_at);
