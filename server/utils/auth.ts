import { createClerkClient } from '@clerk/backend'
import type { H3Event } from 'h3'
import { getBindings, getRuntimeSecret } from './cloudflare'

export interface Actor {
  clerkUserId: string
  displayName: string
}

function cleanDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return normalized.length >= 2 && normalized.length <= 32 ? normalized : null
}

export async function requireActor(event: H3Event): Promise<Actor> {
  const config = useRuntimeConfig(event)
  if (config.public.demoMode) {
    return { clerkUserId: 'demo_user_1', displayName: 'Demo Player' }
  }

  const auth = event.context.auth?.()
  if (!auth?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  }

  const secretKey = getRuntimeSecret(event, 'NUXT_CLERK_SECRET_KEY') || config.clerk.secretKey
  const user = await createClerkClient({ secretKey }).users.getUser(auth.userId)
  const metadataName = cleanDisplayName(user.publicMetadata.displayName)
  const fullName = cleanDisplayName([user.firstName, user.lastName].filter(Boolean).join(' '))
  const emailName = cleanDisplayName(user.primaryEmailAddress?.emailAddress.split('@')[0])
  return {
    clerkUserId: user.id,
    displayName: metadataName ?? fullName ?? emailName ?? 'Player'
  }
}

export async function syncActor(event: H3Event, actor: Actor): Promise<void> {
  const now = new Date().toISOString()
  await getBindings(event).DB.prepare(`
    INSERT INTO players (clerk_user_id, display_name, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?3)
    ON CONFLICT(clerk_user_id) DO UPDATE SET
      display_name = excluded.display_name,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `).bind(actor.clerkUserId, actor.displayName, now).run()
}

export async function requireSyncedActor(event: H3Event): Promise<Actor> {
  const actor = await requireActor(event)
  await syncActor(event, actor)
  return actor
}

export function validateDisplayName(input: unknown): string {
  const name = cleanDisplayName(input)
  if (!name) {
    throw createError({ statusCode: 422, statusMessage: 'Display name must be between 2 and 32 characters.' })
  }
  const reserved = new Set(['admin', 'administrator', 'system', 'clerk', 'moderator'])
  if (reserved.has(name.toLocaleLowerCase('en-US'))) {
    throw createError({ statusCode: 422, statusMessage: 'Choose a different display name.' })
  }
  return name
}
