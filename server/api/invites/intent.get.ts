import { getInviteIntent } from '../../utils/matches'
import { verifySignedValue } from '../../utils/crypto'
import { getRuntimeSecret } from '../../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const signed = getCookie(event, 'mb_invite_intent')
  const config = useRuntimeConfig(event)
  const inviteCookieSecret = getRuntimeSecret(event, 'NUXT_INVITE_COOKIE_SECRET') || config.inviteCookieSecret
  if (!signed || inviteCookieSecret.length < 32) return { invite: null }
  const intentId = await verifySignedValue(signed, inviteCookieSecret)
  if (!intentId) return { invite: null }
  const intent = await getInviteIntent(event, intentId)
  if (!intent) return { invite: null }
  return {
    invite: {
      matchName: intent.match_name,
      gameName: intent.game_key === 'boggle.v1' ? 'Boggle' : intent.game_key,
      available: intent.match_status === 'lobby'
        && !intent.revoked_at
        && intent.use_count < intent.max_uses
        && new Date(intent.expires_at) > new Date()
        && new Date(intent.invite_expires_at) > new Date()
    }
  }
})
