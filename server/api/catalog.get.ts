import { gameRegistry } from '../../shared/games/registry'
import { requireSyncedActor } from '../utils/auth'

export default defineEventHandler(async (event) => {
  await requireSyncedActor(event)
  return { games: [...gameRegistry.values()] }
})
