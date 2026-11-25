import { boggleManifest } from '../../shared/games/boggle'
import { getGameManifest, getGameOptions } from '../../shared/games/registry'
import { requireSyncedActor } from '../utils/auth'
import { getAllTimeBest } from '../utils/leaderboard'

export default defineEventHandler(async (event) => {
  await requireSyncedActor(event)
  const requestedGameKey = getQuery(event).gameKey
  const gameKey = typeof requestedGameKey === 'string' ? requestedGameKey : boggleManifest.key
  const game = getGameManifest(gameKey)
  if (!game || game.key === 'texas-holdem.v1') {
    throw createError({ statusCode: 422, statusMessage: 'Choose a supported game.' })
  }

  return {
    games: getGameOptions().filter(option => option.key !== 'texas-holdem.v1'),
    selectedGameKey: game.key,
    entries: await getAllTimeBest(event, game.key)
  }
})
