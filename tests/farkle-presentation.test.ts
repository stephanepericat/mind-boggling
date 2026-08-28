import { describe, expect, it } from 'vitest'
import {
  FARKLE_MESSAGE_MS,
  HOT_DICE_MESSAGE_MS,
  latestFarkleAnnouncements
} from '../app/utils/farkleAnnouncements'
import { resolveDiceAppearance } from '../app/utils/diceAppearance'

describe('Farkle presentation', () => {
  it('resolves random dice colors deterministically per roll', () => {
    expect(resolveDiceAppearance('random', 'roll-42')).toEqual(resolveDiceAppearance('random', 'roll-42'))
    expect(resolveDiceAppearance('ivory', 'roll-1')).toMatchObject({ bodyColor: '#fffdf7', pipColor: '#172033' })
  })

  it('orders a simultaneous hot-dice and Farkle announcement and uses the longer Farkle duration', () => {
    const hotDice = { memberId: 'a', sourceRollId: 'r1', nextRollId: 'r2', points: 2_500, at: 10_000 }
    const resolution = {
      type: 'farkled',
      memberId: 'a',
      points: 0 as const,
      at: 10_000,
      rollId: 'r2',
      dice: [{ id: 'd1', face: 2, faceIndex: 1 }]
    } as const
    expect(latestFarkleAnnouncements(hotDice, resolution, 10_000).map(item => item.type)).toEqual(['hot-dice', 'farkle'])
    expect(HOT_DICE_MESSAGE_MS).toBe(2_500)
    expect(FARKLE_MESSAGE_MS).toBe(6_000)
  })

  it('does not replay an old hot-dice popup after a newer turn resolution', () => {
    const hotDice = { memberId: 'a', sourceRollId: 'r1', nextRollId: 'r2', points: 2_500, at: 10_000 }
    const banked = { type: 'banked' as const, memberId: 'a', points: 2_500, at: 10_500 }
    expect(latestFarkleAnnouncements(hotDice, banked, 10_500)).toEqual([])
  })
})
