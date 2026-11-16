CREATE TABLE IF NOT EXISTS event_settings (
  event_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'date',
  proposal_deadline TEXT NOT NULL DEFAULT '',
  vote_deadline TEXT NOT NULL DEFAULT '',
  meeting_date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS place_proposals (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  proposer_name TEXT NOT NULL,
  place_name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(event_id, proposer_name COLLATE NOCASE)
);
CREATE INDEX IF NOT EXISTS idx_place_proposals_event
  ON place_proposals(event_id, created_at);
CREATE TABLE IF NOT EXISTS place_votes (
  event_id TEXT NOT NULL,
  voter_name TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(event_id, voter_name COLLATE NOCASE)
);
CREATE INDEX IF NOT EXISTS idx_place_votes_event
  ON place_votes(event_id, proposal_id);
CREATE TABLE IF NOT EXISTS recovery_attempts (
  attempt_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0
);
