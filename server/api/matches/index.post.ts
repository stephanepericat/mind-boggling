import { z } from 'zod'
import { requireSyncedActor } from '../../utils/auth'
import { createMatch } from '../../utils/matches'

const inputSchema = z.object({
  name: z.string(),
  gameKey: z.enum(['boggle.v1', 'farkle.v1']),
  settings: z.unknown()
})

export default defineEventHandler(async (event) => {
  const actor = await requireSyncedActor(event)
  const parsed = inputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Check the match settings and try again.' })
  }
  return createMatch(event, actor, parsed.data)
})
