import { describe, expect, it } from 'vitest'
import { projectRoomState } from '../workers/match-room/src/projection'
import type { RoomState } from '../workers/match-room/src/types'

const activeState: RoomState = {
  id: 'match-1',
  name: 'Sunday',
  gameKey: 'boggle.v1',
  status: 'active',
  settings: { boardSize: 4, roundSeconds: 180, minWordLength: 3, rounds: 3, locale: 'en-US' },
  hostMemberId: 'host',
  currentRound: 1,
  members: [
    { id: 'host', clerkUserId: 'user-host', displayName: 'Host', role: 'host', ready: true },
    { id: 'guest', clerkUserId: 'user-guest', displayName: 'Guest', role: 'player', ready: true }
  ],
  submissions: [
    { memberId: 'host', displayName: 'Host', word: 'cat', path: [0, 1, 2], submittedAt: 1 },
    { memberId: 'guest', displayName: 'Guest', word: 'dog', path: [4, 5, 6], submittedAt: 2 }
  ],
  cumulativeScores: { host: 10, guest: 8 },
  sequence: 4
}

describe('participant projections', () => {
  it('shows only the viewer words and opponent word counts during a round', () => {
    const view = projectRoomState(activeState, 'host', new Set(['host', 'guest']))
    expect(view.submittedWords).toEqual(['cat'])
    expect(view.roundScores).toBeUndefined()
    expect(view.members.find(member => member.id === 'guest')?.wordCount).toBe(1)
    expect(view.members.every(member => member.cumulativeScore === undefined)).toBe(true)
    expect(JSON.stringify(view)).not.toContain('dog')
  })

  it('reveals scores after the round', () => {
    const view = projectRoomState({ ...activeState, status: 'round_results', roundScores: [] }, 'host', new Set())
    expect(view.submittedWords).toBeUndefined()
    expect(view.roundScores).toEqual([])
    expect(view.members.map(member => member.cumulativeScore)).toEqual([10, 8])
  })
})
