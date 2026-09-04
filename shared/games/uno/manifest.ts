import type { GameManifest } from '../contract'

export const unoManifest = {
  key: 'uno.v1',
  slug: 'uno',
  name: 'UNO',
  description: 'Match colors and symbols, call UNO at one card, and catch a bluff before it catches you.',
  version: 1,
  minPlayers: 2,
  maxPlayers: 8,
  locales: ['en-US'],
  capabilities: {
    rounds: true,
    simultaneousPlay: false,
    cumulativeScoring: true,
    spectators: false
  }
} as const satisfies GameManifest
