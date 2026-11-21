CREATE TABLE IF NOT EXISTS press_writers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS articles_published ON articles(status,published_at DESC);
CREATE INDEX IF NOT EXISTS articles_author ON articles(author,updated DESC);
