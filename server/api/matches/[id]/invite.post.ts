import { requireSyncedActor } from '../../../utils/auth'
import { createReplacementInvite, requireMembership } from '../../../utils/matches'

export default defineEventHandler(async (event) => {
  const matchId = getRouterParam(event, 'id')
  if (!matchId) throw createError({ statusCode: 400, statusMessage: 'Missing match ID.' })
  const actor = await requireSyncedActor(event)
  const member = await requireMembership(event, matchId, actor.clerkUserId)
  return { inviteUrl: await createReplacementInvite(event, matchId, member) }
})
