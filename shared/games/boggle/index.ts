import type { GameManifest } from '../contract'

export const BOGGLE_ROUND_COUNTDOWN_MS = 3_000

export const boggleManifest = {
  key: 'boggle.v1',
  slug: 'boggle',
  name: 'Boggle',
  description: 'Find as many connected words as you can before the clock runs out.',
  version: 1,
  minPlayers: 2,
  maxPlayers: 8,
  locales: ['en-US'],
  capabilities: {
    rounds: true,
    simultaneousPlay: true,
    cumulativeScoring: true,
    spectators: false
  }
} as const satisfies GameManifest

export * from './engine'
export * from './schema'
export { BOGGLE_DICTIONARY_VERSION } from './dictionary'
export { BOGGLE_MULTI_LETTER_TILES } from './dice'
export { BOGGLE_BOARD_COLORS } from './types'
export type * from './types'
