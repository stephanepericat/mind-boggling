import { describe, expect, it } from 'vitest'
import { hasScoringOption, scoreSelection } from '../shared/games/farkle'

function dice(values: number[]) {
  return values.map((face, index) => ({ id: `d${index + 1}`, face, faceIndex: face - 1 }))
}

describe('Farkle classic.v1 scoring', () => {
  it.each([
    [[1], 100],
    [[5], 50],
    [[1, 1, 1], 300],
    [[2, 2, 2], 200],
    [[6, 6, 6], 600],
    [[2, 2, 2, 2], 1000],
    [[3, 3, 3, 3, 3], 2000],
    [[4, 4, 4, 4, 4, 4], 3000],
    [[1, 2, 3, 4, 5, 6], 1500],
    [[1, 1, 2, 2, 3, 3], 1500],
    [[2, 2, 2, 2, 5, 5], 1500],
    [[2, 2, 2, 3, 3, 3], 2500],
    [[2, 2, 2, 1, 5], 350]
  ])('scores %j as %i', (values, expected) => {
    expect(scoreSelection(dice(values))?.score).toBe(expected)
  })

  it.each([[[2]], [[2, 3]], [[2, 2]], [[2, 2, 3, 5]]])('rejects a selection containing unscored dice: %j', (values) => {
    expect(scoreSelection(dice(values))).toBeNull()
  })

  it('matches the exact classic.v1 farkle outcome counts', () => {
    const expected = [4, 16, 60, 204, 600, 1080]
    for (let count = 1; count <= 6; count += 1) {
      let farkles = 0
      const total = 6 ** count
      for (let encoded = 0; encoded < total; encoded += 1) {
        let cursor = encoded
        const values: number[] = []
        for (let die = 0; die < count; die += 1) {
          values.push(cursor % 6 + 1)
          cursor = Math.floor(cursor / 6)
        }
        if (!hasScoringOption(dice(values))) farkles += 1
      }
      expect(farkles).toBe(expected[count - 1])
    }
  })
})
