import { boggleManifest } from './boggle'
import type { GameKey, GameManifest } from './contract'

export const gameRegistry = new Map<GameKey, GameManifest>([
  [boggleManifest.key, boggleManifest]
])

export function getGameManifest(key: string): GameManifest | undefined {
  return gameRegistry.get(key as GameKey)
}
