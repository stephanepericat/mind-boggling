import { describe, expect, it } from 'vitest'
import { getGameManifest, getGameOptions } from '../shared/games/registry'

describe('game registry', () => {
  it('offers every registered game to game selectors', () => {
    expect(getGameOptions()).toEqual([
      { key: 'boggle.v1', name: 'Boggle' },
      { key: 'farkle.v1', name: 'Farkle' }
    ])
  })

  it('resolves the Farkle manifest', () => {
    expect(getGameManifest('farkle.v1')?.name).toBe('Farkle')
  })
})
