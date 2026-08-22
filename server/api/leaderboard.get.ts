import { boggleManifest } from '../../shared/games/boggle'
import { getGameManifest, getGameOptions } from '../../shared/games/registry'
import { requireSyncedActor } from '../utils/auth'
import { getAllTimeBest } from '../utils/leaderboard'

export default defineEventHandler(async (event) => {
  await requireSyncedActor(event)
  const requestedGameKey = getQuery(event).gameKey
  const gameKey = typeof requestedGameKey === 'string' ? requestedGameKey : boggleManifest.key
  const game = getGameManifest(gameKey)
  if (!game) {
    throw createError({ statusCode: 422, statusMessage: 'Choose a supported game.' })
  }

  return {
    games: getGameOptions(),
    selectedGameKey: game.key,
    entries: await getAllTimeBest(event, game.key)
  }
})
