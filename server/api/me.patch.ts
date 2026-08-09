import { createClerkClient } from '@clerk/backend'
import { requireActor, syncActor, validateDisplayName } from '../utils/auth'
import { getRuntimeSecret } from '../utils/cloudflare'

export default defineEventHandler(async (event) => {
  const actor = await requireActor(event)
  const body = await readBody<{ displayName?: unknown }>(event)
  const displayName = validateDisplayName(body.displayName)
  const config = useRuntimeConfig(event)

  if (!config.public.demoMode) {
    const secretKey = getRuntimeSecret(event, 'NUXT_CLERK_SECRET_KEY') || config.clerk.secretKey
    await createClerkClient({ secretKey }).users.updateUserMetadata(actor.clerkUserId, {
      publicMetadata: { displayName }
    })
  }
  const updated = { clerkUserId: actor.clerkUserId, displayName }
  await syncActor(event, updated)
  return { user: updated }
})
