PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  clerk_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_key TEXT NOT NULL,
  game_version INTEGER NOT NULL,
  host_member_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lobby', 'active', 'round_results', 'finished', 'cancelled')),
  settings_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS match_members (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES players(clerk_user_id),
  display_name_snapshot TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host', 'player')),
  joined_at TEXT NOT NULL,
  removed_at TEXT,
  UNIQUE (match_id, clerk_user_id)
);

CREATE INDEX IF NOT EXISTS match_members_user_idx
  ON match_members (clerk_user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  token_digest TEXT NOT NULL UNIQUE,
  created_by_member_id TEXT NOT NULL REFERENCES match_members(id),
  max_uses INTEGER NOT NULL DEFAULT 7,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS invites_match_idx ON invites (match_id);

CREATE TABLE IF NOT EXISTS invite_intents (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_by_clerk_user_id TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS score_projections (
  idempotency_key TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES match_members(id),
  score INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  finalized_at TEXT NOT NULL,
  UNIQUE (match_id, member_id)
);

CREATE TABLE IF NOT EXISTS player_match_summaries (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES players(clerk_user_id),
  match_name TEXT NOT NULL,
  game_key TEXT NOT NULL,
  placement INTEGER NOT NULL,
  score INTEGER NOT NULL,
  participants_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (match_id, clerk_user_id)
);

CREATE INDEX IF NOT EXISTS player_history_idx
  ON player_match_summaries (clerk_user_id, completed_at DESC);
