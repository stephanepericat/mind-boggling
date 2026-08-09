import { z } from 'zod'

export const boggleSettingsSchema = z.object({
  boardSize: z.union([z.literal(4), z.literal(5), z.literal(6)]).default(4),
  roundSeconds: z.union([z.literal(180), z.literal(240), z.literal(300)]).default(180),
  minWordLength: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  rounds: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  countdownWarning: z.boolean().default(true),
  locale: z.literal('en-US').default('en-US')
})

export const boggleSubmitWordSchema = z.object({
  type: z.literal('boggle.word.submit'),
  idempotencyKey: z.string().min(8).max(100),
  word: z.string().min(1).max(64),
  path: z.array(z.number().int().min(0).max(35)).max(36).optional()
})

export const matchCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('member.ready'),
    idempotencyKey: z.string().min(8).max(100),
    ready: z.boolean()
  }),
  z.object({
    type: z.literal('match.start'),
    idempotencyKey: z.string().min(8).max(100)
  }),
  z.object({
    type: z.literal('match.cancel'),
    idempotencyKey: z.string().min(8).max(100)
  }),
  z.object({
    type: z.literal('member.remove'),
    idempotencyKey: z.string().min(8).max(100),
    memberId: z.string().min(1).max(100)
  }),
  z.object({
    type: z.literal('boggle.round.continue'),
    idempotencyKey: z.string().min(8).max(100)
  }),
  z.object({
    type: z.literal('match.end'),
    idempotencyKey: z.string().min(8).max(100)
  }),
  boggleSubmitWordSchema
])

export type MatchCommand = z.infer<typeof matchCommandSchema>
