INSERT INTO posts(id,author,body,created,article_id)
SELECT lower(hex(randomblob(16))),a.author,
  substr(char(128240)||' New in the Press Club'||char(10)||a.title||CASE WHEN a.summary<>'' THEN char(10)||char(10)||a.summary ELSE '' END,1,1200),
  a.published_at,a.id
FROM articles a
WHERE a.status='published' AND a.published_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.article_id=a.id);
