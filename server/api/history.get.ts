import { requireSyncedActor } from '../utils/auth'
import { getHistory } from '../utils/matches'

export default defineEventHandler(async (event) => {
  const actor = await requireSyncedActor(event)
  return { matches: await getHistory(event, actor.clerkUserId) }
})
