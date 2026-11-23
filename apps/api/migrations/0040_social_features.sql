-- Quote posts: a post can quote one other post.
ALTER TABLE posts ADD COLUMN quote_of TEXT;
CREATE INDEX IF NOT EXISTS posts_quote_of ON posts(quote_of) WHERE quote_of IS NOT NULL;

-- Shared posts: the post author plus up to two invited co-authors (three people maximum).
CREATE TABLE IF NOT EXISTS post_authors (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
  invited_by TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(post_id,user_id)
);
CREATE INDEX IF NOT EXISTS post_authors_user ON post_authors(user_id,status);

-- Swipe-to-reply in chats and groups: a message can reply to another message in the same room.
ALTER TABLE messages ADD COLUMN reply_to TEXT;

-- One emoji reaction per person per message.
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(message_id,user_id)
);
CREATE INDEX IF NOT EXISTS message_reactions_message ON message_reactions(message_id);
