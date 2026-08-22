import type { H3Event } from 'h3'
import { boggleSettingsSchema } from '../../shared/games/boggle'
import { farkleSettingsSchema } from '../../shared/games/farkle'
import { getGameManifest } from '../../shared/games/registry'
import type { GameKey } from '../../shared/games/contract'
import type { MatchHistoryItem } from '../../shared/types/api'
import type { Actor } from './auth'
import { getBindings, getRoom } from './cloudflare'
import { createOpaqueToken, sha256 } from './crypto'

interface MatchRow {
  id: string
  name: string
  game_key: GameKey
  status: string
  settings_json: string
  host_member_id: string
}

interface MemberRow {
  id: string
  match_id: string
  clerk_user_id: string
  display_name_snapshot: string
  role: 'host' | 'player'
  removed_at?: string | null
}

interface InviteIntentRow {
  id: string
  invite_id: string
  expires_at: string
  consumed_by_clerk_user_id: string | null
  match_id: string
  match_name: string
  game_key: string
  match_status: string
  max_uses: number
  use_count: number
  revoked_at: string | null
  invite_expires_at: string
}

export async function createMatch(
  event: H3Event,
  actor: Actor,
  input: { gameKey: 'boggle.v1' | 'farkle.v1', name: string, settings: unknown }
): Promise<{ matchId: string, inviteUrl: string }> {
  const manifest = getGameManifest(input.gameKey)
  if (!manifest) throw createError({ statusCode: 422, statusMessage: 'That game is not available.' })
  const settings = input.gameKey === 'boggle.v1'
    ? boggleSettingsSchema.parse(input.settings)
    : farkleSettingsSchema.parse(input.settings)
  const name = input.name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 48) {
    throw createError({ statusCode: 422, statusMessage: 'Match name must be between 2 and 48 characters.' })
  }

  const matchId = crypto.randomUUID()
  const hostMemberId = crypto.randomUUID()
  const inviteId = crypto.randomUUID()
  const rawToken = createOpaqueToken()
  const tokenDigest = await sha256(rawToken)
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const db = getBindings(event).DB

  await db.batch([
    db.prepare(`
      INSERT INTO matches
        (id, name, game_key, game_version, host_member_id, status, settings_json, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'lobby', ?6, ?7)
    `).bind(matchId, name, input.gameKey, manifest.version, hostMemberId, JSON.stringify(settings), now),
    db.prepare(`
      INSERT INTO match_members
        (id, match_id, clerk_user_id, display_name_snapshot, role, joined_at)
      VALUES (?1, ?2, ?3, ?4, 'host', ?5)
    `).bind(hostMemberId, matchId, actor.clerkUserId, actor.displayName, now),
    db.prepare(`
      INSERT INTO invites
        (id, match_id, token_digest, created_by_member_id, max_uses, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(inviteId, matchId, tokenDigest, hostMemberId, manifest.maxPlayers - 1, expiresAt, now)
  ])

  const initialization = await getRoom(event, matchId).fetch('https://match-room.internal/initialize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      state: {
        id: matchId,
        name,
        gameKey: input.gameKey,
        settings,
        hostMemberId,
        members: [{
          id: hostMemberId,
          clerkUserId: actor.clerkUserId,
          displayName: actor.displayName,
          role: 'host',
          ready: false
        }]
      }
    })
  })
  if (!initialization.ok) {
    throw createError({ statusCode: 502, statusMessage: 'The match room could not be initialized.' })
  }

  const config = useRuntimeConfig(event)
  return { matchId, inviteUrl: `${config.public.appUrl}/join/${rawToken}` }
}

export async function requireMembership(event: H3Event, matchId: string, clerkUserId: string): Promise<MemberRow> {
  const member = await getBindings(event).DB.prepare(`
    SELECT id, match_id, clerk_user_id, display_name_snapshot, role
    FROM match_members
    WHERE match_id = ?1 AND clerk_user_id = ?2 AND removed_at IS NULL
  `).bind(matchId, clerkUserId).first<MemberRow>()
  if (!member) throw createError({ statusCode: 403, statusMessage: 'You are not a participant in this match.' })
  return member
}

export async function getInviteIntent(event: H3Event, intentId: string): Promise<InviteIntentRow | null> {
  return getBindings(event).DB.prepare(`
    SELECT
      ii.id, ii.invite_id, ii.expires_at, ii.consumed_by_clerk_user_id,
      i.match_id, i.max_uses, i.use_count, i.revoked_at, i.expires_at AS invite_expires_at,
      m.name AS match_name, m.game_key, m.status AS match_status
    FROM invite_intents ii
    JOIN invites i ON i.id = ii.invite_id
    JOIN matches m ON m.id = i.match_id
    WHERE ii.id = ?1
  `).bind(intentId).first<InviteIntentRow>()
}

export async function redeemInviteIntent(
  event: H3Event,
  actor: Actor,
  intent: InviteIntentRow
): Promise<string> {
  const now = new Date()
  if (new Date(intent.expires_at) <= now || new Date(intent.invite_expires_at) <= now) {
    throw createError({ statusCode: 410, statusMessage: 'This invitation has expired.' })
  }
  if (intent.revoked_at || intent.match_status !== 'lobby' || intent.use_count >= intent.max_uses) {
    throw createError({ statusCode: 409, statusMessage: 'This invitation is no longer available.' })
  }
  if (intent.consumed_by_clerk_user_id && intent.consumed_by_clerk_user_id !== actor.clerkUserId) {
    throw createError({ statusCode: 409, statusMessage: 'This browser invitation has already been used.' })
  }

  const db = getBindings(event).DB
  const existing = await db.prepare(`
    SELECT id, match_id, clerk_user_id, display_name_snapshot, role, removed_at
    FROM match_members WHERE match_id = ?1 AND clerk_user_id = ?2
  `).bind(intent.match_id, actor.clerkUserId).first<MemberRow>()

  if (existing?.removed_at) {
    throw createError({ statusCode: 403, statusMessage: 'You were removed from this match.' })
  }

  let member = existing
  if (!member) {
    const count = await db.prepare(`
      SELECT COUNT(*) AS count FROM match_members WHERE match_id = ?1 AND removed_at IS NULL
    `).bind(intent.match_id).first<{ count: number }>()
    const manifest = getGameManifest(intent.game_key)
    if (!manifest || (count?.count ?? 0) >= manifest.maxPlayers) {
      throw createError({ statusCode: 409, statusMessage: 'This match is full.' })
    }
    const memberId = crypto.randomUUID()
    const joinedAt = now.toISOString()
    await db.batch([
      db.prepare(`
        INSERT INTO match_members
          (id, match_id, clerk_user_id, display_name_snapshot, role, joined_at)
        VALUES (?1, ?2, ?3, ?4, 'player', ?5)
      `).bind(memberId, intent.match_id, actor.clerkUserId, actor.displayName, joinedAt),
      db.prepare(`UPDATE invites SET use_count = use_count + 1 WHERE id = ?1 AND use_count < max_uses`).bind(intent.invite_id),
      db.prepare(`
        UPDATE invite_intents SET consumed_by_clerk_user_id = ?1, consumed_at = ?2 WHERE id = ?3
      `).bind(actor.clerkUserId, joinedAt, intent.id)
    ])
    member = {
      id: memberId,
      match_id: intent.match_id,
      clerk_user_id: actor.clerkUserId,
      display_name_snapshot: actor.displayName,
      role: 'player'
    }
  }

  const response = await getRoom(event, intent.match_id).fetch('https://match-room.internal/member', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: member.id,
      clerkUserId: member.clerk_user_id,
      displayName: member.display_name_snapshot,
      role: member.role,
      ready: false
    })
  })
  if (!response.ok) throw createError({ statusCode: 409, statusMessage: 'The match is no longer accepting players.' })
  return intent.match_id
}

export async function createReplacementInvite(event: H3Event, matchId: string, member: MemberRow): Promise<string> {
  if (member.role !== 'host') throw createError({ statusCode: 403, statusMessage: 'Only the host can create invitations.' })
  const db = getBindings(event).DB
  const match = await db.prepare('SELECT * FROM matches WHERE id = ?1').bind(matchId).first<MatchRow>()
  if (!match || match.status !== 'lobby') throw createError({ statusCode: 409, statusMessage: 'The match has already started.' })
  const manifest = getGameManifest(match.game_key)
  if (!manifest) throw createError({ statusCode: 409, statusMessage: 'This game is no longer available.' })
  const rawToken = createOpaqueToken()
  const now = new Date().toISOString()
  await db.batch([
    db.prepare('UPDATE invites SET revoked_at = ?1 WHERE match_id = ?2 AND revoked_at IS NULL').bind(now, matchId),
    db.prepare(`
      INSERT INTO invites
        (id, match_id, token_digest, created_by_member_id, max_uses, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(
      crypto.randomUUID(),
      matchId,
      await sha256(rawToken),
      member.id,
      manifest.maxPlayers - 1,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      now
    )
  ])
  const config = useRuntimeConfig(event)
  return `${config.public.appUrl}/join/${rawToken}`
}

export async function revokeInvites(event: H3Event, matchId: string, member: MemberRow): Promise<void> {
  if (member.role !== 'host') throw createError({ statusCode: 403, statusMessage: 'Only the host can revoke invitations.' })
  await getBindings(event).DB.prepare(`
    UPDATE invites SET revoked_at = ?1 WHERE match_id = ?2 AND revoked_at IS NULL
  `).bind(new Date().toISOString(), matchId).run()
}

export async function getHistory(event: H3Event, clerkUserId: string): Promise<MatchHistoryItem[]> {
  const rows = await getBindings(event).DB.prepare(`
    SELECT match_id, match_name, game_key, completed_at, placement, score, participants_json
    FROM player_match_summaries
    WHERE clerk_user_id = ?1
    ORDER BY completed_at DESC
    LIMIT 50
  `).bind(clerkUserId).all<{
    match_id: string
    match_name: string
    game_key: string
    completed_at: string
    placement: number
    score: number
    participants_json: string
  }>()
  return rows.results.map(row => ({
    matchId: row.match_id,
    matchName: row.match_name,
    gameName: getGameManifest(row.game_key)?.name ?? row.game_key,
    completedAt: row.completed_at,
    placement: row.placement,
    score: row.score,
    participants: JSON.parse(row.participants_json) as string[]
  }))
}
