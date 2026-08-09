import { requireSyncedActor } from '../../../utils/auth'
import { requireMembership, revokeInvites } from '../../../utils/matches'

export default defineEventHandler(async (event) => {
  const matchId = getRouterParam(event, 'id')
  if (!matchId) throw createError({ statusCode: 400, statusMessage: 'Missing match ID.' })
  const actor = await requireSyncedActor(event)
  const member = await requireMembership(event, matchId, actor.clerkUserId)
  await revokeInvites(event, matchId, member)
  return { ok: true }
})
