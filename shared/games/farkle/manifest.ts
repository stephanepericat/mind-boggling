import type { GameManifest } from '../contract'

export const farkleManifest = {
  key: 'farkle.v1',
  slug: 'farkle',
  name: 'Farkle',
  description: 'Push your luck with six dice, bank scoring combinations, and avoid a turn-ending Farkle.',
  version: 1,
  minPlayers: 2,
  maxPlayers: 8,
  locales: ['en-US'],
  capabilities: {
    rounds: false,
    simultaneousPlay: false,
    cumulativeScoring: true,
    spectators: false
  }
} as const satisfies GameManifest
