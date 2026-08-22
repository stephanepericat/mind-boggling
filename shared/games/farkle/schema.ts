import { z } from 'zod'

const idempotencyKey = z.string().min(8).max(100)

export const farkleSettingsSchema = z.object({
  rulesVersion: z.literal('classic.v1').default('classic.v1'),
  targetScore: z.union([z.literal(1000), z.literal(5000), z.literal(10000)]).default(10000),
  locale: z.literal('en-US').default('en-US')
})

export const farkleCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('farkle.roll'), idempotencyKey }),
  z.object({
    type: z.literal('farkle.continue'),
    idempotencyKey,
    rollId: z.string().min(1).max(100),
    selectedDieIds: z.array(z.string().min(1).max(20)).min(1).max(6)
  }),
  z.object({
    type: z.literal('farkle.bank'),
    idempotencyKey,
    rollId: z.string().min(1).max(100),
    selectedDieIds: z.array(z.string().min(1).max(20)).min(1).max(6)
  }),
  z.object({
    type: z.literal('farkle.turn.skip'),
    idempotencyKey,
    memberId: z.string().min(1).max(100)
  })
])

export type FarkleCommand = z.infer<typeof farkleCommandSchema>
