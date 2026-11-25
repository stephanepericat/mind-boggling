import type { GameManifest } from '../contract'
import type { HoldemFormat } from './types'

export const holdemManifest = {
  key: 'texas-holdem.v1',
  slug: 'texas-holdem',
  name: 'Texas Hold’em',
  description: 'Two private cards, a shared board, and one decision at a time. Play 12 hands or see who holds the last chips.',
  version: 1,
  minPlayers: 2,
  maxPlayers: 8,
  locales: ['en-US'],
  capabilities: { rounds: true, simultaneousPlay: false, cumulativeScoring: true, spectators: false }
} as const satisfies GameManifest

export const HOLDEM_RULES = {
  version: 'no-limit.v1',
  fixedHands: 12,
  startingStack: 1000,
  startingBigBlind: 10,
  handsPerLevel: 4,
  turnMs: 25_000,
  intermissionMs: 5_000
} as const

export const holdemFormatLabels: Record<HoldemFormat, string> = {
  'fixed-hands': '12 Hands',
  'tournament': 'Tournament'
}

export function holdemBlinds(format: HoldemFormat, completedHands: number, seats: number) {
  const level = format === 'tournament' ? Math.floor(completedHands / HOLDEM_RULES.handsPerLevel) : 0
  const cap = seats * HOLDEM_RULES.startingStack
  const big = Math.min(cap, HOLDEM_RULES.startingBigBlind * 2 ** level)
  return { small: Math.floor(big / 2), big, level }
}
