import { describe, expect, it } from 'vitest'
import { numericDice } from '../shared/dice/numeric'
import { rollDice } from '../shared/dice/roller'
import { SequenceRandomSource } from '../shared/random/sequence'
import { uniformIndex } from '../shared/random/uniform'

describe('reusable randomness and dice', () => {
  it('rejects the incomplete top interval instead of using biased modulo', () => {
    const source = new SequenceRandomSource([0xffff_ffff, 0xffff_fffc, 5])
    expect(uniformIndex(source, 6)).toBe(5)
  })

  it('rolls generic, stable-ID numeric dice', () => {
    const roll = rollDice({
      definitions: numericDice(3, 6),
      source: new SequenceRandomSource([0, 1, 5]),
      rollId: 'roll-1',
      rolledAt: 123
    })
    expect(roll).toEqual({
      id: 'roll-1',
      algorithmVersion: 'uniform-rejection.v1',
      rolledAt: 123,
      dice: [
        { id: 'd1', face: 1, faceIndex: 0 },
        { id: 'd2', face: 2, faceIndex: 1 },
        { id: 'd3', face: 6, faceIndex: 5 }
      ]
    })
  })
})
