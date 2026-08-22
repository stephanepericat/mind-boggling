import { describe, expect, it } from 'vitest'
import { projectRoomState } from '../workers/match-room/src/projection'
import type { RoomState } from '../workers/match-room/src/types'
import { createFarkleState } from '../shared/games/farkle'

const activeState: RoomState = {
  stateVersion: 2,
  id: 'match-1',
  name: 'Sunday',
  status: 'active',
  hostMemberId: 'host',
  members: [
    { id: 'host', clerkUserId: 'user-host', displayName: 'Host', role: 'host', ready: true },
    { id: 'guest', clerkUserId: 'user-guest', displayName: 'Guest', role: 'player', ready: true }
  ],
  sequence: 4,
  presence: { host: { lastActivityAt: 1 }, guest: { lastActivityAt: 1 } },
  game: {
    key: 'boggle.v1',
    settings: { boardSize: 4, boardColor: 'purple', roundSeconds: 180, minWordLength: 3, rounds: 3, countdownWarning: true, locale: 'en-US' },
    state: {
      currentRound: 1,
      roundStartedAt: 1_000,
      roundEndsAt: 181_000,
      submissions: [
        { memberId: 'host', displayName: 'Host', word: 'cat', path: [0, 1, 2], submittedAt: 1 },
        { memberId: 'guest', displayName: 'Guest', word: 'dog', path: [4, 5, 6], submittedAt: 2 }
      ],
      cumulativeScores: { host: 10, guest: 8 }
    }
  }
}

describe('participant projections', () => {
  it('shows only the viewer words and opponent word counts during a round', () => {
    const view = projectRoomState(activeState, 'host', new Set(['host', 'guest']))
    expect(view.game.key).toBe('boggle.v1')
    if (view.game.key !== 'boggle.v1') throw new Error('Expected Boggle view')
    expect(view.game.view.roundStartedAt).toBe(1_000)
    expect(view.game.view.roundEndsAt).toBe(181_000)
    expect(view.game.view.submittedWords).toEqual(['cat'])
    expect(view.game.view.roundScores).toBeUndefined()
    expect(view.game.view.missedWords).toBeUndefined()
    expect(view.members.find(member => member.id === 'guest')?.wordCount).toBe(1)
    expect(view.members.every(member => member.cumulativeScore === undefined)).toBe(true)
    expect(JSON.stringify(view)).not.toContain('dog')
  })

  it('reveals scores after the round', () => {
    const view = projectRoomState({
      ...activeState,
      status: 'round_results',
      game: {
        ...activeState.game,
        state: { ...activeState.game.state, roundScores: [], missedWords: ['quit'] }
      }
    }, 'host', new Set())
    if (view.game.key !== 'boggle.v1') throw new Error('Expected Boggle view')
    expect(view.game.view.submittedWords).toBeUndefined()
    expect(view.game.view.roundScores).toEqual([])
    expect(view.game.view.missedWords).toEqual(['quit'])
    expect(view.members.map(member => member.cumulativeScore)).toEqual([10, 8])
  })

  it('projects Farkle scores and role-aware disconnect skip timing', () => {
    const game = createFarkleState(
      ['host', 'guest'],
      [{ rollId: 'opening', valuesByMemberId: { host: 2, guest: 6 }, tiedLeaderMemberIds: ['guest'] }],
      1_000
    )
    const state: RoomState = {
      stateVersion: 2,
      id: 'farkle-1',
      name: 'Dice night',
      status: 'active',
      hostMemberId: 'host',
      members: [
        { id: 'host', clerkUserId: 'user-host', displayName: 'Host', role: 'host', ready: true },
        { id: 'guest', clerkUserId: 'user-guest', displayName: 'Guest', role: 'player', ready: true }
      ],
      sequence: 2,
      presence: {
        host: { lastActivityAt: 1_500 },
        guest: { lastActivityAt: 2_000, disconnectedAt: 2_000 }
      },
      game: {
        key: 'farkle.v1',
        settings: { rulesVersion: 'classic.v1', targetScore: 5000, locale: 'en-US' },
        state: game
      }
    }

    const view = projectRoomState(state, 'host', new Set(['host']))
    if (view.game.key !== 'farkle.v1') throw new Error('Expected Farkle view')
    expect(view.game.view.activeMemberId).toBe('guest')
    expect(view.game.view.skipEligibleAt).toBe(62_000)
    expect(view.game.view.canSkipActivePlayer).toBe(true)
    expect(view.members.map(member => member.cumulativeScore)).toEqual([0, 0])
  })
})
