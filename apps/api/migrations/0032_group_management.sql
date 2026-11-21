ALTER TABLE chat_groups ADD COLUMN photo_media TEXT;
ALTER TABLE chat_groups ADD COLUMN invite_code TEXT;
ALTER TABLE group_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin'));

UPDATE group_members SET role='admin'
WHERE EXISTS(SELECT 1 FROM chat_groups g WHERE g.id=group_members.group_id AND g.owner=group_members.user_id);

CREATE UNIQUE INDEX IF NOT EXISTS chat_groups_invite_code ON chat_groups(invite_code) WHERE invite_code IS NOT NULL;
