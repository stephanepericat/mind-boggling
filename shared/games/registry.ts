import { boggleManifest } from './boggle'
import { farkleManifest } from './farkle'
import { holdemManifest } from './texas-holdem/rules'
import { unoManifest } from './uno'
import type { GameKey, GameManifest } from './contract'

export const gameRegistry = new Map<GameKey, GameManifest>([
  [boggleManifest.key, boggleManifest],
  [farkleManifest.key, farkleManifest],
  [unoManifest.key, unoManifest],
  [holdemManifest.key, holdemManifest]
])

export function getGameManifest(key: string): GameManifest | undefined {
  return gameRegistry.get(key as GameKey)
}

export function getGameOptions(): Array<Pick<GameManifest, 'key' | 'name'>> {
  return [...gameRegistry.values()].map(({ key, name }) => ({ key, name }))
}
