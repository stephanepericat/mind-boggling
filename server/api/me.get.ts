import { requireSyncedActor } from '../utils/auth'

export default defineEventHandler(async (event) => {
  return { user: await requireSyncedActor(event) }
})
