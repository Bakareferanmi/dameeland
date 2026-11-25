CREATE TABLE socket_tickets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,room_id TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX socket_tickets_expires ON socket_tickets(expires);
