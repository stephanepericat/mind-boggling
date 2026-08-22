import { boggleManifest } from './boggle'
import { farkleManifest } from './farkle'
import type { GameKey, GameManifest } from './contract'

export const gameRegistry = new Map<GameKey, GameManifest>([
  [boggleManifest.key, boggleManifest],
  [farkleManifest.key, farkleManifest]
])

export function getGameManifest(key: string): GameManifest | undefined {
  return gameRegistry.get(key as GameKey)
}

export function getGameOptions(): Array<Pick<GameManifest, 'key' | 'name'>> {
  return [...gameRegistry.values()].map(({ key, name }) => ({ key, name }))
}
