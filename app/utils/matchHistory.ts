import type { MatchHistoryItem } from '../../shared/types/api'

export type MatchHistorySort = 'date' | 'score'

export function sortMatchHistory(
  matches: readonly MatchHistoryItem[],
  sortBy: MatchHistorySort
): MatchHistoryItem[] {
  return [...matches].sort((left, right) => {
    const dateDifference = Date.parse(right.completedAt) - Date.parse(left.completedAt)
    if (sortBy === 'score') {
      return right.score - left.score || dateDifference || left.matchId.localeCompare(right.matchId)
    }
    return dateDifference || right.score - left.score || left.matchId.localeCompare(right.matchId)
  })
}
