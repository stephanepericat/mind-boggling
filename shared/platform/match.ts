import { z } from 'zod'

const idempotencyKey = z.string().min(8).max(100)

export const platformMatchCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('member.ready'), idempotencyKey, ready: z.boolean() }),
  z.object({ type: z.literal('match.start'), idempotencyKey }),
  z.object({ type: z.literal('match.cancel'), idempotencyKey }),
  z.object({ type: z.literal('member.remove'), idempotencyKey, memberId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('match.end'), idempotencyKey })
])

export type PlatformMatchCommand = z.infer<typeof platformMatchCommandSchema>
