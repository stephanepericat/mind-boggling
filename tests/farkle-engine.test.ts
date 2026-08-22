import { describe, expect, it } from 'vitest'
import type { DiceRoll } from '../shared/dice/types'
import {
  bankFarkleTurn,
  continueFarkleTurn,
  createFarkleOpeningState,
  createFarkleState,
  resolveOpeningRolls,
  rollFarkleOpeningDie,
  rollFarkleDice,
  startFarkleGame,
  skipFarkleTurn
} from '../shared/games/farkle'

function roll(id: string, ids: string[], values: number[], at = 10): DiceRoll<number> {
  return {
    id,
    algorithmVersion: 'uniform-rejection.v1',
    rolledAt: at,
    dice: ids.map((dieId, index) => ({ id: dieId, face: values[index]!, faceIndex: values[index]! - 1 }))
  }
}

function state() {
  return createFarkleState(['a', 'b'], [{ rollId: 'opening', valuesByMemberId: { a: 6, b: 2 }, tiedLeaderMemberIds: ['a'] }], 1)
}

const settings = { rulesVersion: 'classic.v1', targetScore: 1000, locale: 'en-US' } as const

describe('Farkle engine', () => {
  it('lets players resolve the opening high roll and only the winner start play', () => {
    let opening = createFarkleOpeningState(['a', 'b', 'c'], 'opening-1')
    expect(opening.phase).toBe('opening-roll')
    expect(opening.turn).toBeUndefined()

    opening = rollFarkleOpeningDie(opening, 'a', 6, 'opening-2').state
    opening = rollFarkleOpeningDie(opening, 'b', 6, 'opening-2').state
    opening = rollFarkleOpeningDie(opening, 'c', 2, 'opening-2').state
    expect(opening.openingRollRounds).toHaveLength(2)
    expect(opening.openingRollRounds[1]?.tiedLeaderMemberIds).toEqual(['a', 'b'])
    expect(rollFarkleOpeningDie(opening, 'c', 6, 'unused').error).toBe('not_in_opening_roll')

    opening = rollFarkleOpeningDie(opening, 'a', 4, 'opening-3').state
    opening = rollFarkleOpeningDie(opening, 'b', 5, 'opening-3').state
    expect(opening.openingWinnerMemberId).toBe('b')
    expect(opening.phase).toBe('opening-roll')
    expect(opening.turn).toBeUndefined()
    expect(opening.openingRollRounds[1]?.valuesByMemberId).toEqual({ a: 4, b: 5 })
    expect(startFarkleGame(opening, 'a', 10).error).toBe('opening_winner_only')

    const playing = startFarkleGame(opening, 'b', 10).state
    expect(playing.phase).toBe('playing')
    expect(playing.turnOrder).toEqual(['b', 'c', 'a'])
    expect(playing.turn?.memberId).toBe('b')
  })

  it('rerolls only tied opening leaders', () => {
    const values = [6, 6, 2, 3, 5]
    const rounds = resolveOpeningRolls(['a', 'b', 'c'], () => values.shift()!, () => `r${values.length}`)
    expect(rounds).toHaveLength(2)
    expect(rounds[0]!.valuesByMemberId).toEqual({ a: 6, b: 6, c: 2 })
    expect(rounds[1]!.valuesByMemberId).toEqual({ a: 3, b: 5 })
    expect(rounds[1]!.tiedLeaderMemberIds).toEqual(['b'])
  })

  it('supports strategic subsets, hot dice, and loses the whole turn on a farkle', () => {
    const first = rollFarkleDice(state(), 'a', roll('r1', ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], [1, 1, 1, 5, 5, 5]), 2).state
    const continued = continueFarkleTurn(first, 'a', 'r1', ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], roll('r2', ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], [2, 3, 4, 6, 2, 3]), 3).state
    expect(continued.turn?.memberId).toBe('b')
    expect(continued.scores.a).toBe(0)
    expect(continued.stats.a?.farkles).toBe(1)
    expect(continued.lastResolution).toMatchObject({
      type: 'farkled',
      memberId: 'a',
      dice: [
        { id: 'd1', face: 2 },
        { id: 'd2', face: 3 },
        { id: 'd3', face: 4 },
        { id: 'd4', face: 6 },
        { id: 'd5', face: 2 },
        { id: 'd6', face: 3 }
      ]
    })
  })

  it('enforces the fixed 500-point opening threshold', () => {
    const rolled = rollFarkleDice(state(), 'a', roll('r1', ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], [1, 1, 1, 2, 3, 4]), 2).state
    expect(bankFarkleTurn(rolled, settings, 'a', 'r1', ['d1', 'd2', 'd3'], 3).error).toBe('opening_threshold_not_met')
  })

  it('gives every opponent a final turn then enters repeated sudden-death cycles', () => {
    const initial = state()
    initial.scores.a = 900
    initial.scores.b = 1000
    initial.hasEnteredScoreboard.a = true
    initial.hasEnteredScoreboard.b = true
    const rolled = rollFarkleDice(initial, 'a', roll('r1', ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], [1, 2, 3, 4, 6, 2]), 2).state
    const finalTurns = bankFarkleTurn(rolled, settings, 'a', 'r1', ['d1'], 3).state
    expect(finalTurns.phase).toBe('final-turns')
    expect(finalTurns.turn?.memberId).toBe('b')
    const afterSkip = skipFarkleTurn(finalTurns, 'b', 4).state
    expect(afterSkip.phase).toBe('sudden-death')
    expect(afterSkip.turn?.memberId).toBe('a')
    expect(afterSkip.suddenDeath?.eligibleMemberIds).toEqual(['a', 'b'])
  })
})
