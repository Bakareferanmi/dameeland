-- Graded practice sessions. One row per subject covered by a session, so a mixed session adds a row for each subject it touched.
CREATE TABLE IF NOT EXISTS practice_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct >= 0),
  total INTEGER NOT NULL CHECK (total > 0),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS practice_results_user ON practice_results(user_id, subject);
