import { createOpaqueToken, sha256, signValue } from '../utils/crypto'
import { getBindings, getRuntimeSecret } from '../utils/cloudflare'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  const match = /^\/join\/([A-Za-z0-9_-]{32,})\/?$/.exec(getRequestURL(event).pathname)
  if (!match?.[1]) return

  const digest = await sha256(match[1])
  const invite = await getBindings(event).DB.prepare(`
    SELECT i.id, m.status, i.revoked_at, i.expires_at, i.use_count, i.max_uses
    FROM invites i JOIN matches m ON m.id = i.match_id
    WHERE i.token_digest = ?1
  `).bind(digest).first<{
    id: string
    status: string
    revoked_at: string | null
    expires_at: string
    use_count: number
    max_uses: number
  }>()

  if (!invite || invite.status !== 'lobby' || invite.revoked_at
    || invite.use_count >= invite.max_uses || new Date(invite.expires_at) <= new Date()) {
    return sendRedirect(event, '/join?status=unavailable', 302)
  }

  const config = useRuntimeConfig(event)
  const inviteCookieSecret = getRuntimeSecret(event, 'NUXT_INVITE_COOKIE_SECRET') || config.inviteCookieSecret
  if (inviteCookieSecret.length < 32) {
    throw createError({ statusCode: 503, statusMessage: 'Invite cookie signing is not configured.' })
  }
  const intentId = createOpaqueToken(24)
  const now = new Date()
  await getBindings(event).DB.prepare(`
    INSERT INTO invite_intents (id, invite_id, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4)
  `).bind(intentId, invite.id, new Date(now.getTime() + 15 * 60 * 1000).toISOString(), now.toISOString()).run()

  setCookie(event, 'mb_invite_intent', await signValue(intentId, inviteCookieSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60
  })
  return sendRedirect(event, '/join', 302)
})
