CREATE INDEX IF NOT EXISTS player_leaderboard_idx
  ON player_match_summaries (game_key, score DESC, completed_at ASC);
