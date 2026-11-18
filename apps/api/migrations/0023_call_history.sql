ALTER TABLE calls ADD COLUMN connected_at INTEGER;
ALTER TABLE calls ADD COLUMN ended_at INTEGER;
CREATE INDEX calls_room_history ON calls(room,created DESC);
