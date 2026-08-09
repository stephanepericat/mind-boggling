CREATE TRIGGER IF NOT EXISTS match_member_limit
BEFORE INSERT ON match_members
WHEN (
  SELECT COUNT(*) FROM match_members
  WHERE match_id = NEW.match_id AND removed_at IS NULL
) >= 8
BEGIN
  SELECT RAISE(ABORT, 'match is full');
END;
