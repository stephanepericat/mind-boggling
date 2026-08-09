import { requireSyncedActor } from '../../../utils/auth'
import { getRoom } from '../../../utils/cloudflare'
import { requireMembership } from '../../../utils/matches'

export default defineEventHandler(async (event) => {
  const matchId = getRouterParam(event, 'id')
  if (!matchId) throw createError({ statusCode: 400, statusMessage: 'Missing match ID.' })
  const actor = await requireSyncedActor(event)
  const member = await requireMembership(event, matchId, actor.clerkUserId)
  const response = await getRoom(event, matchId).fetch('https://match-room.internal/command', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-member-id': member.id
    },
    body: JSON.stringify(await readBody(event))
  })
  const result = await response.json()
  if (!response.ok) throw createError({ statusCode: response.status, statusMessage: 'The command was rejected.', data: result })
  return result
})
