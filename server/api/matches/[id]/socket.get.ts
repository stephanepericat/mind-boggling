import { requireSyncedActor } from '../../../utils/auth'
import { getRoom } from '../../../utils/cloudflare'
import { requireMembership } from '../../../utils/matches'

export default defineEventHandler(async (event) => {
  if (getHeader(event, 'upgrade')?.toLocaleLowerCase('en-US') !== 'websocket') {
    throw createError({ statusCode: 426, statusMessage: 'A WebSocket upgrade is required.' })
  }
  const matchId = getRouterParam(event, 'id')
  if (!matchId) throw createError({ statusCode: 400, statusMessage: 'Missing match ID.' })
  const actor = await requireSyncedActor(event)
  const member = await requireMembership(event, matchId, actor.clerkUserId)
  return getRoom(event, matchId).fetch('https://match-room.internal/connect', {
    headers: {
      'Upgrade': 'websocket',
      'x-member-id': member.id
    }
  })
})
