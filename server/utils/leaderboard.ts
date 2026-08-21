import type { H3Event } from 'h3'
import type { GameKey } from '../../shared/games/contract'
import type { AllTimeBestEntry } from '../../shared/types/api'
import { getBindings } from './cloudflare'

interface LeaderboardRow {
  match_id: string
  match_name: string
  clerk_user_id: string
  display_name: string
  score: number
  completed_at: string
}

export async function getAllTimeBest(event: H3Event, gameKey: GameKey): Promise<AllTimeBestEntry[]> {
  const rows = await getBindings(event).DB.prepare(`
    SELECT
      summary.match_id,
      summary.match_name,
      summary.clerk_user_id,
      player.display_name,
      summary.score,
      summary.completed_at
    FROM player_match_summaries AS summary
    JOIN players AS player ON player.clerk_user_id = summary.clerk_user_id
    WHERE summary.game_key = ?1 AND player.deleted_at IS NULL
    ORDER BY summary.score DESC, summary.completed_at ASC, summary.match_id ASC, summary.clerk_user_id ASC
    LIMIT 10
  `).bind(gameKey).all<LeaderboardRow>()

  return rows.results.map((row, index) => ({
    rank: index + 1,
    matchId: row.match_id,
    matchName: row.match_name,
    playerId: row.clerk_user_id,
    playerName: row.display_name,
    score: row.score,
    achievedAt: row.completed_at
  }))
}
