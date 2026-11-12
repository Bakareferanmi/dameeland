ALTER TABLE reactions ADD COLUMN created INTEGER;
CREATE INDEX reactions_created ON reactions(created) WHERE created IS NOT NULL;
