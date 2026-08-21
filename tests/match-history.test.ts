import { describe, expect, it } from 'vitest'
import { sortMatchHistory } from '../app/utils/matchHistory'
import type { MatchHistoryItem } from '../shared/types/api'

const matches: MatchHistoryItem[] = [
  { matchId: 'older-high', matchName: 'Older high', gameName: 'Boggle', completedAt: '2026-08-18T12:00:00.000Z', placement: 1, score: 40, participants: [] },
  { matchId: 'newer-low', matchName: 'Newer low', gameName: 'Boggle', completedAt: '2026-08-20T12:00:00.000Z', placement: 2, score: 10, participants: [] },
  { matchId: 'newest-high', matchName: 'Newest high', gameName: 'Boggle', completedAt: '2026-08-19T12:00:00.000Z', placement: 1, score: 40, participants: [] }
]

describe('match history sorting', () => {
  it('sorts newest matches first by date without mutating the source', () => {
    expect(sortMatchHistory(matches, 'date').map(match => match.matchId)).toEqual([
      'newer-low',
      'newest-high',
      'older-high'
    ])
    expect(matches.map(match => match.matchId)).toEqual(['older-high', 'newer-low', 'newest-high'])
  })

  it('sorts highest scores first and uses newest date for ties', () => {
    expect(sortMatchHistory(matches, 'score').map(match => match.matchId)).toEqual([
      'newest-high',
      'older-high',
      'newer-low'
    ])
  })
})
