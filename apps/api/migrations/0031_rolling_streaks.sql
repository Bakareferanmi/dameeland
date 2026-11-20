ALTER TABLE chat_streaks ADD COLUMN last_completed_at INTEGER;
ALTER TABLE chat_streaks ADD COLUMN first_sent_at INTEGER;
ALTER TABLE chat_streaks ADD COLUMN second_sent_at INTEGER;
ALTER TABLE chat_streaks ADD COLUMN expires_at INTEGER;

UPDATE chat_streaks SET
  last_completed_at=CASE WHEN last_completed_day IS NULL THEN NULL ELSE last_completed_day*86400000 END,
  expires_at=COALESCE(CASE WHEN last_completed_day IS NULL THEN NULL ELSE (last_completed_day+1)*86400000 END,created+86400000);
