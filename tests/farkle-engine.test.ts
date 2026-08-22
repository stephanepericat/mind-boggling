import { describe, expect, it } from 'vitest'
import type { DiceRoll } from '../shared/dice/types'
import {
  bankFarkleTurn,
  continueFarkleTurn,
  createFarkleState,
  resolveOpeningRolls,
  rollFarkleDice,
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
