import { requireSyncedActor } from '../../utils/auth'
import { verifySignedValue } from '../../utils/crypto'
import { getInviteIntent, redeemInviteIntent } from '../../utils/matches'
import { getRuntimeSecret } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const signed = getCookie(event, 'mb_invite_intent')
  const inviteCookieSecret = getRuntimeSecret(event, 'NUXT_INVITE_COOKIE_SECRET') || config.inviteCookieSecret
  if (!signed || inviteCookieSecret.length < 32) {
    throw createError({ statusCode: 400, statusMessage: 'Open a valid match invitation first.' })
  }
  const intentId = await verifySignedValue(signed, inviteCookieSecret)
  if (!intentId) throw createError({ statusCode: 400, statusMessage: 'The invitation could not be verified.' })
  const intent = await getInviteIntent(event, intentId)
  if (!intent) throw createError({ statusCode: 404, statusMessage: 'The invitation was not found.' })
  const actor = await requireSyncedActor(event)
  const matchId = await redeemInviteIntent(event, actor, intent)
  deleteCookie(event, 'mb_invite_intent', { path: '/' })
  return { matchId }
})
