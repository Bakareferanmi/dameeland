ALTER TABLE users ADD COLUMN search_public INTEGER NOT NULL DEFAULT 0 CHECK (search_public IN (0, 1));
ALTER TABLE posts ADD COLUMN search_public INTEGER NOT NULL DEFAULT 0 CHECK (search_public IN (0, 1));

CREATE INDEX users_search_public ON users(username) WHERE search_public=1 AND username IS NOT NULL;
CREATE INDEX posts_search_public ON posts(id) WHERE search_public=1;
