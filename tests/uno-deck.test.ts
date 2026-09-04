import { describe, expect, it } from 'vitest'
import { createUnoDeck, unoCardPoints } from '../shared/games/uno'

describe('UNO classic deck', () => {
  it('creates the official 108 unique cards', () => {
    const deck = createUnoDeck()
    expect(deck).toHaveLength(108)
    expect(new Set(deck.map(card => card.id)).size).toBe(108)
    for (const color of ['red', 'yellow', 'green', 'blue']) {
      const colored = deck.filter(card => card.color === color)
      expect(colored).toHaveLength(25)
      expect(colored.filter(card => card.kind === 'number' && card.number === 0)).toHaveLength(1)
      for (let number = 1; number <= 9; number += 1) {
        expect(colored.filter(card => card.kind === 'number' && card.number === number)).toHaveLength(2)
      }
      expect(colored.filter(card => card.kind === 'skip')).toHaveLength(2)
      expect(colored.filter(card => card.kind === 'reverse')).toHaveLength(2)
      expect(colored.filter(card => card.kind === 'draw-two')).toHaveLength(2)
    }
    expect(deck.filter(card => card.kind === 'wild')).toHaveLength(4)
    expect(deck.filter(card => card.kind === 'wild-draw-four')).toHaveLength(4)
  })

  it('uses official card values', () => {
    const deck = createUnoDeck()
    expect(unoCardPoints(deck.find(card => card.id === 'red:7:0')!)).toBe(7)
    expect(unoCardPoints(deck.find(card => card.id === 'blue:skip:0')!)).toBe(20)
    expect(unoCardPoints(deck.find(card => card.id === 'wild:wild:0')!)).toBe(50)
  })
})
